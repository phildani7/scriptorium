/**
 * Turn a compact render request into a finished gallery entry.
 *
 *   npx tsx scripts/render-request.ts --request request.json
 *
 * Runs in the GitHub Actions render job (and works identically on a laptop).
 * The request carries no narration — this script re-synthesizes it from the
 * same script text with the same voice and the same aligner, then renders
 * through render/render.ts, which independently re-fetches the passage from
 * YouVersion and refuses to produce a file if anything was altered.
 *
 * Output: renders/<id>.mp4, public/gallery/<id>.mp4 + <id>.jpg poster, and an
 * updated public/gallery/manifest.json.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { buildNarrationScript } from '@/lib/script/build';
import { getLanguage } from '@/lib/languages/registry';
import { resolveMusic } from '@/lib/theme/options';
import { verifyVerbatim } from '@/lib/verify/verbatim';
import { alignScriptToAudio, wavDurationSeconds } from '@/lib/voice/align';
import { getSpeechmatics } from '@/lib/voice/speechmatics';
import { synthesizeAndAlign } from '@/lib/voice';
import type { DeviceItem, Passage, VoiceId } from '@/lib/types';

/**
 * Synthesize narration with Piper — the multilingual half of the voice story.
 *
 * Piper runs only where a real machine exists (this render job, or a laptop),
 * never on serverless: the models are ~60 MB ONNX files the CLI pulls from
 * Hugging Face on first use. MIT-licensed voices in ~50 languages, which is
 * what turns "captions-only" languages into narrated shorts.
 *
 * Returns null when the CLI is missing so the caller can fall back to
 * estimated timings instead of failing the render.
 */
function synthesizeWithPiper(script: string, model: string, workdir: string): Uint8Array | null {
  const wavPath = join(workdir, 'piper-narration.wav');
  // Matches the CI cache path so voice models persist across runs.
  const modelsDir = '.piper-models';
  mkdirSync(modelsDir, { recursive: true });

  const python = process.platform === 'win32' ? 'python' : 'python3';
  const opts = { timeout: 300_000, encoding: 'utf8' as const };

  // piper >= 1.3 (piper1-gpl) split downloading out of synthesis. Idempotent:
  // an already-cached voice is a no-op.
  const download = spawnSync(
    python,
    ['-m', 'piper.download_voices', model, '--data-dir', modelsDir],
    opts,
  );
  if (download.error || download.status !== 0) {
    console.warn(
      `piper voice download failed (${download.status ?? download.error}): ` +
        `${(download.stderr ?? '').toString().trim().slice(-500)}\n` +
        'falling back to estimated timings without narration.',
    );
    return null;
  }

  const result = spawnSync(
    python,
    ['-m', 'piper', '-m', model, '--data-dir', modelsDir, '-f', wavPath, '--', script],
    opts,
  );

  if (result.error || result.status !== 0 || !existsSync(wavPath)) {
    console.warn(
      `piper synthesis failed (${result.status ?? result.error}): ` +
        `${(result.stderr ?? '').toString().trim().slice(-500)}\n` +
        'falling back to estimated timings without narration.',
    );
    return null;
  }
  return new Uint8Array(readFileSync(wavPath));
}

interface RenderRequest {
  id: string;
  style: string;
  theme?: Record<string, string>;
  languageCode: string;
  voice?: VoiceId;
  passage: Passage;
  device: DeviceItem;
  script?: string;
  dir?: string;
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const requestPath = arg('--request');
  if (!requestPath) throw new Error('--request <file> is required');

  const request = JSON.parse(readFileSync(resolve(requestPath), 'utf8')) as RenderRequest;
  const { passage, device } = request;
  const id = String(request.id || `short-${Date.now().toString(36)}`).replace(/[^\w.-]/g, '-');

  // ---- rebuild narration ---------------------------------------------------
  const { script, segments } = buildNarrationScript({ device, passage });

  // Teaching-format scripts carry no verse segment (the verse is cited, not
  // displayed); render.ts still re-fetches the cited passage and diffs it
  // against the spec, so provenance holds either way.
  const verseSeg = segments.find((s) => s.kind === 'verse');
  if (verseSeg) {
    const gate = verifyVerbatim(verseSeg.text, passage.text);
    if (!gate.ok) throw new Error(gate.message);
  }

