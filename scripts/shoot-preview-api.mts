/**
 * Photograph what /api/preview actually returns, served from the app.
 *
 *   npx tsx scripts/shoot-preview-api.mts http://localhost:3000 te
 *
 * The template harness (`npm run shots`) bakes locally against a file:// bundle.
 * This goes through the ROUTE the studio's iframe calls and loads the result
 * from the origin, so the fonts resolve the way they do for a creator. The
 * Telugu report was about the preview specifically, and a preview that works
 * offline while the served one shows nothing is exactly the gap worth closing.
 */

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

import { buildNarrationScript } from '@/lib/script/build';
import { alignScriptToAudio } from '@/lib/voice/align';
import { directionFor, getLanguage } from '@/lib/languages/registry';

const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const LANG = process.argv[3] ?? 'te';
const OUT = join(process.cwd(), '.render-tmp', 'shots');
/** Gitignored; `smoke:pages` uses the same staging area for the same reason. */
const STAGE = join(process.cwd(), 'public', '__smoke');

const PASSAGES: Record<string, { text: string; reference: string; device: string }> = {
  te: {
    reference: 'యోహాను 3:16',
    text: 'దేవుడు లోకమును ఎంతో ప్రేమించెను. కాగా ఆయన తన అద్వితీయకుమారునిగా పుట్టిన వానియందు విశ్వాసముంచు ప్రతివాడును నశింపక నిత్యజీవము పొందునట్లు ఆయనను అనుగ్రహించెను.',
    device: 'ఈ వచనాన్ని మనం పెళ్ళిళ్ళలో చదువుతాము. కానీ ఇది చీకటిలో వచ్చిన ఒక భయపడిన మనిషితో చెప్పబడింది.',
  },
  ta: {
    reference: 'யோவான் 3:16',
    text: 'தேவன், தம்முடைய ஒரேபேறான குமாரனை விசுவாசிக்கிறவன் எவனோ அவன் கெட்டுப்போகாமல் நித்தியஜீவனை அடையும்படிக்கு, அவரைத் தந்தருளி, இவ்வளவாய் உலகத்தில் அன்புகூர்ந்தார்.',
    device: 'இந்த வசனத்தை நாம் திருமணங்களில் வாசிக்கிறோம். ஆனால் இது இருளில் வந்த ஒரு பயந்த மனிதனிடம் சொல்லப்பட்டது.',
  },
  ko: {
    reference: '요한복음 3:16',
    text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
    device: '우리는 이 구절을 결혼식에서 읽습니다. 그러나 이 말씀은 어둠 속에서 찾아온 두려워하는 사람에게 주어진 것입니다.',
  },
  he: {
    reference: 'יוחנן ג:טז',
    text: 'כִּי־כֵן אָהַב הָאֱלֹהִים אֶת־הָעוֹלָם עַד־אֲשֶׁר נָתַן אֶת־בְּנוֹ אֶת־יְחִידוֹ לְמַעַן לֹא־יֹאבַד כָּל־הַמַּאֲמִין בּוֹ כִּי אִם־יִחְיֶה חַיֵּי עוֹלָם׃',
    device: 'אנחנו קוראים את הפסוק הזה בחתונות. אבל הוא נאמר לאדם מפוחד שבא בחשכה.',
  },
};

