/**
 * Visual + structural smoke test for the six-page format.
 *
 *   npm run smoke:pages
 *
 * Bakes a real spec through every template, opens it in the same browser the
 * renderer uses, and at each page boundary asserts the thing the format
 * actually promises: exactly one sentence is visible. Then it writes frames to
 * `.smoke/` so the layout can be looked at rather than assumed.
 *
 * "Exactly one" is measured from the DOM — computed opacity and visibility of
 * every page element — because that is the property that breaks, and it breaks
 * silently: a crossfade that overlaps by 200 ms looks fine in a still and
 * wrong in motion.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

import { bakeComposition } from '@/lib/render/bake';
import { buildNarrationScript } from '@/lib/script/build';
import { alignScriptToAudio } from '@/lib/voice/align';
import { DOODLE_BY_ID, doodleVisual } from '@/lib/visuals/doodles';
import type { DeviceItem, Passage, ShortSpec, StyleId } from '@/lib/types';

const ROOT = process.cwd();
const OUT = join(ROOT, '.smoke');
/**
 * Frames are wiped each run, but a Grok sample costs money to make, so it
 * survives. Kept in the same folder to stay under one gitignore entry.
 */
const OUT_KEEP = OUT;
/** Served from public/ so root-relative asset paths resolve over file://. */
const STAGE = join(ROOT, 'public', '__smoke');

const PASSAGE: Passage = {
  reference: 'Luke 15:20',
  usfm: 'LUK.15.20',
  text:
    'So he got up and went to his father. But while he was still in the distance, ' +
    'his father saw him and was filled with compassion. He ran to his son, embraced him, and kissed him.',
  versionId: 3034,
  versionAbbreviation: 'BSB',
  versionName: 'Berean Standard Bible',
  attribution: 'Berean Standard Bible',
  languageCode: 'en',
};

const DEVICE: DeviceItem = {
  type: 'hook',
  content: 'The father saw him a long way off, which means he was watching.',
  point: 'The welcome was decided before the apology was heard.',
  explanation:
    'You have rehearsed the apology more times than you can count. ' +
    'This passage says the father was already watching the road. ' +
    'Nobody watches a road they have given up on. ' +
    'The son never got to finish his speech about wages. ' +
    'The welcome outran the apology, and it still does.',
  visualTerms: ['road', 'father', 'run', 'welcome'],
  imagePrompt: 'A father running down a golden road toward his returning son.',
  reference: 'Luke 15:20',
  emoji: '🏃',
};

const HINDI_DEVICE: DeviceItem = {
  ...DEVICE,
  content: 'पिता ने उसे दूर से ही देख लिया, इसका अर्थ है कि वह देख रहा था।',
  explanation:
    'तुमने वह माफ़ी अनगिनत बार दोहराई है। ' +
    'यह पद कहता है कि पिता पहले से ही रास्ता देख रहा था। ' +
    'कोई उस रास्ते को नहीं देखता जिस पर आशा छोड़ दी हो। ' +
    'बेटा अपनी पूरी बात कह भी नहीं पाया। ' +
    'स्वागत ने माफ़ी को पीछे छोड़ दिया, और आज भी छोड़ता है।',
};

interface Case {
  name: string;
  style: StyleId;
  device: DeviceItem;
  languageCode: string;
  script: string;
  doodle?: string;
  /** A generated image instead of a shipped panel: { src, band, paper }. */
  art?: { src: string; band: number; paper: string };
  theme?: Record<string, string>;
}

const CASES: Case[] = [
  { name: 'warm-doodle', style: 'warm-minimal', device: DEVICE, languageCode: 'en', script: 'latin', doodle: 'prodigal-4' },
  // psalm22 is full-bleed (2% natural band): proves the manufactured band.
  { name: 'warm-fullbleed', style: 'warm-minimal', device: DEVICE, languageCode: 'en', script: 'latin', doodle: 'psalm22-0' },
  { name: 'warm-plain', style: 'warm-minimal', device: DEVICE, languageCode: 'en', script: 'latin', theme: { backgroundId: 'grain' } },
  { name: 'kinetic-doodle', style: 'kinetic-type', device: DEVICE, languageCode: 'en', script: 'latin', doodle: 'prodigal-0', theme: { paletteId: 'midnight', fontId: 'archivo' } },
  { name: 'neon-doodle', style: 'neon-night', device: DEVICE, languageCode: 'en', script: 'latin', doodle: 'prodigal-5', theme: { paletteId: 'plum-neon', fontId: 'grotesk' } },
  // The hardest layout in the project: five Devanagari sentences inside a band.
  { name: 'warm-hindi-doodle', style: 'warm-minimal', device: HINDI_DEVICE, languageCode: 'hi', script: 'devanagari', doodle: 'prodigal-3' },
];

/**
 * If `npm run smoke:grok` has left a generated image behind, run it through
 * the same checks. The generation path and the reuse path share every line of
 * template code, but they do NOT share a paper colour — a generated frame
 * takes the fixed default in lib/visuals/grok, and a mismatch there shows up
 * as a seam where the band scrim ends. That is only visible in a frame.
 */
const GROK_SAMPLE = join(OUT_KEEP, 'grok-sample.jpg');
if (existsSync(GROK_SAMPLE)) {
  CASES.push({
    name: 'warm-grok',
    style: 'warm-minimal',
    device: DEVICE,
    languageCode: 'en',
    script: 'latin',
    art: { src: '/__smoke/grok-sample.jpg', band: 26, paper: '#faeed2' },
  });
}

