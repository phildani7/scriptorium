/**
 * Build the picker's background thumbnails.
 *
 *   npm run bg:thumbs
 *
 * The picker used to be seventy words. "Halftone dots", "Groovy liquid",
 * "Linen weave" — each one asks a creator to imagine the thing and then click
 * to find out they imagined it wrong. Seventy pictures asks them to point.
 *
 * Every thumbnail is produced from the asset the short will actually use, so
 * the picker cannot drift from the product:
 *
 *   texture  screenshotted from the REAL template, background layer and all,
 *            because these are CSS — there is no file to shrink, and a
 *            hand-drawn approximation of "soft grain" would be a lie that
 *            looks right. Particles are built by the composition script, so
 *            the timeline is seeked to a point where they exist.
 *   doodle   same path: the SVG is an alpha mask over palette ink, which only
 *            resolves inside the template.
 *   image    downscaled from the shipped 1080x1920 crop.
 *   video    already produced at import, as the frame past the cross-fade.
 *
 * Textures and doodles are shot on Parchment, the default palette, because
 * that is the version a creator gets before touching anything else. Both
 * groups recolor, so no single still can be faithful to every choice.
 *
 * These two groups are also the reason the picker keeps their names. They are
 * whisper-quiet by design — a five-percent linen weave, a doodle border at a
 * third opacity — and at tile size they render as near-identical rectangles
 * whatever ground they sit on. Shooting them on Midnight was tried first, on
 * the theory that light marks on dark would read better; it only replaced
 * eighteen pale rectangles with eighteen dark ones. A picture that cannot be
 * told from its neighbour is not information, so the tile carries the tint and
 * the label carries the meaning.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

import { bakeComposition } from '@/lib/render/bake';
import { BACKGROUNDS } from '@/lib/theme/options';

const ROOT = process.cwd();
const PUBLIC = join(ROOT, 'public');
const THUMBS = join(PUBLIC, 'backgrounds', 'thumbs');
/** Served from public/ so the composition's root-relative assets resolve. */
const STAGE = join(PUBLIC, '__thumbs');

/** Small enough to stay cheap at seventy, big enough to read on a retina panel. */
const WIDTH = 180;

/** Enough of a spec that the composition script runs and builds particles. */
const SPEC = {
  id: 'thumb',
  passage: {
    reference: 'Psalm 23:1', usfm: 'PSA.23.1', text: 'The LORD is my shepherd.',
    versionId: 3034, versionAbbreviation: 'BSB', versionName: 'BSB',
    attribution: 'BSB', languageCode: 'en',
  },
  device: { type: 'summary', content: '', point: '', reference: 'Psalm 23:1', emoji: '' },
  style: 'warm-minimal',
  languageCode: 'en',
  voice: { engine: 'browser', model: 'en', label: 'thumb' },
  narration: {
    script: 'The LORD is my shepherd.', audioUrl: '', durationSec: 20,
    timings: [], timingSource: 'estimated', segments: [],
  },
  music: null,
  durationSec: 20,
  verified: true,
  script: 'latin',
  dir: 'ltr',
};

function shrink(from: string, to: string) {
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-i', from,
    '-vf', `scale=${WIDTH}:-1`, '-q:v', '4', to,
  ]);
}

async function main() {
  mkdirSync(THUMBS, { recursive: true });
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(STAGE, { recursive: true });

  const template = readFileSync(
    join(ROOT, 'templates', 'warm-minimal', 'index.html'),
    'utf8',
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let rendered = 0;
  let copied = 0;
  const missing: string[] = [];

  try {
    for (const bg of BACKGROUNDS) {
      if (!bg.thumb) continue;
      const target = join(PUBLIC, bg.thumb.replace(/^\//, ''));

      // Video posters are made at import, from a frame past the cross-fade.
      if (bg.kind === 'video') {
        if (!existsSync(target)) missing.push(`${bg.id} (poster ${bg.thumb})`);
        continue;
      }

      // Shipped images only need shrinking.
      if (bg.kind === 'photo' && bg.src) {
        const source = join(PUBLIC, bg.src.replace(/^\//, ''));
        if (!existsSync(source)) {
          missing.push(`${bg.id} (source ${bg.src})`);
          continue;
        }
        shrink(source, target);
        copied += 1;
        continue;
      }

      // Everything else only exists inside the template.
      const html = bakeComposition({
        template,
        spec: { ...SPEC, theme: { backgroundId: bg.id, paletteId: 'parchment' } },
        assetPrefix: '../',
        audioSrc: '',
      });
      const staged = join(STAGE, `${bg.id}.html`);
      writeFileSync(staged, html, 'utf8');

      await page.goto(`file://${staged.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
      // Particles drift in over the clip; a thumbnail taken at t=0 would show
      // an empty frame and call it "Particles".
      await page.evaluate(() => {
        const tl = (window as never as {
          __timelines?: Record<string, { time: (n: number) => void }>;
        }).__timelines?.['scripture-short'];
        tl?.time(9);
      });

      const full = join(STAGE, `${bg.id}.png`);
      await page.locator('#short').screenshot({ path: full });
      shrink(full, target);
      rendered += 1;
    }
  } finally {
    await browser.close();
    rmSync(STAGE, { recursive: true, force: true });
  }

  console.log(`${rendered} rendered, ${copied} downscaled, ${BACKGROUNDS.length} backgrounds total`);
  if (missing.length) {
    console.log(`\nmissing (${missing.length}):\n  ${missing.join('\n  ')}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