async function main() {
  const fixture = PASSAGES[LANG];
  if (!fixture) throw new Error(`No fixture for "${LANG}"`);

  const passage = {
    reference: fixture.reference,
    usfm: 'JHN.3.16',
    text: fixture.text,
    versionId: 0,
    versionAbbreviation: 'FIXTURE',
    versionName: 'fixture',
    attribution: 'fixture',
    languageCode: LANG,
  };
  const device = {
    type: 'hook' as const,
    content: fixture.device,
    point: fixture.device,
    reference: fixture.reference,
    emoji: '🌙',
  };

  const { script, segments } = buildNarrationScript({ device, passage });
  const durationSec = Math.max(18, Math.min(60, script.trim().split(/\s+/).length / 2.6));
  const aligned = alignScriptToAudio(script, [], durationSec);
  const entry = getLanguage(LANG);

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  page.on('pageerror', (e) => console.error(`  page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') console.error(`  console: ${m.text()}`);
  });
  page.on('requestfailed', (r) =>
    console.error(`  request failed: ${r.url()} ${r.failure()?.errorText}`),
  );

  for (const style of ['warm-minimal', 'kinetic-type', 'neon-night']) {
    const spec = {
      id: `preview-api-${LANG}-${style}`,
      passage,
      device,
      style,
      languageCode: LANG,
      voice: { engine: 'browser', model: LANG, label: 'preview' },
      narration: {
        script,
        audioUrl: '',
        durationSec,
        timings: aligned.timings,
        timingSource: 'estimated',
        segments,
      },
      music: null,
      durationSec,
      verified: true,
      script: entry?.script ?? 'latin',
      dir: directionFor(LANG),
      theme: { paletteId: 'parchment', fontId: process.env.SHOT_FONT ?? 'inter', sizeId: 'bold' },
    };

    const response = await fetch(`${BASE}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec }),
    });
    if (!response.ok) {
      throw new Error(`/api/preview ${style}: HTTP ${response.status}`);
    }
    const html = await response.text();

    // Staged under public/ and NAVIGATED to, rather than injected with
    // setContent. The composition's root-relative /fonts and /vendor links
    // have to resolve against the origin, which is what the studio's iframe
    // gives them — and setContent runs the inline script against a document
    // that is still being replaced, which is its own kind of wrong answer.
    mkdirSync(STAGE, { recursive: true });
    const staged = join(STAGE, `${LANG}-${style}.html`);
    writeFileSync(staged, html, 'utf8');
    await page.goto(`${BASE}/__smoke/${LANG}-${style}.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => {
      const tl = (window as unknown as {
        __timelines?: Record<string, { seek: (n: number) => void; duration: () => number }>;
      }).__timelines;
      if (tl) {
        Object.values(tl).forEach((line) => line.seek(line.duration() * 0.8));
      }
    });

    // Did the glyphs actually paint, or is the box empty? A missing font
    // renders as zero-width tofu, which is invisible in a report that only
    // checks the text is in the DOM.
    // LAYOUT is measured with offsetWidth, not getBoundingClientRect.
    //
    // The rect includes transforms, and these styles bring text in on a scale
    // — so a row caught mid-entry reads wider than the box it fits in
    // perfectly at rest. Reading the rect had this harness reporting a 1017px
    // row inside an 888px stage and calling it an overflow, when the row was
    // simply still growing into place. offsetWidth is the laid-out width,
    // which is the thing the fitter is responsible for.
    const painted = await page.evaluate(`(() => {
      const nodes = document.querySelectorAll('.tline, .caption-line');
      let widest = 0, where = '', spill = 0;
      for (const n of nodes) {
        const w = n.offsetWidth;
        const box = n.offsetParent || n.parentElement;
        const room = box ? box.clientWidth : 1080;
        if (w > widest) {
          widest = w;
          where = (n.parentElement.id || n.parentElement.className || '?')
            + ' > ' + n.className + ' in ' + room + 'px';
        }
        if (w > room + 2) spill += 1;
      }
      return { rows: nodes.length, widest: Math.round(widest), where, spill };
    })()`) as { rows: number; widest: number; where: string; spill: number };

    const file = join(OUT, `api-preview-${LANG}-${style}.png`);
    await page.screenshot({ path: file });
    const ok = painted.rows > 0 && painted.widest > 40 && painted.spill === 0;
    console.log(
      `${ok ? 'ok    ' : 'FAIL  '}${style.padEnd(14)} ${LANG}  ` +
        `${painted.rows} rows, widest ${painted.widest}px` +
        (painted.spill ? `, ${painted.spill} WIDER THAN BOX` : '') +
        `  (${painted.where})`,
    );
    if (!ok) process.exitCode = 1;
  }

  await browser.close();
  // The staging area is gitignored, but a leftover file would still be
  // deployed by a `vercel --prod` from this checkout.
  rmSync(STAGE, { recursive: true, force: true });
  console.log(`\nframes in ${OUT}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
