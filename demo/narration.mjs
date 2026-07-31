/**
 * Narrate the demo with Kokoro, locally.
 *
 *   node demo/narration.mjs
 *
 * `hyperframes tts` runs Kokoro-82M on this machine — no key, no upload, no
 * per-character billing — which is the same reasoning that put Piper in the
 * export job. `af_heart` is its default voice and the one that sounded right.
 *
 * One WAV per segment rather than a single long take. The narration then DRIVES
 * the cut: each segment is held for exactly as long as its line takes to say,
 * so nothing has to be nudged by hand and a rewrite re-times the film. A single
 * file would mean chasing offsets every time a sentence changed.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'demo', 'vo');

/**
 * Written to be spoken, not read. Short sentences, one idea each, and the
 * claim stated plainly in the middle where it lands hardest.
 */
export { LINES } from './lines.mjs';
import { LINES } from './lines.mjs';

const VOICE = process.env.DEMO_VOICE ?? 'af_heart';
const SPEED = process.env.DEMO_SPEED ?? '0.95';

function main() {
  mkdirSync(OUT, { recursive: true });
  const results = [];

  for (const line of LINES) {
    const out = join(OUT, `${line.id}.wav`);
    const text = line.text.replace(/&apos;/g, "'");

    if (!existsSync(out) || process.argv.includes('--force')) {
      // The line goes through a FILE, never as an argv string. `npx` needs a
      // shell on Windows, and a shell concatenates arguments without escaping
      // them -- so a sentence with spaces and punctuation arrived as a single
      // mangled word and Kokoro dutifully spoke one second of it.
      const txt = join(OUT, `${line.id}.txt`);
      writeFileSync(txt, text, 'utf8');
      execFileSync(
        'npx',
        ['--yes', 'hyperframes@latest', 'tts', '--text-file', txt,
         '--voice', VOICE, '--speed', SPEED, '--output', out],
        { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', maxBuffer: 1 << 26 },
      );
    }

    const seconds = Number(
      execFileSync('ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out],
        { encoding: 'utf8' }).trim(),
    );
    results.push({ id: line.id, seconds });
    console.log(`  ${line.id.padEnd(8)} ${seconds.toFixed(1).padStart(6)}s  ${text.slice(0, 58)}…`);
  }

  const total = results.reduce((n, r) => n + r.seconds, 0);
  console.log(`\n${VOICE} @ ${SPEED}x — ${results.length} lines, ${total.toFixed(1)}s of narration`);
  console.log(`  ${OUT}`);
}

main();
