/**
 * Record the studio walkthrough, and write down where every beat landed.
 *
 *   npx tsx demo/capture.ts                       (localhost:3000)
 *   npx tsx demo/capture.ts --base http://localhost:3111
 *
 * Produces `demo/raw/<n>.webm` plus `demo/beats.json`.
 *
 * The beat sheet is the point. Zoom, spotlight and highlight only look
 * deliberate when they land on the right pixel at the right moment, and a
 * hand-recorded capture has to be scrubbed afterwards to GUESS both — every
 * retake invalidating the last set of guesses. A scripted walkthrough already
 * knows: it chose the selector, so it has the bounding box; it issued the
 * click, so it has the timestamp. So it writes them down, and the composition
 * reads them.
 *
 * Playwright records the page viewport only — no URL bar, no tabs — so
 * recording against localhost is pixel-identical to recording against the
 * deployment, and very much faster.
 */

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright-core';

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');

/** Per-section dwell times, derived from the narration (see demo/holds.json). */
const HOLDS: Record<string, number> = JSON.parse(
  readFileSync(new URL('./holds.json', import.meta.url), 'utf8'),
);
const dwell = (id: string, fallback = 4) => Math.round((HOLDS[id] ?? fallback) * 1000);

const ROOT = process.cwd();
const OUT = join(ROOT, 'demo', 'raw');

const WIDTH = 2560;
const HEIGHT = 1440;
/**
 * The page is magnified with CSS `zoom` rather than by recording a small
 * viewport and letting Playwright scale it up.
 *
 * Measured the hard way: `deviceScaleFactor` does NOT scale the video capture.
 * A 1280x720 viewport asked to record at 1920x1080 rendered the page 1:1 into
 * the top-left corner and padded the rest of the frame grey — the bottom pixel
 * came back (128,128,128). `zoom` instead re-lays-out the document at 1.5x, so
 * the type is rendered at native resolution and the 1024px column fills four
 * fifths of a full-size frame.
 */
const ZOOM = 2;
const VIDEO = { width: WIDTH, height: HEIGHT };

export interface Beat {
  /** Seconds from the start of the recording. */
  t: number;
  /** `move` and `click` carry a cursor position; `mark` frames a region. */
  kind: 'mark' | 'click' | 'type' | 'wait' | 'scroll';
  /** Short name the composition uses to find this beat. */
  id: string;
  /** Region of interest in page pixels, when there is one. */
  box?: { x: number; y: number; w: number; h: number };
  /** Caption-worthy note about what is happening. */
  note?: string;
}

/**
 * A drawn cursor, because there is no real one. Playwright's mouse moves
 * instantly and is not captured in the video at all, so without this the
 * footage shows things happening with nothing causing them. A CSS transition
 * between scripted positions also reads better than a real hand: it
 * accelerates and settles instead of hunting for the target.
 *
 * Built lazily, on first use, rather than at document-start.
 *
 * `addInitScript` runs before `document.documentElement` necessarily exists,
 * so appending there threw and left `window.__cursor` undefined for the rest
 * of the run. Creating on demand also survives the client-side navigations
 * this walkthrough makes, which would otherwise drop the nodes.
 */
const ZOOM_SCRIPT = `
  (function () {
    var hide = document.createElement('style');
    hide.textContent = 'nextjs-portal,[data-nextjs-toast],#__next-build-watcher{display:none !important}';
    var addHide = function () { (document.head || document.documentElement).appendChild(hide); };
    if (document.head) addHide(); else document.addEventListener('DOMContentLoaded', addHide);
    window.__demoZoom = Number('__ZOOM__');
    var apply = function () {
      if (document.documentElement) document.documentElement.style.zoom = '__ZOOM__';
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', apply);
    } else {
      apply();
    }
  })();
`;

