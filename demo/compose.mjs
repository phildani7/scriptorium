/**
 * Build the walkthrough as a HyperFrames composition.
 *
 *   node demo/compose.mjs
 *   npx hyperframes render demo/comp --resolution landscape --video-frame-format png --fps 30
 *
 * The first cut punched between static crops with hard cuts, and it read as
 * patchy. Slow continuous pans, a spotlight that dims what you are not meant to
 * be looking at, numbered steps and tooltip cards are all trivial as CSS
 * transforms and divs, and all miserable as ffmpeg filter graphs — so the
 * walkthrough is authored here instead, in the same engine that renders the
 * shorts. The demo is made by the thing it demonstrates.
 *
 * The capture is 2560x1440 and the frame is 1920x1080, so there are 640 spare
 * pixels of width to pan across before anything is upscaled. That headroom is
 * the whole reason the source was re-recorded larger.
 */

import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DEMO = join(ROOT, 'demo');
const COMP = join(DEMO, 'comp');

const W = 1920;
const H = 1080;

/**
 * The walkthrough, as numbered steps.
 *
 * `at` names the beat whose box the camera settles on; `hold` is how long the
 * step lasts. `tip` is the tooltip card. Steps are numbered on screen because
 * "step through each option, number them" is a different request from "show
 * the product" — it asks the viewer to follow a procedure, so the film has to
 * count.
 */
/**
 * Titles and tooltips per step. Timing is deliberately absent: every hold
 * comes from demo/holds.json, which sync.mjs derived from the narration —
 * one line per step, so the voice and the screen are two renderings of the
 * same array and cannot disagree.
 *
 * `beat` names the capture mark the step anchors on; option steps were
 * marked AFTER their click so the box describes the settled screen, which is
 * what keeps the spotlight on the thing being talked about.
 */
const META = {
  hero:       { beat: 'hero',            title: 'Two partners',        spot: false,
    tip: 'The verse is received from YouVersion. The teaching is written by Gloo.' },
  received:   { beat: 'received',        title: 'Received — YouVersion', spot: true,
    tip: 'Fetched from the YouVersion Platform API and passed through untouched.' },
  written:    { beat: 'written',         title: 'Written — Gloo',      spot: true,
    tip: 'Five sentences around the verse, aligned to tradition and audience.' },
  topic:      { beat: 'topic',           title: 'Say what it is about', spot: false,
    tip: 'A reference, a word, or a situation — Psalm 23, or anxiety at work.' },
  lens:       { beat: 'lens',            title: 'Choose a lens',       spot: true,
    tip: 'Hook · Analogy · Punch line · Illustration · Object lesson · Summary' },
  audience:   { beat: 'audience',        title: 'Audience & visuals',  spot: true,
    tip: 'Kids · Youth · Adult — text only, or pictures, with AI images.' },
  series:     { beat: 'series',          title: 'Plan a series',       spot: true,
    tip: 'A theme becomes 3–14 days, each one click from a finished short.' },
  find:       { beat: 'find',            title: 'Retrieve the passage', spot: true,
    tip: 'Scriptorium asks YouVersion — never a model.' },
  passages:   { beat: 'passages',        title: 'Verbatim candidates', spot: false,
    tip: 'Exactly what the API returned, in the language you chose.' },
  devices:    { beat: 'devices',         title: 'Choose an opening',   spot: false,
    tip: 'Each teaching is anchored to a specific point in the passage.' },
  style:      { beat: 'group-style',     title: 'Style',               spot: true,
    tip: 'Warm Minimal · Kinetic Type · Neon Night' },
  colors:     { beat: 'group-colors',    title: 'Colors',              spot: true,
    tip: 'Eight palettes, each checked for legibility.' },
  font:       { beat: 'group-font',      title: 'Font',                spot: true,
    tip: 'Serif · Poster · Modern · Clean' },
  size:       { beat: 'group-size',      title: 'Text size',           spot: true,
    tip: 'Compact · Regular · Large' },
  captions:   { beat: 'group-captions',  title: 'Captions',            spot: true,
    tip: 'On or off — the verse and reference always render.' },
  motion:     { beat: 'group-motion',    title: 'Text motion',         spot: true,
    tip: 'Eight entrances; Signature keeps each style’s own move.' },
  music:      { beat: 'group-music',     title: 'Music',               spot: true,
    tip: 'Nine licensed beds — no attribution rides along with your post.' },
  background: { beat: 'group-background', title: 'Background',         spot: true,
    tip: '8 CSS textures · 10 hand-drawn frames · 17 photographs · 34 loops' },
  narration:  { beat: 'narration',       title: 'Edit the words',      spot: true,
    tip: 'Authored text is yours to change. The verse is locked.' },
  mcp:        { beat: 'mcp',             title: 'Headless — MCP',      spot: true,
    tip: 'Eight stateless tools over streamable HTTP.' },
  skills:     { beat: 'skills',          title: 'Agent skills',        spot: true,
    tip: 'A zip packed from the repo, so it cannot drift.' },
};

