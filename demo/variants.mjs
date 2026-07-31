/**
 * Render both narration variants end to end, so the choice can be made by ear.
 *
 *   node demo/variants.mjs
 *
 * Eleven of the fifteen lines are identical between the two, so only the four
 * that differ are re-synthesized; the rest are reused. The result is two
 * continuous WAVs that can be listened to back to back.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { LINES as TRIMMED } from './lines.mjs';

const ROOT = process.cwd();
const VO = join(ROOT, 'demo', 'vo');
const FULL = join(ROOT, 'demo', 'vo-full');
const OUT = join(ROOT, 'demo', 'out');

/** The four passages as they read BEFORE trimming. */
const ORIGINAL = {
  ask:
    'You start by saying what the short is about. A reference, or a topic, or ' +
    'a situation. Then you choose a lens. There are six of them, and each ' +
    'one approaches the passage differently. A hook opens with a question. An ' +
    'analogy reaches for a picture from ordinary life. A punch line compresses ' +
    'the tension into one sentence.',
  teach:
    'Choose one, and Gloo writes the teaching around it. An opening line, then ' +
    'five sentences, one to a page, so nothing ever overlaps on screen. ' +
    'Speechmatics narrates the script and measures the timing of every word, ' +
    'which is what lets the captions ride the voice instead of guessing at it.',
  background:
    'And sixty-nine backgrounds. Eight generated in CSS, ten hand-drawn ' +
    'frames, seventeen photographs, and thirty-four animated loops, each one ' +
    'cross-faded so it repeats without a visible cut. You pick them by ' +
    'looking, not by reading a list of names.',
  headless:
    'All of it works without the screen. One stateless M C P server exposes ' +
    'the pipeline as eight tools, so an agent or a cron job can drive it. ' +
    'And because a tool list does not tell an agent which lens suits a ' +
    'passage, there is a skill pack to download alongside it.',
};

const VOICE = 'af_heart';
const SPEED = '1.0';

const dur = (f) =>
  Number(execFileSync('ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f],
    { encoding: 'utf8' }).trim());

function speak(text, out) {
  if (existsSync(out)) return out;
  const txt = `${out}.txt`;
  writeFileSync(txt, text, 'utf8');
  execFileSync('npx',
    ['--yes', 'hyperframes@latest', 'tts', '--text-file', txt,
     '--voice', VOICE, '--speed', SPEED, '--output', out],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32', maxBuffer: 1 << 26 });
  return out;
}

function stitch(files, out) {
  const list = `${out}.txt`;
  writeFileSync(list, files.map((f) => `file '${f.split('\\').join('/')}'`).join('\n'), 'utf8');
  execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', out]);
  return out;
}

function main() {
  mkdirSync(FULL, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const trimmedFiles = [];
  const fullFiles = [];

  for (const line of TRIMMED) {
    const trimmed = join(VO, `${line.id}.wav`);
    trimmedFiles.push(trimmed);

    if (ORIGINAL[line.id]) {
      fullFiles.push(speak(ORIGINAL[line.id], join(FULL, `${line.id}.wav`)));
    } else {
      fullFiles.push(trimmed);
    }
  }

  const a = stitch(trimmedFiles, join(OUT, 'narration-trimmed.wav'));
  const b = stitch(fullFiles, join(OUT, 'narration-full.wav'));

  const ta = dur(a);
  const tb = dur(b);
  const fmt = (n) => `${Math.floor(n / 60)}:${String(Math.round(n % 60)).padStart(2, '0')}`;

  console.log(`trimmed  ${fmt(ta)}  (${ta.toFixed(1)}s)  ${a}`);
  console.log(`full     ${fmt(tb)}  (${tb.toFixed(1)}s)  ${b}`);
  console.log(`\ndifference: ${(tb - ta).toFixed(1)}s across four lines`);
  for (const id of Object.keys(ORIGINAL)) {
    const t = dur(join(VO, `${id}.wav`));
    const f = dur(join(FULL, `${id}.wav`));
    console.log(`  ${id.padEnd(11)} trimmed ${t.toFixed(1)}s   full ${f.toFixed(1)}s   +${(f - t).toFixed(1)}s`);
  }
}

main();