  let audioUrl = '';
  let durationSec = 0;
  let timings;
  let timingSource: 'speechmatics' | 'estimated' = 'estimated';

  mkdirSync('.render-tmp', { recursive: true });

  if (request.voice?.engine === 'speechmatics' && process.env.SPEECHMATICS_API_KEY) {
    const result = await synthesizeAndAlign({
      script,
      languageCode: request.languageCode,
      voice: request.voice,
    });
    audioUrl = `data:audio/wav;base64,${Buffer.from(result.audio).toString('base64')}`;
    durationSec = result.durationSec;
    timings = result.timings;
    timingSource = result.timingSource;
  } else if (request.voice?.engine === 'piper') {
    // Piper speaks the language; Speechmatics still supplies the clock where
    // it can. The words on screen come from the script either way.
    const audio = synthesizeWithPiper(script, request.voice.model, '.render-tmp');
    if (audio) {
      audioUrl = `data:audio/wav;base64,${Buffer.from(audio).toString('base64')}`;
      durationSec = wavDurationSeconds(audio);

      const asrCode = getLanguage(request.languageCode)?.asrCode;
      if (asrCode && process.env.SPEECHMATICS_API_KEY) {
        const words = await getSpeechmatics().transcribe(audio, asrCode);
        const aligned = alignScriptToAudio(script, words, durationSec);
        timings = aligned.timings;
        timingSource = aligned.matchRate >= 0.5 ? 'speechmatics' : 'estimated';
      } else {
        timings = alignScriptToAudio(script, [], durationSec).timings;
      }
    }
  }

  if (!timings) {
    const words = script.trim().split(/\s+/).length;
    durationSec = Math.max(15, Math.min(45, words / 2.6));
    timings = alignScriptToAudio(script, [], durationSec).timings;
    timingSource = 'estimated';
  }

  const spec = {
    id,
    passage,
    device,
    style: request.style,
    theme: request.theme ?? {},
    languageCode: request.languageCode,
    voice: request.voice ?? { engine: 'browser', model: request.languageCode, label: 'estimated' },
    narration: { script, audioUrl, durationSec, timings, timingSource, segments },
    music: null,
    durationSec,
    verified: true,
    script: request.script ?? 'latin',
    dir: request.dir ?? 'ltr',
  };

  mkdirSync('samples', { recursive: true });
  const specPath = join('samples', `${id}.json`);
  writeFileSync(specPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  console.log(`spec        ${specPath} (${Math.round(durationSec)}s, ${timingSource})`);

  // ---- render (the gate re-fetches the passage in there) -------------------
  const outPath = join('renders', `${id}.mp4`);
  const render = spawnSync(
    'npx',
    ['tsx', 'render/render.ts', '--spec', specPath, '--out', outPath, '--quality', 'high'],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (render.status !== 0) throw new Error(`render exited ${render.status}`);

  // ---- gallery entry --------------------------------------------------------
  const galleryDir = join('public', 'gallery');
  mkdirSync(galleryDir, { recursive: true });
  copyFileSync(outPath, join(galleryDir, `${id}.mp4`));

  // Poster: a frame from just after the verse lands (2/3 in reads well).
  const poster = spawnSync(
    'ffmpeg',
    ['-y', '-ss', String(Math.max(1, durationSec * 0.66)), '-i', outPath, '-frames:v', '1', '-q:v', '3', join(galleryDir, `${id}.jpg`)],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (poster.status !== 0) console.warn('poster generation failed; continuing without one');

  // ---- manifest --------------------------------------------------------------
  const manifestPath = join(galleryDir, 'manifest.json');
  const manifest: Array<Record<string, unknown>> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : [];

  const entry = {
    id,
    video: `/gallery/${id}.mp4`,
    poster: existsSync(join(galleryDir, `${id}.jpg`)) ? `/gallery/${id}.jpg` : null,
    reference: passage.reference,
    version: passage.versionAbbreviation,
    // Provenance lives here now that the frame carries no attribution block.
    attribution: passage.attribution,
    musicCredit: resolveMusic(request.theme as never).credit || undefined,
    language: request.languageCode,
    style: request.style,
    lens: device.type,
    durationSec: Math.round(durationSec),
    timingSource,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  const next = [entry, ...manifest.filter((m) => m.id !== id)];
  writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  console.log(`gallery     ${entry.video} (${next.length} entries)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
