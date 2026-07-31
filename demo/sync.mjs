/**
 * Synthesize the narration and derive every timing from it.
 *
 *   node demo/sync.mjs            (reuses cached lines)
 *   node demo/sync.mjs --force    (re-speaks everything)
 *
 * Produces:
 *   demo/vo/<id>.wav      one Kokoro line per id
 *   demo/holds.json       per-step screen time: max(3.4s, line + 0.7s)
 *   demo/vo/walk.wav      the walkthrough track, each line PADDED WITH
 *                         SILENCE to exactly its step's hold
 *
 * The padding is the synchronization mechanism. The film's steps are laid out
 * from holds.json; the audio is the same holds realized as sound. Concatenate
 * either list and you get the same total to the frame — voice and screen
 * cannot drift because they are two renderings of one array.
 *
 * The 3.4-second floor exists for the tooltips: "Eight palettes." takes 1.4
 * seconds to say, and a card that flashes for 1.4 seconds is decoration, not
 * explanation.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LINES, STEP_ORDER } from './lines.mjs';

const ROOT = process.cwd();
const VO = join(ROOT, 'demo', 'vo');
const PADDED = join(VO, 'padded');

const VOICE = process.env.DEMO_VOICE ?? 'af_heart';
const SPEED = process.env.DEMO_SPEED ?? '1.0';
const FLOOR = 3.4;
const PAD = 0.7;

const dur = (f) =>
  Number(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
    { encoding: 'utf8' }).trim());

const ff = (args) =>
  execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args],
    { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });

function speak(id, text) {
  const out = join(VO, `${id}.wav`);
  if (existsSync(out) && !process.argv.includes('--force')) return out;
  // Through a file, never argv: the Windows shell would mangle the sentence.
  const txt = join(VO, `${id}.txt`);
  writeFileSync(txt, text, 'utf8');
  execFileSync('npx',
    ['--yes', 'hyperframes@latest', 'tts', '--text-file', txt,
     '--voice', VOICE, '--speed', SPEED, '--output', out],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', maxBuffer: 1 << 26 });
  return out;
}

function main() {
  mkdirSync(VO, { recursive: true });
  mkdirSync(PADDED, { recursive: true });

  const durations = {};
  for (const line of LINES) {
    const wav = speak(line.id, line.text);
    durations[line.id] = dur(wav);
    console.log(`  ${line.id.padEnd(11)} ${durations[line.id].toFixed(1).padStart(6)}s${line.step ? '  (step)' : ''}`);
  }

  // Screen time per walkthrough step, derived once, used by everything.
  const holds = {};
  for (const id of STEP_ORDER) {
    holds[id] = Math.round(Math.max(FLOOR, durations[id] + PAD) * 100) / 100;
  }
  writeFileSync(join(ROOT, 'demo', 'holds.json'), `${JSON.stringify(holds, null, 1)}\n`, 'utf8');

  // The walkthrough audio: each line padded to its own hold, then joined.
  const parts = [];
  for (const id of STEP_ORDER) {
    const out = join(PADDED, `${id}.wav`);
    ff(['-i', join(VO, `${id}.wav`), '-af',
        `aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo,apad`,
        '-t', String(holds[id]), out]);
    parts.push(out);
  }
  const list = join(PADDED, 'walk.txt');
  writeFileSync(list, parts.map((p) => `file '${p.split('\\').join('/')}'`).join('\n'), 'utf8');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', join(VO, 'walk.wav')]);

  const total = Object.values(holds).reduce((a, b) => a + b, 0);
  const walk = dur(join(VO, 'walk.wav'));
  console.log(`\nwalkthrough: ${STEP_ORDER.length} steps, holds ${total.toFixed(2)}s, walk.wav ${walk.toFixed(2)}s`);
  if (Math.abs(total - walk) > 0.1) {
    throw new Error(`holds and audio disagree by ${(total - walk).toFixed(2)}s`);
  }
  console.log('holds and audio agree — the film cannot drift from the voice.');
}

main();