const HOLDS = JSON.parse(readFileSync(join(DEMO, 'holds.json'), 'utf8'));
const STEPS = Object.keys(HOLDS).map((id, i) => ({
  n: i + 1,
  id,
  at: META[id].beat,
  from: META[id].beat,
  hold: HOLDS[id],
  title: META[id].title,
  spot: META[id].spot,
  tip: META[id].tip,
}));

/** Where the camera sits for a step: a scale plus a translate, origin 0 0. */
function framing(box, srcW, srcH, pad = 1.5) {
  if (!box) return { s: W / srcW, x: 0, y: (H - (srcH * W) / srcW) / 2 };
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  // Never magnify past 1:1 of the source; below that it is a true crop.
  let cropW = Math.max(box.w * (1 + pad), (box.h * (1 + pad) * W) / H, W);
  cropW = Math.min(cropW, srcW);
  const s = W / cropW;
  let x = W / 2 - s * cx;
  let y = H / 2 - s * cy;
  // Keep the frame inside the source, so no empty edge is ever revealed.
  x = Math.min(0, Math.max(x, W - s * srcW));
  y = Math.min(0, Math.max(y, H - s * srcH));
  return { s, x, y, cx, cy, cropW };
}

function main() {
  const meta = JSON.parse(readFileSync(join(DEMO, 'beats.json'), 'utf8'));
  const srcW = meta.width;
  const srcH = meta.height;
  const byId = new Map(meta.beats.map((b) => [b.id, b]));

  mkdirSync(COMP, { recursive: true });

  // Re-encode the capture to h264. The producer extracts source frames, and a
  // seekable mp4 is a far kinder input than a VP8 webm with sparse keyframes.
  const raw = join(DEMO, 'raw', readdirSync(join(DEMO, 'raw')).find((f) => f.endsWith('.webm')));
  const clip = join(COMP, 'capture.mp4');

  cpSync(join(ROOT, 'public', 'fonts'), join(COMP, 'fonts'), { recursive: true });
  mkdirSync(join(COMP, 'vendor'), { recursive: true });
  cpSync(join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    join(COMP, 'vendor', 'gsap.min.js'));

  // Resolve each step, and build a condensed source alongside it.
  const shots = [];
  const spans = [];
  let t = 0;
  let condensed = 0;
  for (const step of STEPS) {
    const beat = byId.get(step.at);
    const src = byId.get(step.from);
    if (!beat || !src) {
      console.warn(`  skip step ${step.n} (${step.at}) — beat missing`);
      continue;
    }
    const span = step.hold;
    spans.push({ from: Math.max(0, src.t - 0.2), span });
    shots.push({
      ...step,
      t,
      videoAt: condensed,
      box: beat.box ?? null,
      frame: framing(beat.box, srcW, srcH),
    });
    t += step.hold;
    condensed += span;
  }
  const duration = t;

  const cfr = join(COMP, 'capture-cfr.mp4');
  execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-i', raw,
    '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'fast',
    '-g', '15', '-pix_fmt', 'yuv420p', '-vsync', 'cfr', '-r', '60', cfr]);
  console.log('normalized to CFR 60 for frame-accurate cuts');

  const pieces = spans.map((s, i) => {
    const out = join(COMP, `part-${i}.mp4`);
    execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y',
      '-ss', String(s.from), '-t', String(s.span), '-i', cfr,
      '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium',
      '-g', '15', '-pix_fmt', 'yuv420p', '-r', '60', out]);
    return out;
  });
  const listFile = join(COMP, 'parts.txt');
  writeFileSync(
    listFile,
    pieces.map((p) => `file '${p.split('\\').join('/')}'`).join('\n'),
    'utf8',
  );
  execFileSync('ffmpeg', ['-hide_banner', '-v', 'error', '-y',
    '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', clip]);
  for (const p of pieces) rmSync(p, { force: true });
  console.log(`condensed source: ${condensed.toFixed(1)}s of ${meta.duration.toFixed(0)}s`);

  const data = { srcW, srcH, duration, shots };
  writeFileSync(join(COMP, 'shots.json'), JSON.stringify(data, null, 2), 'utf8');
  writeFileSync(join(COMP, 'index.html'), html(data), 'utf8');

  console.log(`${shots.length} steps, ${duration.toFixed(1)}s -> demo/comp/index.html`);
  for (const s of shots) {
    console.log(`  ${String(s.n).padStart(2)}. ${s.t.toFixed(1).padStart(5)}s  ${s.title}` +
      `  x${(s.frame.s * srcW / W).toFixed(2)}${s.spot ? '  spotlight' : ''}`);
  }
  console.log('\nnpx hyperframes render demo/comp --resolution landscape --video-frame-format png --fps 30 --output demo/out/walkthrough.mp4');
}

