/**
 * Cut the demo from the captured walkthrough and the beat sheet.
 *
 *   node demo/edit.mjs
 *
 * Every shot is derived from `demo/beats.json` rather than from timecodes
 * typed in by hand, so a re-record re-cuts itself. A shot names the beat it
 * starts on, the beat it ends on, and optionally the beat whose bounding box
 * it should punch in to — the capture script recorded all three.
 *
 * Punch-ins are static and the cuts are hard. An eased zoom is achievable with
 * time-varying `crop` expressions, but a documentary punch-in that lands on
 * the cut reads as a decision, and it cannot drift or overshoot; there is no
 * budget tonight for tuning easing curves against a 1080p re-encode.
 *
 * The dead time is the other half of the job. Composing a short genuinely
 * takes 40 seconds and generating takes 20 more, so a third of the raw
 * recording is a spinner. Those stretches are cut to a beat and a half with a
 * caption saying what is happening, which is honest and watchable; pretending
 * it is instant would not be.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DEMO = join(ROOT, 'demo');
const WORK = join(DEMO, 'work');
const OUT = join(DEMO, 'out');

const W = 1920;
const H = 1080;
const FPS = 30;
const FONT = 'C\\:/Windows/Fonts/segoeui.ttf';
const FONT_BOLD = 'C\\:/Windows/Fonts/segoeuib.ttf';

const ff = (args, label) => {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 1 << 26,
    });
  } catch (error) {
    console.error(`\nffmpeg failed on ${label}`);
    console.error(String(error.stderr ?? error.message).slice(0, 1600));
    throw error;
  }
};

/**
 * The cut.
 *
 * `from`/`to` are beat ids. `at` names the beat whose box the shot punches in
 * to; omit it for a wide shot. `hold` caps a shot's length, which is how the
 * three long waits become beats rather than dead air.
 */
const SHOTS = [
  { from: 'start', to: 'received', caption: 'Scripture is text in a thousand languages.' },
  { from: 'received', at: 'received', to: 'written', caption: 'The verse is retrieved from YouVersion.' },
  { from: 'written', at: 'written', to: 'topic', caption: 'The teaching is written by Gloo.' },
  { from: 'topic', to: 'lens', caption: 'Type a verse, or a topic.' },
  { from: 'lens', at: 'lens', to: 'find', caption: 'Six teaching lenses.' },
  { from: 'find', at: 'find', to: 'resolving', caption: 'Retrieved, never generated.' },
  { from: 'resolving', to: 'passages', hold: 1.6, caption: 'Asking YouVersion…' },
  { from: 'passages', to: 'pick-passage', caption: 'Candidates, verbatim from the API.' },
  { from: 'pick-passage', to: 'generating', caption: '' },
  { from: 'generating', to: 'devices', hold: 1.6, caption: 'Gloo writes the teaching…' },
  { from: 'devices', to: 'pick-device', hold: 4.5, caption: 'Openings, each anchored to the passage.' },
  { from: 'composing', to: 'preview', hold: 1.8, caption: 'Narrating, and measuring every word…' },
  { from: 'restyle-0', at: 'restyle-0', to: 'restyle-1', caption: 'Palettes, faces, sizes, backgrounds.' },
  { from: 'restyle-1', at: 'restyle-1', to: 'restyle-2', caption: '' },
  { from: 'restyle-2', to: 'preview-restyled', caption: 'The verse and the voice never change.' },
  { from: 'possibilities', to: 'developers', caption: 'One pipeline, pointed at different things.' },
  { from: 'developers', to: 'mcp', caption: 'All of it, headless.' },
  { from: 'mcp', at: 'mcp', to: 'skills', caption: 'A stateless MCP server.' },
  { from: 'skills', at: 'skills', to: 'stack', caption: 'Agent skills, packed from the repo.' },
  { from: 'stack', to: 'end', caption: 'Built on HyperFrames.' },
];

