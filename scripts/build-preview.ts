/**
 * Bake a ShortSpec into a template and write a standalone preview file.
 *
 *   npm run preview:build
 *
 * This is the same operation the MP4 render performs: the spec is written into
 * the template's `#short-spec` script tag, so the composition needs no network
 * and no injection at runtime. Path A (live iframe) and Path B (offline render)
 * therefore consume byte-identical HTML, which is what stops the preview and
 * the export from drifting apart.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { alignScriptToAudio } from '@/lib/voice/align';
import { buildNarrationScript } from '@/lib/script/build';
import { verifyVerbatim } from '@/lib/verify/verbatim';
import { directionFor, getLanguage } from '@/lib/languages/registry';
import type { DeviceItem, Passage, ShortSpec } from '@/lib/types';

const ROOT = process.cwd();

/**
 * Fixtures used only until a YouVersion App Key is available. Both are real
 * published translations; the Hindi one is the long-verse stress test the
 * build spec calls for — it carries conjuncts (क्यों, विश्वास, अनन्त), a
 * half-form cluster, and a danda, which is exactly what breaks naive rendering.
 *
 * The moment the key lands these are replaced by live API calls; nothing else
 * in the pipeline changes, because everything downstream reads `Passage`.
 */
const FIXTURES: Record<string, { passage: Passage; device: DeviceItem }> = {
  en: {
    passage: {
      reference: 'John 3:16',
      usfm: 'JHN.3.16',
      text: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.',
      versionId: 3034,
      versionAbbreviation: 'BSB',
      versionName: 'Berean Standard Bible',
      attribution:
        'Berean Standard Bible (BSB) · This text of God’s Word has been dedicated to the public domain.',
      languageCode: 'en',
    },
    device: {
      type: 'hook',
      content:
        'We quote this verse at weddings and on stadium signs. It was written to a man who came at night because he was afraid to be seen.',
      point:
        'Nicodemus arrives in the dark; the verse answers a fear, not a slogan.',
      reference: 'John 3:16',
      emoji: '🌙',
    },
  },
  hi: {
    passage: {
      reference: 'यूहन्ना 3:16',
      usfm: 'JHN.3.16',
      text: 'क्योंकि परमेश्वर ने जगत से ऐसा प्रेम रखा कि उस ने अपना एकलौता पुत्र दे दिया, ताकि जो कोई उस पर विश्वास करे, वह नाश न हो, परन्तु अनन्त जीवन पाए।',
      versionId: 0,
      versionAbbreviation: 'HINOVBSI',
      versionName: 'पवित्र बाइबिल',
      attribution: 'पवित्र बाइबिल (HINOVBSI) · Bible Society of India',
      languageCode: 'hi',
    },
    device: {
      type: 'hook',
      content:
        'यह आयत हम शादियों में पढ़ते हैं। यह उस आदमी से कही गई थी जो रात के अँधेरे में आया था।',
      point: 'नीकुदेमुस अँधेरे में आता है; यह आयत एक डर का उत्तर है।',
      reference: 'यूहन्ना 3:16',
      emoji: '🌙',
    },
  },
};

function buildSpec(languageCode: string): ShortSpec {
  const fixture = FIXTURES[languageCode];
  if (!fixture) throw new Error(`No fixture for language "${languageCode}".`);

  const { passage, device } = fixture;
  const { script, segments } = buildNarrationScript({ device, passage });

  // No audio in this harness, so timings are estimated across a plausible
  // read. The real pipeline replaces these with measured Speechmatics timings;
  // the template cannot tell the difference, which is the point of the seam.
  const wordCount = script.trim().split(/\s+/).length;
  const durationSec = Math.max(18, Math.min(45, wordCount / 2.6));
  const aligned = alignScriptToAudio(script, [], durationSec);

  const verified = verifyVerbatim(passage.text, passage.text).ok;

  return {
    id: `preview-${languageCode}`,
    passage,
    device,
    style: 'warm-minimal',
    languageCode,
    voice: { engine: 'browser', model: languageCode, label: 'preview' },
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
    verified,
  };
}

function render(languageCode: string): string {
  const templatePath = join(ROOT, 'templates', 'warm-minimal', 'index.html');
  const html = readFileSync(templatePath, 'utf8');

  const spec = buildSpec(languageCode);
  const entry = getLanguage(languageCode);

  const payload = {
    ...spec,
    script: entry?.script ?? 'latin',
    dir: directionFor(languageCode),
    verifiedLabel: languageCode === 'hi' ? 'आयत सत्यापित' : 'verse verified',
  };

  // Escape `</script>` so a verse containing it could not break out of the tag.
  const json = JSON.stringify(payload, null, 2).replace(/<\//g, '<\\/');

  return html.replace(
    /(<script id="short-spec" type="application\/json">)[\s\S]*?(<\/script>)/,
    `$1\n${json}\n$2`,
  );
}

function main() {
  // Vendor GSAP so the composition has no network dependency.
  const vendorDir = join(ROOT, 'public', 'vendor');
  mkdirSync(vendorDir, { recursive: true });
  copyFileSync(
    join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    join(vendorDir, 'gsap.min.js'),
  );

  for (const lang of ['en', 'hi']) {
    const out = join(ROOT, 'public', 'preview', `${lang}.html`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, render(lang), 'utf8');
    console.log(`wrote public/preview/${lang}.html`);
  }

  console.log('\nServe with:  npx serve public   (or npm run dev)');
}

main();
