/**
 * Speechmatics client — narration and word-level timing.
 *
 * Two separate services, used for two different jobs:
 *
 *   Text-to-speech   `preview.tts.speechmatics.com`. Four English voices,
 *                    16 kHz mono WAV. English only at present, so non-English
 *                    narration falls to Piper (see lib/voice/index.ts).
 *
 *   Batch transcription  `asr.api.speechmatics.com`. 70+ languages, and every
 *                    word comes back with `start_time` and `end_time`. This is
 *                    the caption engine's clock.
 *
 * A deliberate constraint on the transcription side: we use it for TIMING ONLY.
 * The words that appear on screen always come from the script we already hold.
 * ASR is very good but not perfect, and a mis-transcription rendered over a
 * verse would be indistinguishable, to a viewer, from altered Scripture.
 */

import { cleanEnv } from '@/lib/env';

const TTS_BASE = 'https://preview.tts.speechmatics.com';
const ASR_BASE = 'https://asr.api.speechmatics.com/v2';

/** The four voices the TTS preview currently serves. */
export const SPEECHMATICS_VOICES = [
  { id: 'sarah', label: 'Sarah', gender: 'female', accent: 'British' },
  { id: 'theo', label: 'Theo', gender: 'male', accent: 'British' },
  { id: 'megan', label: 'Megan', gender: 'female', accent: 'American' },
  { id: 'jack', label: 'Jack', gender: 'male', accent: 'American' },
] as const;

export type SpeechmaticsVoiceId = (typeof SPEECHMATICS_VOICES)[number]['id'];

export class SpeechmaticsError extends Error {
  readonly status?: number;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'SpeechmaticsError';
    this.status = options.status;
  }
}

/** One word as Speechmatics heard it. Content is used for matching, not display. */
export interface AsrWord {
  content: string;
  start: number;
  end: number;
  confidence: number;
}

export class SpeechmaticsClient {
  private readonly apiKey: string;

  constructor(apiKey?: string) {
    const key = apiKey ?? cleanEnv('SPEECHMATICS_API_KEY');
    if (!key) {
      throw new SpeechmaticsError(
        'Missing SPEECHMATICS_API_KEY. Add it to .env.local.',
      );
    }
    this.apiKey = key;
  }

  /**
   * Synthesize narration. Returns 16 kHz mono WAV bytes.
   *
   * English only — callers must route other languages to Piper. That is
   * enforced in lib/voice/index.ts rather than here, so this stays a thin
   * client over the service.
   */
  async synthesize(
    text: string,
    voice: SpeechmaticsVoiceId,
    signal?: AbortSignal,
  ): Promise<Uint8Array> {
    const response = await fetch(`${TTS_BASE}/generate/${voice}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal,
    });

    if (!response.ok) {
      throw new SpeechmaticsError(
        `Speechmatics TTS failed: ${response.status} ${response.statusText}. ` +
          `${(await response.text().catch(() => '')).slice(0, 300)}`,
        { status: response.status },
      );
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength < 64) {
      throw new SpeechmaticsError('Speechmatics TTS returned an empty audio file.');
    }
    return bytes;
  }

  /**
   * Transcribe audio and return word timings.
   *
   * `language` is the Speechmatics language code from the registry
   * (`LanguageEntry.asrCode`), NOT our BCP-47 code — they differ for Mandarin
   * (`cmn`) among others, which is why the registry stores both.
   */
  async transcribe(
    audio: Uint8Array,
    language: string,
    options: { signal?: AbortSignal; pollIntervalMs?: number; timeoutMs?: number } = {},
  ): Promise<AsrWord[]> {
    const jobId = await this.submitJob(audio, language, options.signal);
    return this.awaitTranscript(jobId, options);
  }

  private async submitJob(
    audio: Uint8Array,
    language: string,
    signal?: AbortSignal,
  ): Promise<string> {
    const form = new FormData();
    form.append(
      'config',
      JSON.stringify({
        type: 'transcription',
        transcription_config: {
          language,
          // `enhanced` costs more per minute but places word boundaries more
          // precisely, and boundary precision is the entire point here.
          operating_point: 'enhanced',
        },
      }),
    );
    form.append(
      'data_file',
      new Blob([audio as BlobPart], { type: 'audio/wav' }),
      'narration.wav',
    );

    const response = await fetch(`${ASR_BASE}/jobs`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
      signal,
    });

    if (!response.ok) {
      throw new SpeechmaticsError(
        `Speechmatics job submission failed: ${response.status} ${response.statusText}. ` +
          `${(await response.text().catch(() => '')).slice(0, 300)}`,
        { status: response.status },
      );
    }

    const json = (await response.json()) as { id?: string };
    if (!json.id) {
      throw new SpeechmaticsError('Speechmatics job submission returned no id.');
    }
    return json.id;
  }

  private async awaitTranscript(
    jobId: string,
    options: { signal?: AbortSignal; pollIntervalMs?: number; timeoutMs?: number },
  ): Promise<AsrWord[]> {
    const interval = options.pollIntervalMs ?? 2_000;
    const deadline = Date.now() + (options.timeoutMs ?? 180_000);

    while (Date.now() < deadline) {
      const response = await fetch(
        `${ASR_BASE}/jobs/${jobId}/transcript?format=json-v2`,
        {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          signal: options.signal,
        },
      );

      if (response.ok) {
        const json = (await response.json()) as { results?: unknown[] };
        return extractWords(json.results ?? []);
      }

      // 404 while the job is still running is expected, not an error.
      if (response.status !== 404) {
        const detail = (await response.text().catch(() => '')).slice(0, 300);
        // Speechmatics answers 404 with a "job not done" style body while
        // running; anything else is a real failure.
        if (!/running|pending|not.*(done|found)/i.test(detail)) {
          throw new SpeechmaticsError(
            `Speechmatics transcript fetch failed: ${response.status} ${response.statusText}. ${detail}`,
            { status: response.status },
          );
        }
      }

      await sleep(interval, options.signal);
    }

    throw new SpeechmaticsError(
      `Speechmatics job ${jobId} did not finish within the timeout.`,
    );
  }
}

function extractWords(results: unknown[]): AsrWord[] {
  const words: AsrWord[] = [];
  for (const entry of results) {
    if (typeof entry !== 'object' || entry === null) continue;
    const record = entry as Record<string, unknown>;
    if (record.type !== 'word') continue;

    const alternatives = record.alternatives;
    const first = Array.isArray(alternatives)
      ? (alternatives[0] as Record<string, unknown> | undefined)
      : undefined;
    const content = first?.content;
    if (typeof content !== 'string') continue;

    words.push({
      content,
      start: Number(record.start_time ?? 0),
      end: Number(record.end_time ?? 0),
      confidence: typeof first?.confidence === 'number' ? first.confidence : 1,
    });
  }
  return words;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}

let client: SpeechmaticsClient | null = null;

export function getSpeechmatics(): SpeechmaticsClient {
  client ??= new SpeechmaticsClient();
  return client;
}
