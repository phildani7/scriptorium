/**
 * Assemble the finished demo.
 *
 *   node demo/assemble.mjs
 *
 * Narration drives the timing. Each segment is held for as long as its Kokoro
 * line takes to say, so a rewritten sentence re-times the film instead of
 * needing every downstream offset nudged by hand.
 *
 * Order: opening card, the walkthrough, a real exported short at full size,
 * the integrity gate, the language wall, the closing card. A music bed runs
 * under all of it and ducks wherever a short is speaking.
 *
 * The "finished short" beat is a RENDERED MP4 rather than the studio's preview
 * iframe. The preview holds every element at `autoAlpha: 0` until its timeline
 * runs, so a screenshot of it at rest is an empty rectangle — and more to the
 * point, the exported file is what a creator actually publishes. Showing the
 * real output at full size is both better looking and the more honest claim.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DEMO = join(ROOT, 'demo');
const OUT = join(DEMO, 'out');
const WORK = join(DEMO, 'work');
const CARDS = join(DEMO, 'cards');

const W = 1920;
const H = 1080;
const FPS = 30;
const VO = join(DEMO, 'vo');

/** Length of a narration line, or 0 when it has not been generated. */
function voDur(id) {
  const f = join(VO, `${id}.wav`);
  return existsSync(f) ? dur(f) : 0;
}

/**
 * Lay a narration line over a clip, ducking whatever the clip already carries.
 *
 * The language wall is the case that matters: its own six narrations walk one
 * at a time, and talking over them at full level would turn the one genuinely
 * audible proof of multilingual narration into mud. So the wall's audio drops
 * while the line is spoken and comes back up underneath it.
 */
function narrate(clip, id, duckTo = 0.28) {
  const wav = join(VO, `${id}.wav`);
  if (!existsSync(wav)) return clip;
  const out = join(WORK, `vo-${id}.mp4`);
  const len = dur(clip);
  const spoken = dur(wav);
  ff(
    ['-i', clip, '-i', wav,
     '-filter_complex',
     `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
       `volume='if(lt(t,${(spoken + 0.4).toFixed(2)}),${duckTo},1)':eval=frame[base];` +
       `[1:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
       `adelay=400|400,volume=1.35[v];` +
       `[base][v]amix=inputs=2:normalize=0:duration=first[a]`,
     '-map', '0:v', '-map', '[a]', '-t', String(len),
     '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out],
    `narrate ${id}`,
  );
  return out;
}

const run = (bin, args, label) => {
  try {
    return execFileSync(bin, args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 27, encoding: 'utf8' });
  } catch (error) {
    console.error(`\n${bin} failed on ${label}`);
    console.error(String(error.stderr ?? error.message).slice(0, 2000));
    throw error;
  }
};
const ff = (args, label) => run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], label);
const dur = (f) =>
  Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], f).trim());

/** A still card as a clip, with a gentle fade at each end and silent audio. */
function card(name, seconds) {
  const png = join(CARDS, `${name}.png`);
  const out = join(WORK, `card-${name}.mp4`);
  ff(
    ['-loop', '1', '-t', String(seconds), '-i', png,
     '-f', 'lavfi', '-t', String(seconds), '-i', 'anullsrc=r=48000:cl=stereo',
     '-vf', `scale=${W}:${H},fps=${FPS},format=yuv420p,fade=in:st=0:d=0.5,fade=out:st=${(seconds - 0.6).toFixed(2)}:d=0.6`,
     '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
     '-c:a', 'aac', '-b:a', '192k', '-shortest', out],
    `card ${name}`,
  );
  return out;
}

/**
 * One real exported short, centred on the studio's paper with its own
 * narration. A 9:16 file on a 16:9 canvas, so it is shown whole rather than
 * cropped — the framing IS the product.
 */
