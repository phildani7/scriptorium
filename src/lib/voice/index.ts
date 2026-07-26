/**
 * Voice: narration in, word timings out.
 *
 * Three engines, chosen by what a language can actually support rather than by
 * preference:
 *
 *   speechmatics  English. Best quality available to us, and the user has
 *                 credits. Four voices.
 *   piper         The other ~50 languages. MIT-licensed neural voices, runs
 *                 offline, which also makes it the only option inside the
 *                 GitHub Actions render where there is no network.
 *   browser       Live preview only. Zero cost, instant, uses whatever the
 *                 viewer's OS provides. Never used for a rendered MP4.
 *
 * Alignment is uniform regardless of engine: Speechmatics transcription gives
 * the timings for any language it supports, and where it does not, timings are
 * estimated from word length. `TimingSource` records which happened, and the UI
 * shows it, because a creator deserves to know whether their captions are
 * measured or guessed.
 */

import type { Narration, VoiceId, WordTiming } from '@/lib/types';
import { getLanguage, tierOf } from '@/lib/languages/registry';
import {
  SPEECHMATICS_VOICES,
  type SpeechmaticsVoiceId,
  getSpeechmatics,
} from './speechmatics';
import { alignScriptToAudio, wavDurationSeconds } from './align';

export * from './speechmatics';
export * from './align';

export interface VoiceOption extends VoiceId {
  /** False when the engine cannot run in the browser preview. */
  previewable: boolean;
  description: string;
}

/**
 * Voices offered for a language.
 *
 * English gets the Speechmatics voices; every other language gets its Piper
 * model if one exists. The browser voice is always offered last as an instant,
 * free preview.
 */
export function voicesFor(languageCode: string): VoiceOption[] {
  const entry = getLanguage(languageCode);
  const options: VoiceOption[] = [];

  if (languageCode === 'en') {
    for (const v of SPEECHMATICS_VOICES) {
      options.push({
        engine: 'speechmatics',
        model: v.id,
        label: `${v.label} (${v.accent})`,
        previewable: false,
        description: `Speechmatics neural voice, ${v.gender}, ${v.accent} English.`,
      });
    }
  }

  if (entry?.piperVoice) {
    options.push({
      engine: 'piper',
      model: entry.piperVoice,
      label: `${entry.nativeName} neural voice`,
      previewable: false,
      description: `Piper ${entry.piperVoice} — MIT-licensed, runs offline during MP4 export.`,
    });
  }

  options.push({
    engine: 'browser',
    model: languageCode,
    label: 'Device voice (instant preview)',
    previewable: true,
    description:
      'Uses the voice built into your device. Instant and free, but quality varies and it is not used for the exported MP4.',
  });

  return options;
}

export function defaultVoiceFor(languageCode: string): VoiceId {
  const [first] = voicesFor(languageCode);
  return first;
}

export interface SynthesisRequest {
  script: string;
  languageCode: string;
  voice: VoiceId;
  signal?: AbortSignal;
}

export interface SynthesisResult {
  /** WAV bytes. Empty for the browser engine, which synthesises client-side. */
  audio: Uint8Array;
  durationSec: number;
  timings: WordTiming[];
  timingSource: Narration['timingSource'];
  /** Share of words whose timing was measured rather than estimated. */
  matchRate: number;
}

/**
 * Synthesize narration and produce word timings for it.
 *
 * Server-side only — it holds the Speechmatics key. The browser engine is not
 * handled here at all; the client synthesises those previews itself using the
 * Web Speech API and its `onboundary` events.
 */
export async function synthesizeAndAlign(
  request: SynthesisRequest,
): Promise<SynthesisResult> {
  const { script, languageCode, voice, signal } = request;

  if (voice.engine === 'browser') {
    throw new Error(
      'The browser voice is synthesised client-side; call synthesizeAndAlign only for speechmatics or piper.',
    );
  }

  if (voice.engine === 'piper') {
    // Piper runs in the render job, not in the web process: the models are
    // ~60 MB each and Vercel's bundle ceiling makes shipping them impossible.
    // Until export runs, non-English preview uses the browser voice.
    throw new Error(
      `Piper voice "${voice.model}" is synthesised during MP4 export, not in the web app. ` +
        'Use the device voice for live preview in this language.',
    );
  }

  const speechmatics = getSpeechmatics();

  const audio = await speechmatics.synthesize(
    script,
    voice.model as SpeechmaticsVoiceId,
    signal,
  );
  const durationSec = wavDurationSeconds(audio);

  const entry = getLanguage(languageCode);
  const asrCode = entry?.asrCode;

  // No transcription support for this language: estimate rather than fail.
  if (!asrCode) {
    const aligned = alignScriptToAudio(script, [], durationSec);
    return {
      audio,
      durationSec,
      timings: aligned.timings,
      timingSource: 'estimated',
      matchRate: 0,
    };
  }

  const words = await speechmatics.transcribe(audio, asrCode, { signal });
  const aligned = alignScriptToAudio(script, words, durationSec);

  return {
    audio,
    durationSec,
    timings: aligned.timings,
    // A very low match rate means alignment effectively failed and the timings
    // are interpolation dressed up as measurement. Say so.
    timingSource: aligned.matchRate >= 0.5 ? 'speechmatics' : 'estimated',
    matchRate: aligned.matchRate,
  };
}

/**
 * Can this language be narrated at all, and how well?
 * Mirrors the registry tier, phrased for the UI.
 */
export function voiceCapability(languageCode: string): {
  tier: ReturnType<typeof tierOf>;
  headline: string;
} {
  const entry = getLanguage(languageCode);
  if (!entry) {
    return { tier: 'text-first', headline: 'Captions only — no voice model yet.' };
  }

  const tier = tierOf(entry);
  const headline =
    tier === 'full'
      ? 'Neural voice with word-level timing measured from the audio.'
      : tier === 'voiced'
        ? 'Neural voice; caption timing is estimated from word length.'
        : 'Captions only — no free voice model exists for this language yet.';

  return { tier, headline };
}