function html(data) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>Scriptorium — walkthrough</title>
<link rel="stylesheet" href="fonts/fonts.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;background:#14110d;overflow:hidden}
  #short{position:relative;width:${W}px;height:${H}px;overflow:hidden;background:#14110d;
    font-family:'Inter',system-ui,sans-serif}

  /* The capture, panned as one continuous camera move. */
  #stage{position:absolute;inset:0;overflow:hidden}
  #film{position:absolute;left:0;top:0;transform-origin:0 0;will-change:transform}

  /* Spotlight: an enormous ring shadow darkens everything outside the box, so
     one element is lit and the rest of the page recedes without disappearing. */
  #spot{position:absolute;border-radius:20px;opacity:0;
    box-shadow:0 0 0 9999px rgba(16,13,9,.66);
    outline:2px solid rgba(255,255,255,.32);outline-offset:0}

  /* Step chip: the count, so the film reads as a procedure. */
  #chip{position:absolute;left:96px;top:84px;display:flex;align-items:center;gap:18px;opacity:0}
  #num{width:74px;height:74px;border-radius:50%;background:#b4552e;color:#fff;
    font-family:'Space Grotesk',monospace;font-weight:700;font-size:36px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 10px 30px rgba(0,0,0,.35)}
  #title{font-family:'Fraunces',Georgia,serif;font-size:52px;color:#fff;
    text-shadow:0 3px 18px rgba(0,0,0,.75)}

  /* Tooltip card: TOP-RIGHT, always. The pointer works the lower half of
     the screen, and a card that sits where the mouse is going reads as an
     obstruction; opposite corner from the step chip, so neither collides
     with the other or with the action. */
  #tip{position:absolute;right:96px;top:84px;max-width:860px;opacity:0;
    background:rgba(253,251,246,.97);border-radius:20px;padding:26px 32px;
    box-shadow:0 26px 70px rgba(0,0,0,.42)}
  #tip .k{font-family:'Space Grotesk',monospace;font-size:16px;font-weight:700;
    letter-spacing:.18em;text-transform:uppercase;color:#b4552e;display:block;margin-bottom:10px}
  #tip .b{font-size:34px;line-height:1.36;color:#221e19}
