/**
 * Render the demo's authored cards to PNG.
 *
 *   npx tsx demo/cards.ts
 *
 * Built as HTML and screenshotted rather than drawn with ffmpeg's `drawtext`,
 * because these three frames are the only ones a viewer reads as *the
 * project's own voice* rather than as a recording of software. They use the
 * studio's palette and its self-hosted faces, so the demo looks like the thing
 * it is demonstrating.
 *
 * The gate card quotes `demo/gate.txt`, which is the real captured output of
 * `npm run prove:gate` — a tampered verse being refused. Retyping it here by
 * hand would make it a mock-up of a claim rather than evidence for one.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = process.cwd();
const OUT = join(ROOT, 'demo', 'cards');
const STAGE = join(ROOT, 'public', '__cards');

const SHELL = (body: string, extra = '') => `<!doctype html>
<html><head><meta charset="utf-8"/>
<link rel="stylesheet" href="/fonts/fonts.css"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden}
  body{
    background:#f6f1e7;color:#221e19;
    font-family:'Inter',system-ui,sans-serif;
    display:flex;align-items:center;justify-content:center;
  }
  .wrap{width:1560px}
  .display{font-family:'Fraunces',Georgia,serif}
  .label{font-family:'Space Grotesk',ui-monospace,monospace;
    font-size:19px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#6b6157}
  .accent{color:#b4552e}
  .soft{color:#6b6157}
  ${extra}
</style></head><body><div class="wrap">${body}</div></body></html>`;

const OPEN = SHELL(`
  <div class="label" style="margin-bottom:34px">Gloo &times; YouVersion &nbsp;&middot;&nbsp; Scripture in New Frontiers</div>
  <h1 class="display" style="font-size:150px;line-height:1.02;letter-spacing:-.02em">Scriptorium</h1>
  <p class="display" style="font-size:58px;line-height:1.25;margin-top:26px;color:#6b6157">
    Scripture shorts, in your own language.
  </p>
  <p style="font-size:34px;line-height:1.5;margin-top:52px;max-width:1180px;color:#6b6157">
    YouVersion serves Scripture as text in over a thousand languages.
    The world&rsquo;s dominant medium is vertical video &mdash; and in most of
    those languages there is essentially none of it.
  </p>
  <div style="margin-top:64px;display:flex;gap:14px;align-items:baseline">
    <span class="label" style="color:#b4552e">A submission by</span>
    <span style="font-size:30px;font-weight:600">Dr. Philemon Paul Daniel</span>
  </div>
`);

function gateCard(): string {
  const raw = readFileSync(join(ROOT, 'demo', 'gate.txt'), 'utf8');
  const keep = raw
    .split('\n')
    .filter((l) => l.trim() && !/^>/.test(l) && !/^$/.test(l))
    .slice(0, 18)
    .map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;'))
    .join('\n');

  return SHELL(
    `
    <div class="label" style="margin-bottom:24px;color:#b4552e">The architectural claim</div>
    <h2 class="display" style="font-size:82px;line-height:1.08;letter-spacing:-.015em;margin-bottom:20px">
      Scripture is retrieved, never generated &mdash;<br/>and the build proves it.
    </h2>
    <p style="font-size:30px;line-height:1.5;color:#6b6157;margin-bottom:34px;max-width:1400px">
      Before a frame is captured, the rendered verse is fetched from YouVersion
      again and diffed against that fresh response. A mismatch fails the build.
    </p>
    <pre class="term">${keep}</pre>
  `,
    `.term{
      background:#17140f;color:#e8e2d4;border-radius:16px;padding:30px 36px;
      font-family:ui-monospace,'Cascadia Mono',Consolas,monospace;
      font-size:21px;line-height:1.5;white-space:pre-wrap;
      box-shadow:0 24px 60px rgba(0,0,0,.22)}`,
  );
}

const CLOSE = SHELL(`
  <h2 class="display" style="font-size:96px;line-height:1.06;letter-spacing:-.02em">
    Forty languages.<br/>One pipeline.
  </h2>
  <p style="font-size:34px;line-height:1.55;margin-top:34px;color:#6b6157;max-width:1300px">
    Thirty-three with a neural voice and word timing measured from the audio.
    116 Bible versions. Every short verified against YouVersion before a single
    frame is captured.
  </p>
  <div style="margin-top:66px;display:grid;grid-template-columns:1fr 1fr;gap:28px 60px;font-size:28px">
    <div><span class="label" style="display:block;margin-bottom:8px">Live</span>
      <span class="accent">scriptorium-gamma-wheat.vercel.app</span></div>
    <div><span class="label" style="display:block;margin-bottom:8px">Source &amp; agent skills</span>
      <span class="accent">github.com/phildani7/scriptorium</span></div>
  </div>
  <p style="margin-top:64px;font-size:26px;color:#6b6157">
    Built on HyperFrames &middot; Gloo AI Studio &middot; YouVersion Platform API
    &middot; Speechmatics &middot; Piper
  </p>
  <p style="margin-top:20px;font-size:26px">
    <strong style="font-weight:600">Dr. Philemon Paul Daniel</strong>
    <span class="soft"> &mdash; Scripture in New Frontiers, Gloo &times; YouVersion</span>
  </p>
`);

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(STAGE, { recursive: true });

  const base = process.argv[2] ?? 'http://localhost:3111';
  const cards: Array<[string, string]> = [
    ['open', OPEN],
    ['gate', gateCard()],
    ['close', CLOSE],
  ];

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

  for (const [name, html] of cards) {
    // Staged under public/ so the composition's /fonts link resolves against
    // the origin, exactly as it does for the studio itself.
    writeFileSync(join(STAGE, `${name}.html`), html, 'utf8');
    await page.goto(`${base}/__cards/${name}.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`  ${name}.png`);
  }

  await browser.close();
  console.log(`\ncards in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
