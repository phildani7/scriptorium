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
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DEMO = join(ROOT, 'demo');
const OUT = join(DEMO, 'out');
const WORK = join(DEMO, 'work');
const CARDS = join(DEMO, 'cards');

const W = 1920;
const H = 1080;
const FPS = 60;
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
 * "And this is what comes out": three finished shorts at once — Hindi,
 * Arabic, English — with the audio walking through them one at a time.
 *
 * All three keep playing for the whole segment; that is the parallelism.
 * The narrator introduces them, then each short gets the floor alone, oldest
 * scripts first. No labels are drawn over the frames: every short already
 * carries its own reference chip, and ffmpeg's drawtext cannot shape
 * Devanagari conjuncts correctly, so the honest label is the one the short
 * renders for itself. An accent bar under the active tile does the pointing.
 */
function trio(clips, voWav) {
  const out = join(WORK, 'trio.mp4');
  const tileH = 880;
  const tileW = Math.round((tileH * 9) / 16 / 2) * 2;
  const gap = 28;
  const totalW = clips.length * tileW + (clips.length - 1) * gap;
  const x0 = Math.round((W - totalW) / 2);
  const y0 = Math.round((H - tileH) / 2);

  const intro = dur(voWav) + 0.5;
  const slot = 5.4;
  const ramp = 0.35;
  const total = intro + clips.length * slot + 0.6;

  const inputs = [];
  for (const c of clips) inputs.push('-ss', String(c.at), '-t', String(total), '-i', c.src);
  inputs.push('-i', voWav);
  const vo = clips.length;

  const f = [];
  clips.forEach((_, i) => {
    f.push(`[${i}:v]scale=${tileW}:${tileH}:force_original_aspect_ratio=increase,` +
      `crop=${tileW}:${tileH},fps=${FPS},setsar=1[v${i}]`);
  });
  f.push(`color=c=0xf6f1e7:s=${W}x${H}:d=${total.toFixed(2)}:r=${FPS}[bg]`);
  let last = 'bg';
  clips.forEach((_, i) => {
    const next = `o${i}`;
    f.push(`[${last}][v${i}]overlay=${x0 + i * (tileW + gap)}:${y0}:shortest=0[${next}]`);
    last = next;
  });
  // The accent bar under whichever tile currently has the floor.
  clips.forEach((_, i) => {
    const a = intro + i * slot;
    const b = a + slot;
    const next = i === clips.length - 1 ? 'vout' : `b${i}`;
    f.push(`[${last}]drawbox=x=${x0 + i * (tileW + gap)}:y=${y0 + tileH + 14}:` +
      `w=${tileW}:h=10:color=0xb4552e:t=fill:enable='between(t,${a.toFixed(2)},${b.toFixed(2)})'[${next}]`);
    last = next;
  });

  clips.forEach((_, i) => {
    const a = intro + i * slot;
    const b = a + slot;
    f.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,` +
      `volume='clip(min((t-${a.toFixed(2)})/${ramp},(${b.toFixed(2)}-t)/${ramp}),0,1)':eval=frame[a${i}]`);
  });
  f.push(`[${vo}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,adelay=400|400,volume=1.3[an]`);
  f.push(`${clips.map((_, i) => `[a${i}]`).join('')}[an]amix=inputs=${clips.length + 1}:normalize=0:duration=first[aout]`);

  ff([...inputs, '-filter_complex', f.join(';'),
      '-map', '[vout]', '-map', '[aout]', '-t', String(total),
      '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', out], 'trio');
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

/**
 * The gallery, scrolled top to bottom, under the languages line. Cut from the
 * CFR-normalized capture at the beat the scroll started; the six-tile wall it
 * replaces demonstrated parallel audio, but the trio now carries that, and
 * the author asked for the shelf itself.
 */
function galleryScroll() {
  const beats = JSON.parse(readFileSync(join(DEMO, 'beats.json'), 'utf8'));
  const at = beats.beats.find((b) => b.id === 'gallery-scroll')?.t;
  if (at === undefined) throw new Error('no gallery-scroll beat in beats.json');
  const cfr = join(DEMO, 'comp', 'capture-cfr.mp4');
  const out = join(WORK, 'gallery.mp4');
  const seconds = dur(join(VO, 'wall.wav')) + 1.2;
  ff(['-ss', String(at + 0.3), '-t', String(seconds), '-i', cfr,
      '-vf', `scale=${W}:${H}:flags=lanczos,fps=${FPS},format=yuv420p`,
      '-an', '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', out],
    'gallery scroll');
  return withSilence(out);
}

function main() {
  mkdirSync(WORK, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const walkthrough = join(OUT, 'walkthrough.mp4');
  const wall = join(OUT, 'wall.mp4');
  if (!existsSync(walkthrough)) throw new Error('run demo/edit.mjs first');
  if (!existsSync(wall)) throw new Error('run demo/wall.mjs first');

  // A breath of air on either side of each card's narration.
  const pad = 1.6;

  // Three real exports, heard in turn: Hindi, Arabic, English.
  const clips = [
    { src: join(ROOT, 'public/gallery/short-MRK.12.41-44-warm-minimal-ms6mbf9z.mp4'), at: 7 },
    { src: join(ROOT, 'public/gallery/short-MRK.10.13-16-warm-minimal-ms30byj8.mp4'), at: 7 },
    { src: join(ROOT, 'demo/media/job121.mp4'), at: 7 },
  ];
  for (const c of clips) if (!existsSync(c.src)) throw new Error(`missing ${c.src}`);

  const parts = [
    narrate(card('open', voDur('open') + pad), 'open'),
    narrate(withSilence(walkthrough), 'walk'),
    trio(clips, join(VO, 'result.wav')),
    narrate(card('gate', voDur('gate') + pad), 'gate'),
    narrate(galleryScroll(), 'wall'),
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