const CURSOR_SCRIPT = `
  window.__cursor = (function () {
    var el = null;
    var ring = null;

    function ensure() {
      var root = document.body || document.documentElement;
      if (!root) return false;
      if (!el || !el.isConnected) {
        el = document.createElement('div');
        el.id = '__demo-cursor';
        el.innerHTML =
          '<svg width="40" height="40" viewBox="0 0 24 24">' +
          '<path d="M5 2.5 19.5 11 13 12.6 10.2 19z" fill="#fff" stroke="#1b1b1b" stroke-width="1.4" stroke-linejoin="round"/>' +
          '</svg>';
        el.style.cssText = [
          'position:fixed', 'left:0', 'top:0', 'z-index:2147483647',
          'pointer-events:none', 'will-change:transform',
          'filter:drop-shadow(0 3px 6px rgba(0,0,0,.35))',
          'transition:transform 620ms cubic-bezier(.22,.61,.36,1)',
          'transform:translate3d(960px,540px,0)',
        ].join(';');
        root.appendChild(el);
      }
      if (!ring || !ring.isConnected) {
        ring = document.createElement('div');
        ring.id = '__demo-ring';
        ring.style.cssText = [
          'position:fixed', 'left:0', 'top:0', 'width:56px', 'height:56px',
          'margin:-28px 0 0 -28px', 'border-radius:50%',
          'border:4px solid #b4552e', 'opacity:0', 'z-index:2147483646',
          'pointer-events:none', 'will-change:transform,opacity',
        ].join(';');
        root.appendChild(ring);
      }
      return true;
    }

    return {
      // Coordinates arrive in VISUAL pixels; these nodes live inside the
      // zoomed root and are scaled by it again, so undo that here.
      to: function (x, y) {
        if (!ensure()) return;
        var z = window.__demoZoom || 1;
        el.style.transform = 'translate3d(' + x / z + 'px,' + y / z + 'px,0)';
      },
      tap: function (x, y) {
        if (!ensure()) return;
        var z = window.__demoZoom || 1;
        var px = x / z, py = y / z;
        ring.style.transition = 'none';
        ring.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) scale(.4)';
        ring.style.opacity = '1';
        // Next frame, so the reset above is not batched with the animation.
        requestAnimationFrame(function () {
          ring.style.transition = 'transform 520ms ease-out, opacity 520ms ease-out';
          ring.style.transform = 'translate3d(' + px + 'px,' + py + 'px,0) scale(1.6)';
          ring.style.opacity = '0';
        });
      },
    };
  })();
`;

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ args: ['--hide-scrollbars'] });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    recordVideo: { dir: OUT, size: VIDEO },
    // The studio's own reduced-motion handling would flatten the very
    // animations this is here to film.
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(ZOOM_SCRIPT.replaceAll('__ZOOM__', String(ZOOM)));
  await context.addInitScript(CURSOR_SCRIPT);

  const page = await context.newPage();
  page.on('pageerror', (e) => console.error(`  page error: ${e.message}`));

  const beats: Beat[] = [];
  let t0 = 0;
  const now = () => (Date.now() - t0) / 1000;

  const beat = (kind: Beat['kind'], id: string, box?: Beat['box'], note?: string) => {
    const entry: Beat = { t: Number(now().toFixed(3)), kind, id, box, note };
    beats.push(entry);
    console.log(
      `  ${entry.t.toFixed(2).padStart(7)}s  ${kind.padEnd(6)} ${id}` +
        (box ? `  [${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.w)}x${Math.round(box.h)}]` : ''),
    );
    return entry;
  };

  /** Pause on the recording clock, not the test clock. */
  const hold = (ms: number) => page.waitForTimeout(ms);

  /** Move the drawn cursor to the centre of a locator and let it settle. */
  async function moveTo(locator: ReturnType<Page['locator']>) {
    await locator.scrollIntoViewIfNeeded();
    await hold(220);
    const box = await locator.boundingBox();
    if (!box) throw new Error('no bounding box');
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.evaluate(([px, py]) => window.__cursor.to(px, py), [x, y]);
    await hold(700);
    return { box, x, y };
  }

  async function click(
    locator: ReturnType<Page['locator']>,
    id: string,
    note?: string,
  ) {
    const { box, x, y } = await moveTo(locator);
    await page.evaluate(([px, py]) => window.__cursor.tap(px, py), [x, y]);
    beat('click', id, { x: box.x, y: box.y, w: box.width, h: box.height }, note);
    await hold(160);
    await locator.click();
    return box;
  }

  /** Frame a region for the composition to zoom or spotlight, without clicking. */
  async function mark(selector: string, id: string, note?: string) {
    const el = page.locator(selector).first();
    await el.scrollIntoViewIfNeeded();
    await hold(260);
    const box = await el.boundingBox();
    beat('mark', id, box ? { x: box.x, y: box.y, w: box.width, h: box.height } : undefined, note);
    return box;
  }

  // ---- open ---------------------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  // Chrome reports getBoundingClientRect in VISUAL pixels under `zoom`, so the
  // boxes below are already video coordinates. Printed rather than assumed:
  // unzoomed the h1 sits at x=152, zoomed it should be near 228.
  const probe = await page.locator('h1').first().boundingBox();
  console.log(`  h1 at x=${Math.round(probe?.x ?? -1)} (152 = pre-zoom, ~228 = post-zoom)`);
  t0 = Date.now();
  beat('mark', 'start', undefined, 'Scripture shorts, in your own language');
  await hold(1400);

  await mark('h1', 'hero', 'Scriptorium');
  await hold(900);
  // Anchored on each panel's own heading. `section:has-text("Written")`
  // matched the RECEIVED panel, whose prose says "never written by a model" —
  // :has-text is a case-insensitive substring match over all descendants.
  await mark('section:has(p:text-is("YouVersion"))', 'received', 'The verse: retrieved from YouVersion');
  await hold(dwell('received'));
  await mark('section:has(p:text-is("Gloo AI Studio"))', 'written', 'The teaching: written by Gloo');
  await hold(dwell('written'));

  // ---- the ask ------------------------------------------------------------
  const input = page.getByPlaceholder('John 3:16');
  await moveTo(input);
  await input.click();
  beat('type', 'topic', undefined, 'A topic, not just a reference');
  for (const ch of 'anxiety at work') {
    await input.type(ch, { delay: 0 });
    await hold(55);
  }
  await hold(900);

  await click(page.getByRole('button', { name: 'Analogy', exact: true }), 'lens', 'Six teaching lenses');
  await hold(900);

  await click(page.getByRole('button', { name: /Find the passage/ }), 'find', 'Retrieve, never generate');
  beat('wait', 'resolving', undefined, 'Asking YouVersion');

  // ---- the passage --------------------------------------------------------
  await page.getByRole('heading', { name: 'Which passage?' }).waitFor({ timeout: 120_000 });
  await hold(700);
  await mark('h2:has-text("Which passage?")', 'passages', 'Candidates, verbatim from the API');
  await hold(1800);

  const firstPassage = page.locator('section:has(h2:has-text("Which passage?")) button').first();
  await click(firstPassage, 'pick-passage', 'Pick one');
  beat('wait', 'generating', undefined, 'Gloo writes the teaching');

  // ---- the openings -------------------------------------------------------
  await page.getByRole('heading', { name: 'Choose an opening' }).waitFor({ timeout: 180_000 });
  await hold(700);
  await mark('h2:has-text("Choose an opening")', 'devices', 'Several openings, each anchored to the passage');
  await hold(2200);

  const firstDevice = page.locator('section:has(h2:has-text("Choose an opening")) button').first();
  await click(firstDevice, 'pick-device', 'Choose one');
  beat('wait', 'composing', undefined, 'Narrating, and measuring every word');

  // ---- the short ----------------------------------------------------------
  await page.getByRole('heading', { name: 'Make it yours' }).waitFor({ timeout: 300_000 });
  await hold(1200);
  await mark('iframe', 'preview', 'The real frame, seekable');
  await hold(600);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  if (await play.isVisible().catch(() => false)) {
    await click(play, 'play', 'Press play');
    beat('mark', 'playing', undefined, 'Narrated, word-synced, real motion');
    // Long enough to see the opening land, a page turn, and the verse.
    await hold(14000);
  }

  // ---- every option, one at a time ---------------------------------------
  // The first pass clicked three arbitrary controls and moved on. A creator
  // deciding whether this tool is worth their Saturday needs to SEE the
  // surface: what can be changed, and what stays fixed no matter what.
  const themeSection = page.locator('section:has(h2:has-text("Make it yours"))');

  /** A theme group by its label, plus the nth control inside it. */
  async function option(label: string, nth: number, id: string, note: string) {
    const group = themeSection.locator(`div:has(> div:text-is("${label}"))`).last();
    await group.scrollIntoViewIfNeeded();
    await hold(300);
    const box = await group.boundingBox();
    beat('mark', `group-${id}`, box ? { x: box.x, y: box.y, w: box.width, h: box.height } : undefined, note);
    await hold(900);
    const target = group.locator('button').nth(nth);
    if (await target.isVisible().catch(() => false)) {
      await click(target, `pick-${id}`);
    }
    // Dwell for the rest of this step's screen time, so the footage lasts as
    // long as the film will hold on it.
    await hold(Math.max(1200, dwell(id) - 1900));
  }

  await mark('section:has(h2:has-text("Make it yours"))', 'theme', 'Everything you can change');
  await hold(900);

  await option('Style', 1, 'style', 'Three frozen motion styles');
  await option('Colors', 3, 'colors', 'Eight palettes');
  await option('Font', 1, 'font', 'Four type pairs');
  await option('Text size', 2, 'size', 'Three sizes');
  await option('Captions', 0, 'captions', 'Captions on or off');
  await option('Text motion', 2, 'motion', 'Eight ways the text enters');
  await option('Music', 2, 'music', 'Nine licensed beds');
  await option('Background', 12, 'background', 'Sixty-nine backgrounds');

  await mark('iframe', 'preview-restyled', 'The verse and the voice never change');
  await hold(2600);

  // The narration stays editable to the last word -- except the verse.
  const narration = page.locator('h3:has-text("Narration")');
  if (await narration.isVisible().catch(() => false)) {
    await mark('div:has(> h3:has-text("Narration"))', 'narration', 'Every authored word is yours to edit');
    await hold(dwell('narration'));
  }

  // ---- for developers -----------------------------------------------------
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await hold(600);
  await mark('section:has-text("What you can make with it")', 'possibilities', 'One pipeline, pointed at different things');
  await hold(3400);
  await mark('section:has-text("For developers")', 'developers', 'All of it, headless');
  await hold(1600);
  await mark('code:has-text("/api/mcp")', 'mcp', 'A stateless MCP server');
  await hold(dwell('mcp'));
  await mark('a:has-text("Download .zip")', 'skills', 'Agent skills, packed from the repo');
  await hold(dwell('skills'));
  await mark('h3:has-text("Built on")', 'stack', 'Built on HyperFrames');
  await hold(3400);

  beat('mark', 'end');
  await hold(700);

  // ---- close --------------------------------------------------------------
  await page.close();
  await context.close();
  await browser.close();

  const duration = beats[beats.length - 1].t;
  writeFileSync(
    join(ROOT, 'demo', 'beats.json'),
    `${JSON.stringify({ width: WIDTH, height: HEIGHT, duration, beats }, null, 2)}\n`,
    'utf8',
  );
  console.log(`\n${beats.length} beats over ${duration.toFixed(1)}s -> demo/beats.json`);
  console.log(`video in ${OUT}`);
}

declare global {
  interface Window {
    __cursor: { to(x: number, y: number): void; tap(x: number, y: number): void };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
