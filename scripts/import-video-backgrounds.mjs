/**
 * Normalize a folder of source clips into loopable video backgrounds.
 *
 *   node scripts/import-video-backgrounds.mjs "<source folder>"
 *
 * Writes `public/backgrounds/video/<id>.mp4` plus a `<id>.jpg` poster, and
 * prints the BACKGROUNDS entries to paste into `lib/theme/options.ts`.
 *
 * Three things happen to every clip, and each is load-bearing:
 *
 * 1. THE AUDIO IS STRIPPED. These play behind narration. A stray audio track
 *    would either fight the voice or, in the offline renderer, make Chrome
 *    wait on a decode nobody listens to.
 *
 * 2. THE LOOP IS MADE SEAMLESS. The sources are five seconds and a short runs
 *    forty to sixty, so each one plays ten times or more and any discontinuity
 *    becomes a visible tick on a schedule. The last 0.8s is cross-faded over
 *    the first 0.8s, which makes the final frame and the first frame the same
 *    picture — the loop closes on itself instead of cutting. A palindrome
 *    (forward then reversed) would also be seamless, but it doubles the file
 *    and makes anything with direction — falling leaves, drifting smoke —
 *    visibly run backwards half the time.
 *
 * 3. THE POSTER IS THE FRAME AT THE LOOP POINT. Not frame 0: frame 0 is inside
 *    the cross-fade, where two moments of the clip are blended and the picture
 *    is muddier than the clip ever looks in motion. The poster is what the
 *    creator picks from, so it has to be the clip at its most typical.
 *
 * Source resolution is kept rather than upscaled. These are 720x1280 and the
 * frame is 1080x1920; upscaling at import would add ~2x the bytes and no
 * detail, and the renderer scales them anyway behind a palette-tinted scrim.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const ROOT = process.cwd();
const OUT_VIDEO = join(ROOT, 'public', 'backgrounds', 'video');

/** Cross-fade length, seconds. Long enough to hide the seam, short enough
    not to eat a noticeable slice of a five-second clip. */
const FADE = 0.8;
/** Constant Rate Factor. 28 is visually clean behind a scrim at this size. */
const CRF = 28;

/**
 * Names for the clips, in sorted-filename order. The sources arrive with
 * opaque generator hashes, and a creator picking a background should never
 * see one — so the mapping lives here, next to the import that applies it.
 */
const NAMES = [
  'sparks', 'mossy-forest', 'blossom-path', 'raindrops',
  'ice-cave', 'dunes', 'crystals', 'bamboo',
  'ink-water', 'rainy-window', 'aurora', 'smoke',
  'underwater', 'flower-field', 'snowy-pines', 'bubbles',
  'calm-sea', 'above-clouds', 'gold-kaleidoscope', 'rising-bubbles',
  'crystal-tunnel', 'starburst', 'sand-layers', 'forest-rays',
  'falling-leaves', 'light-spiral', 'dewdrops', 'neon-portal',
  'feathers', 'autumn-path', 'blossom-tunnel', 'cloud-vortex',
];

const LABELS = {
  'sparks': 'Sparks', 'mossy-forest': 'Mossy forest', 'blossom-path': 'Blossom path',
  'raindrops': 'Raindrops', 'ice-cave': 'Ice cave', 'dunes': 'Dunes',
  'crystals': 'Crystals', 'bamboo': 'Bamboo', 'ink-water': 'Ink in water',
  'rainy-window': 'Rainy window', 'aurora': 'Aurora', 'smoke': 'Smoke',
  'underwater': 'Underwater', 'flower-field': 'Flower field', 'snowy-pines': 'Snowy pines',
  'bubbles': 'Bubbles', 'calm-sea': 'Calm sea', 'above-clouds': 'Above the clouds',
  'gold-kaleidoscope': 'Gold kaleidoscope', 'rising-bubbles': 'Rising bubbles',
  'crystal-tunnel': 'Crystal tunnel', 'starburst': 'Starburst', 'sand-layers': 'Sand layers',
  'forest-rays': 'Forest rays', 'falling-leaves': 'Falling leaves', 'light-spiral': 'Light spiral',
  'dewdrops': 'Dewdrops', 'neon-portal': 'Neon portal', 'feathers': 'Feathers',
  'autumn-path': 'Autumn path', 'blossom-tunnel': 'Blossom tunnel', 'cloud-vortex': 'Cloud vortex',
};

function ffprobeDuration(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file,
  ]).toString().trim();
  return Number(out);
}

function run(args) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
}

function main() {
  const sourceDir = process.argv[2];
  if (!sourceDir) {
    console.error('Usage: node scripts/import-video-backgrounds.mjs "<source folder>"');
    process.exit(1);
  }

  mkdirSync(OUT_VIDEO, { recursive: true });

  const sources = readdirSync(resolve(sourceDir))
    .filter((f) => extname(f).toLowerCase() === '.mp4')
    .sort();

  if (sources.length !== NAMES.length) {
    console.error(
      `Found ${sources.length} clips but ${NAMES.length} names. The name list is ` +
        'positional — update NAMES to match the folder before importing.',
    );
    process.exit(1);
  }

  const entries = [];
  let bytes = 0;

  sources.forEach((file, index) => {
    const id = NAMES[index];
    const input = join(resolve(sourceDir), file);
    const output = join(OUT_VIDEO, `${id}.mp4`);
    const poster = join(OUT_VIDEO, `${id}.jpg`);

    const duration = ffprobeDuration(input);
    const main = duration - FADE;

    run([
      '-i', input,
      '-filter_complex',
      `[0:v]split[a][b];` +
        `[a]trim=0:${main},setpts=PTS-STARTPTS[main];` +
        `[b]trim=${main}:${duration},setpts=PTS-STARTPTS,format=yuva420p,` +
        `fade=t=out:st=0:d=${FADE}:alpha=1[tail];` +
        `[main][tail]overlay=format=auto,fps=24,format=yuv420p[v]`,
      '-map', '[v]',
      '-an',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(CRF),
      '-movflags', '+faststart',
      output,
    ]);

    // The frame just before the loop point: past the cross-fade, so it is the
    // clip as it actually looks rather than two moments blended together.
    run([
      '-ss', String(Math.max(0, main - 0.1)), '-i', output,
      '-frames:v', '1', '-vf', 'scale=360:-1', '-q:v', '4', poster,
    ]);

    const size = statSync(output).size;
    bytes += size + statSync(poster).size;
    console.log(`${id.padEnd(20)} ${(size / 1024 / 1024).toFixed(2)} MB`);

    entries.push(
      `  { id: 'video-${id}', label: '${LABELS[id]}', kind: 'video', ` +
        `src: '/backgrounds/video/${id}.mp4', thumb: '/backgrounds/video/${id}.jpg' },`,
    );
  });

  console.log(`\n${sources.length} clips, ${(bytes / 1024 / 1024).toFixed(1)} MB total\n`);
  console.log('Paste into BACKGROUNDS in src/lib/theme/options.ts:\n');
  console.log(entries.join('\n'));
}

main();
