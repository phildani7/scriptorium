/**
 * The language wall: six shorts playing at once, the audio walking through
 * them one at a time.
 *
 *   node demo/wall.mjs
 *
 * Six narrations mixed together is a wall of noise that proves "many" while
 * proving nothing about any one of them. So all six play continuously —
 * that is the parallelism, and it is the point — but only one is audible at a
 * time, brought up for a couple of seconds while the rest duck to silence. You
 * see the breadth and you hear each language actually working.
 *
 * Every clip here is a real rendered short with its real narration: Piper for
 * Hindi, Arabic and Spanish, Speechmatics for English. Nothing is re-voiced
 * for the demo.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'demo', 'out');
const WORK = join(ROOT, 'demo', 'work');

const W = 1920;
const H = 1080;
const FPS = 60;
const FONT = 'C\\:/Windows/Fonts/segoeui.ttf';

/** Tile size: six 9:16 tiles across a 1920 frame, with gutters. */
const TILE_W = 296;
const TILE_H = 526;
const GAP = 16;
const TOTAL_W = 6 * TILE_W + 5 * GAP;
const X0 = Math.round((W - TOTAL_W) / 2);
const Y0 = Math.round((H - TILE_H) / 2) - 30;

/** Each clip gets the floor to itself for this long. */
const SLOT = 2.6;
const RAMP = 0.3;

/**
 * Ordered so the scripts alternate visually and the voices alternate in
 * character: Devanagari, Arabic, Latin, Devanagari, Latin, Latin.
 */
const CLIPS = [
  { src: 'public/gallery/short-MRK.12.41-44-warm-minimal-ms6mbf9z.mp4', at: 10, label: 'हिन्दी  Hindi' },
  { src: 'public/gallery/short-MRK.10.13-16-warm-minimal-ms30byj8.mp4', at: 12, label: 'العربية  Arabic' },
  { src: 'renders/es-philippians4-illustration.mp4', at: 14, label: 'Español  Spanish' },
  { src: 'public/gallery/hi-psalm23-piper-ci.mp4', at: 6, label: 'हिन्दी  Hindi' },
  { src: 'public/gallery/short-PSA.46.1-neon-night-ms1zi0ug.mp4', at: 2, label: 'English' },
  { src: 'public/gallery/en-james1-hook-kinetic.mp4', at: 4, label: 'English' },
];

const DUR = CLIPS.length * SLOT;

const esc = (s) =>
  String(s).replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '’').replace(/%/g, '\\%');

function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(WORK, { recursive: true });

  const missing = CLIPS.filter((c) => !existsSync(join(ROOT, c.src)));
  if (missing.length) {
    throw new Error(`missing clips:\n  ${missing.map((m) => m.src).join('\n  ')}`);
  }

  const inputs = [];
  for (const c of CLIPS) {
    inputs.push('-ss', String(c.at), '-t', String(DUR), '-i', join(ROOT, c.src));
  }

  const filters = [];

  // Video: scale each to a tile, then lay them over a paper-coloured canvas.
  CLIPS.forEach((_, i) => {
    filters.push(
      `[${i}:v]scale=${TILE_W}:${TILE_H}:force_original_aspect_ratio=increase,` +
        `crop=${TILE_W}:${TILE_H},fps=${FPS},setsar=1[v${i}]`,
    );
  });
  filters.push(`color=c=0xf6f1e7:s=${W}x${H}:d=${DUR}:r=${FPS}[bg]`);

  let last = 'bg';
  CLIPS.forEach((_, i) => {
    const x = X0 + i * (TILE_W + GAP);
    const out = i === CLIPS.length - 1 ? 'grid' : `o${i}`;
    filters.push(`[${last}][v${i}]overlay=${x}:${Y0}:shortest=0[${out}]`);
    last = out;
  });

  // The label of whichever clip currently has the audio, under the wall.
  let labelled = 'grid';
  CLIPS.forEach((c, i) => {
    const a = i * SLOT;
    const b = a + SLOT;
    const next = i === CLIPS.length - 1 ? 'titled' : `l${i}`;
    filters.push(
      `[${labelled}]drawtext=fontfile='${FONT}':text='${esc(c.label)}'` +
        `:fontcolor=0x221e19:fontsize=52:x=(w-text_w)/2:y=${Y0 + TILE_H + 46}` +
        `:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[${next}]`,
    );
    labelled = next;
  });

  filters.push(
    `[titled]drawtext=fontfile='${FONT}':text='${esc('40 languages. 33 with a neural voice and word timing measured from the audio.')}'` +
      `:fontcolor=0x6b6157:fontsize=40:x=(w-text_w)/2:y=94[vout]`,
  );

  // Audio: each stream is silent except in its own slot, with short ramps so
  // the handover does not click. `eval=frame` is required — without it the
  // expression is evaluated once at init and every clip stays at its t=0 value.
  CLIPS.forEach((_, i) => {
    const a = i * SLOT;
    const b = a + SLOT;
    filters.push(
      `[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
        `volume='clip(min((t-${a.toFixed(2)})/${RAMP},(${b.toFixed(2)}-t)/${RAMP}),0,1)':eval=frame[a${i}]`,
    );
  });
  filters.push(
    `${CLIPS.map((_, i) => `[a${i}]`).join('')}amix=inputs=${CLIPS.length}:normalize=0:duration=first[aout]`,
  );

  const out = join(OUT, 'wall.mp4');
  const args = [
    '-hide_banner', '-v', 'error', '-y',
    ...inputs,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]', '-map', '[aout]',
    '-t', String(DUR),
    '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k',
    out,
  ];

  try {
    execFileSync('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 });
  } catch (error) {
    console.error(String(error.stderr ?? error.message).slice(0, 2500));
    throw error;
  }

  console.log(`wall: ${CLIPS.length} shorts, ${DUR.toFixed(1)}s -> ${out}`);
  for (const [i, c] of CLIPS.entries()) {
    console.log(`  ${(i * SLOT).toFixed(1)}-${((i + 1) * SLOT).toFixed(1)}s  ${c.label}`);
  }
}

main();