function showcase(src, seconds, from = 0) {
  const out = join(WORK, 'showcase.mp4');
  const tileH = 940;
  const tileW = Math.round((tileH * 9) / 16 / 2) * 2;
  ff(
    ['-ss', String(from), '-t', String(seconds), '-i', src,
     '-f', 'lavfi', '-i', `color=c=0xf6f1e7:s=${W}x${H}:r=${FPS}`,
     '-filter_complex',
     `[0:v]scale=${tileW}:${tileH},fps=${FPS},setsar=1[s];` +
       `[1:v][s]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v];` +
       `[0:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a]`,
     '-map', '[v]', '-map', '[a]', '-t', String(seconds),
     '-c:v', 'libx264', '-crf', '19', '-preset', 'medium',
     '-c:a', 'aac', '-b:a', '192k', out],
    'showcase',
  );
  return out;
}

/** Give a silent clip an audio track, so concat has a uniform stream layout. */
function withSilence(src) {
  const out = join(WORK, `sil-${src.split(/[\\/]/).pop()}`);
  ff(
    ['-i', src, '-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo',
     '-map', '0:v', '-map', '1:a', '-shortest',
     '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out],
    'silence pad',
  );
  return out;
}

function main() {
  mkdirSync(WORK, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const walkthrough = join(OUT, 'walkthrough.mp4');
  const wall = join(OUT, 'wall.mp4');
  if (!existsSync(walkthrough)) throw new Error('run demo/edit.mjs first');
  if (!existsSync(wall)) throw new Error('run demo/wall.mjs first');

  // A real export, narrated. Prefer a kinetic one — the motion reads at a
  // glance, which is what this beat is for.
  const pick = ['renders/final-en.mp4', 'renders/en-james1-hook-kinetic.mp4', 'public/gallery/en-james1-hook-kinetic.mp4']
    .map((p) => join(ROOT, p))
    .find(existsSync);
  if (!pick) throw new Error('no rendered short to showcase');

  // Every hold is its narration line plus a beat of air at each end.
  const pad = 1.6;
  const parts = [
    narrate(card('open', voDur('open') + pad), 'open'),
    narrate(withSilence(walkthrough), 'walk'),
    narrate(showcase(pick, Math.max(8, voDur('result') + pad), 3), 'result'),
    narrate(card('gate', voDur('gate') + pad), 'gate'),
    narrate(wall, 'wall'),
    narrate(card('close', voDur('close') + pad), 'close'),
  ];

  const list = join(WORK, 'final.txt');
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');

  const silent = join(WORK, 'joined.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-crf', '19',
      '-preset', 'medium', '-c:a', 'aac', '-b:a', '192k', silent], 'concat');

  const total = dur(silent);

  // Music bed under everything. The beds in public/music are ALREADY
  // attenuated and faded at import time, so a nominal 0.16 gain on top of that
  // measured -55 dB over the title card: present in the file, inaudible to a
  // viewer. 0.55 puts the bed around -35 dB under speech at -21 dB, which
  // reads as underscoring rather than as competition.
  const bed = join(ROOT, 'public', 'music', 'deeper-still.mp3');
  const out = join(OUT, 'scriptorium-demo.mp4');

  if (existsSync(bed)) {
    ff(
      ['-i', silent, '-stream_loop', '-1', '-i', bed,
       '-filter_complex',
       `[1:a]volume=0.55,afade=in:st=0:d=1.5,afade=out:st=${(total - 3).toFixed(2)}:d=3[m];` +
         `[0:a][m]amix=inputs=2:normalize=0:duration=first[a]`,
       '-map', '0:v', '-map', '[a]', '-t', String(total),
       '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out],
      'music bed',
    );
  } else {
    ff(['-i', silent, '-c', 'copy', out], 'copy');
  }

  const final = dur(out);
  const mins = Math.floor(final / 60);
  console.log(`\nscriptorium-demo.mp4  ${mins}:${String(Math.round(final % 60)).padStart(2, '0')}  (${final.toFixed(1)}s)`);
  console.log(`  ${out}`);
  for (const p of parts) console.log(`    ${dur(p).toFixed(1).padStart(6)}s  ${p.split(/[\\/]/).pop()}`);
}

main();