/** A 16:9 crop that contains `box` with breathing room, clamped to the frame. */
function punch(box, pad = 1.15) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Never punch past 1.7x. Tighter than that and a 1080p source turns to
  // mush, and the controls either side of the target get sliced in half.
  let w = Math.max(box.w * (1 + pad), (box.h * (1 + pad) * W) / H, W / 1.7);
  let h = (w * H) / W;
  if (h > H) { h = H; w = W; }
  if (w > W) { w = W; h = H; }
  let x = Math.round(cx - w / 2);
  let y = Math.round(cy - h / 2);
  x = Math.max(0, Math.min(x, W - Math.round(w)));
  y = Math.max(0, Math.min(y, H - Math.round(h)));
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return { w: even(w), h: even(h), x: even(x), y: even(y) };
}

/** ffmpeg drawtext is a minefield of separators; escape what it cares about. */
const esc = (s) =>
  String(s)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "’")
    .replace(/%/g, '\\%');

/** A caption bar across the lower third. */
function captionFilter(text) {
  if (!text) return '';
  return (
    `,drawbox=x=0:y=${H - 150}:w=${W}:h=150:color=black@0.55:t=fill` +
    `,drawtext=fontfile='${FONT}':text='${esc(text)}':fontcolor=white:fontsize=44` +
    `:x=110:y=${H - 105}:shadowcolor=black@0.6:shadowx=2:shadowy=2`
  );
}

function main() {
  const meta = JSON.parse(readFileSync(join(DEMO, 'beats.json'), 'utf8'));
  const byId = new Map(meta.beats.map((b) => [b.id, b]));
  const source = process.argv[2] ?? findSource();

  rmSync(WORK, { recursive: true, force: true });
  mkdirSync(WORK, { recursive: true });
  mkdirSync(OUT, { recursive: true });

  const parts = [];
  let n = 0;

  for (const shot of SHOTS) {
    const a = byId.get(shot.from);
    const b = byId.get(shot.to);
    if (!a || !b) {
      console.warn(`  skip ${shot.from} -> ${shot.to} (beat missing)`);
      continue;
    }
    let start = a.t;
    let end = b.t;
    if (shot.hold) end = Math.min(end, start + shot.hold);
    const dur = Math.max(0.6, end - start);

    const target = shot.at ? byId.get(shot.at) : null;
    const box = target?.box;
    const crop = box ? punch(box) : null;

    const vf =
      (crop ? `crop=${crop.w}:${crop.h}:${crop.x}:${crop.y},scale=${W}:${H}:flags=lanczos` : `scale=${W}:${H}`) +
      `,fps=${FPS},format=yuv420p` +
      captionFilter(shot.caption);

    const file = join(WORK, `s${String(n).padStart(2, '0')}.mp4`);
    ff(
      ['-ss', String(start), '-t', String(dur), '-i', source, '-an',
       '-vf', vf, '-c:v', 'libx264', '-crf', '19', '-preset', 'medium', file],
      `${shot.from} -> ${shot.to}`,
    );
    parts.push(file);
    console.log(
      `  ${String(n).padStart(2)} ${shot.from} -> ${shot.to}  ${dur.toFixed(1)}s` +
        (crop ? `  punch ${crop.w}x${crop.h}` : '  wide') +
        (shot.caption ? `  "${shot.caption.slice(0, 40)}"` : ''),
    );
    n += 1;
  }

  const list = join(WORK, 'concat.txt');
  writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/')}'`).join('\n'), 'utf8');
  const walkthrough = join(OUT, 'walkthrough.mp4');
  ff(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', walkthrough], 'concat');

  const secs = Number(
    execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
      '-of', 'csv=p=0', walkthrough], { encoding: 'utf8' }).trim(),
  );
  console.log(`\nwalkthrough: ${secs.toFixed(1)}s -> ${walkthrough}`);
}

function findSource() {
  const mp4 = join(DEMO, 'raw', 'walkthrough.mp4');
  if (existsSync(mp4)) return mp4;
  const dir = join(DEMO, 'raw');
  const webm = readdirSync(dir).find((f) => f.endsWith('.webm'));
  if (!webm) throw new Error('no capture found in demo/raw');
  return join(dir, webm);
}

main();