</style>
</head>
<body>
<div id="short" data-composition-id="demo-walkthrough"
     data-width="${W}" data-height="${H}"
     data-start="0" data-duration="${data.duration.toFixed(3)}">
  <div class="clip" data-start="0" data-duration="${data.duration.toFixed(3)}" data-track-index="0">
    <div id="stage">
      <video id="film" data-start="0" preload="auto" muted playsinline
             width="${data.srcW}" height="${data.srcH}" src="capture.mp4"></video>
    </div>
    <div id="spot"></div>
    <div id="chip"><div id="num">1</div><div id="title"></div></div>
    <div id="tip"><span class="k"></span><div class="b"></div></div>
  </div>
</div>

<script id="shots" type="application/json">
${JSON.stringify(data)}
</script>
<script src="vendor/gsap.min.js"></script>
<script>
(function () {
  'use strict';
  var data = JSON.parse(document.getElementById('shots').textContent);
  var film = document.getElementById('film');
  var spot = document.getElementById('spot');
  var chip = document.getElementById('chip');
  var num = document.getElementById('num');
  var title = document.getElementById('title');
  var tip = document.getElementById('tip');
  var tipK = tip.querySelector('.k');
  var tipB = tip.querySelector('.b');

  var tl = gsap.timeline({ paused: true });

  // The film is one continuous move: every step tweens FROM wherever the last
  // one left the camera, so there is never a cut inside the walkthrough. That
  // is the whole difference between this and the punch-and-cut version.
  var first = data.shots[0];
  gsap.set(film, { x: first.frame.x, y: first.frame.y, scale: first.frame.s });
  gsap.set(spot, { opacity: 0 });

  data.shots.forEach(function (s, i) {
    var at = s.t;

    // No seeking. The condensed source is cut so that each step's footage
    // begins at exactly the step's own start time, so the video plays straight
    // through in lockstep with the timeline -- which is what the framework
    // does with it anyway.

    if (i > 0) {
      // Slow, eased, and overlapping the hold so the frame is settled by the
      // time the tooltip is readable.
      tl.to(film, {
        x: s.frame.x, y: s.frame.y, scale: s.frame.s,
        duration: Math.min(3.4, s.hold * 0.75), ease: 'power2.inOut',
      }, at);
    }

    // Spotlight, in SCREEN space. The box was recorded in the capture's own
    // pixels, and the film sits under a scale-and-translate, so the same
    // transform has to be applied to the region or the light lands somewhere
    // the viewer is not looking.
    if (s.spot && s.box) {
      var pad = 14;
      var sx = s.frame.x + s.frame.s * s.box.x - pad;
      var sy = s.frame.y + s.frame.s * s.box.y - pad;
      var sw = s.frame.s * s.box.w + pad * 2;
      var sh = s.frame.s * s.box.h + pad * 2;
      tl.set(spot, {
        left: Math.round(sx), top: Math.round(sy),
        width: Math.round(sw), height: Math.round(sh),
      }, at);
      // Only once the camera has ARRIVED. The spotlight is positioned for this
      // step's final framing, so fading it in while the film is still panning
      // leaves the light hanging where the element is about to be rather than
      // where it currently is.
      var settle = i > 0 ? Math.min(1.0, s.hold * 0.28) : 0.2;
      tl.to(spot, { opacity: 1, duration: 0.45, ease: 'power2.out' }, at + settle);
      tl.to(spot, { opacity: 0, duration: 0.35, ease: 'power1.in' }, at + s.hold - 0.4);
    }

    // Chip and tooltip: in on the settle, out before the next step.
    tl.call(function () {
      num.textContent = String(s.n);
      title.textContent = s.title;
      tipK.textContent = 'Step ' + s.n;
      tipB.textContent = s.tip;
    }, null, at);
    tl.fromTo(chip, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, at + 0.15);
    tl.fromTo(tip, { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 0.55, ease: 'power2.out' }, at + (i > 0 ? Math.min(0.9, s.hold * 0.25) : 0.3));
    tl.to([chip, tip], { opacity: 0, duration: 0.35, ease: 'power1.in' }, at + s.hold - 0.45);
  });

  // Pin the timeline's length so the renderer captures the final hold.
  tl.to(spot, { opacity: 0, duration: 0.01 }, data.duration - 0.01);
  window.__timelines = window.__timelines || {};
  window.__timelines['demo-walkthrough'] = tl;
})();
</script>
</body>
</html>
`;
}

main();