function buildSpec(c: Case): ShortSpec & Record<string, unknown> {
  const { script, segments } = buildNarrationScript({
    device: c.device,
    passage: { ...PASSAGE, languageCode: c.languageCode },
  });
  const words = script.trim().split(/\s+/).length;
  const durationSec = Math.max(15, Math.min(45, words / 2.6));
  const { timings } = alignScriptToAudio(script, [], durationSec);

  const panel = c.doodle ? DOODLE_BY_ID[c.doodle] : undefined;
  if (c.doodle && !panel) throw new Error(`unknown panel ${c.doodle}`);

  const art = panel
    ? doodleVisual(panel, 0)
    : c.art
      ? {
          kind: 'ai-image' as const,
          src: c.art.src,
          term: 'ai',
          timeSec: 0,
          slot: 0,
          band: c.art.band,
          paper: c.art.paper,
        }
      : undefined;

  return {
    id: `smoke-${c.name}`,
    passage: { ...PASSAGE, languageCode: c.languageCode },
    device: c.device,
    style: c.style,
    theme: c.theme ?? {},
    languageCode: c.languageCode,
    voice: { engine: 'browser', model: c.languageCode, label: 'smoke' },
    narration: { script, audioUrl: '', durationSec, timings, timingSource: 'estimated', segments },
    music: null,
    visuals: art ? { mode: 'ai', items: [art] } : undefined,
    durationSec,
    verified: true,
    script: c.script,
    dir: 'ltr',
  } as ShortSpec & Record<string, unknown>;
}

async function main() {
  rmSync(STAGE, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  mkdirSync(STAGE, { recursive: true });

  // Clear last run's frames, but keep the Grok sample: it cost a generation.
  for (const name of await import('node:fs').then((fs) => fs.readdirSync(OUT))) {
    if (name.endsWith('.png')) rmSync(join(OUT, name), { force: true });
  }
  if (existsSync(GROK_SAMPLE)) {
    copyFileSync(GROK_SAMPLE, join(STAGE, 'grok-sample.jpg'));
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  let failures = 0;

  try {
    for (const c of CASES) {
      const spec = buildSpec(c);
      const template = readFileSync(
        join(ROOT, 'templates', c.style, 'index.html'),
        'utf8',
      );
      // '../' resolves /fonts, /vendor, /doodles against public/ from public/__smoke/.
      const html = bakeComposition({ template, spec, assetPrefix: '../', audioSrc: '' });
      const file = join(STAGE, `${c.name}.html`);
      writeFileSync(file, html, 'utf8');

      await page.goto(`file://${file.replace(/\\/g, '/')}`, { waitUntil: 'load' });

      const teaching = spec.narration.segments.filter((s) => s.kind === 'teaching');
      const verse = spec.narration.segments.find((s) => s.kind === 'verse');
      if (teaching.length !== 5) {
        console.error(`  ✗ ${c.name}: expected 5 teaching pages, got ${teaching.length}`);
        failures += 1;
      }

      // Sample the MIDDLE of every page (safely clear of both boundaries) and
      // both sides of every boundary, which is where an overlap would live.
      const marks: Array<{ label: string; t: number }> = [];
      teaching.forEach((seg, i) => {
        const start = spec.narration.timings[seg.wordStart].start;
        const end = spec.narration.timings[seg.wordEnd - 1].end;
        marks.push({ label: `page${i + 1}`, t: (start + end) / 2 });
        marks.push({ label: `page${i + 1}-edge`, t: Math.max(0, end - 0.02) });
      });
      if (verse) {
        const vs = spec.narration.timings[verse.wordStart].start;
        const ve = spec.narration.timings[verse.wordEnd - 1].end;
        marks.push({ label: 'verse', t: (vs + ve) / 2 });
      }

      console.log(`\n${c.name} (${c.style}${c.doodle ? `, ${c.doodle}` : ''})`);

      for (const mark of marks) {
        const visible = await page.evaluate((t) => {
          const tl = (window as never as { __timelines: Record<string, { time: (n: number) => void }> })
            .__timelines['scripture-short'];
          tl.time(t);
          const nodes = Array.from(document.querySelectorAll('.tchunk, .tpage'));
          return nodes
            .map((el, i) => {
              const s = getComputedStyle(el);
              return {
                i,
                opacity: Number(s.opacity),
                hidden: s.visibility === 'hidden' || s.display === 'none',
                text: (el.textContent ?? '').slice(0, 42),
              };
            })
            .filter((n) => !n.hidden && n.opacity > 0.02);
        }, mark.t);

        const ok = visible.length <= 1;
        if (!ok) {
          failures += 1;
          console.error(
            `  ✗ ${mark.label} @${mark.t.toFixed(2)}s: ${visible.length} sentences visible ` +
              `— ${visible.map((v) => `[${v.i}] ${v.opacity.toFixed(2)} "${v.text}…"`).join(' | ')}`,
          );
        } else if (!mark.label.endsWith('-edge')) {
          console.log(`  ✓ ${mark.label} @${mark.t.toFixed(2)}s: ${visible.length} visible`);
        }

        if (!mark.label.endsWith('-edge')) {
          await page.screenshot({ path: join(OUT, `${c.name}-${mark.label}.png`) });
        }
      }
    }
  } finally {
    await browser.close();
    // The staged copies live under public/; clearing them keeps them out of
    // the deployed bundle and out of git.
    rmSync(STAGE, { recursive: true, force: true });
  }

  console.log(
    failures === 0
      ? `\nAll pages exclusive. Frames in ${OUT}`
      : `\n${failures} failure(s). Frames in ${OUT}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
