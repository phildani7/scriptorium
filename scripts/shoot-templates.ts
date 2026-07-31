/**
 * Screenshot every template at the frames that decide whether the type fits.
 *
 *   npx tsx scripts/shoot-templates.ts
 *   npx tsx scripts/shoot-templates.ts --lang te --style kinetic-type
 *
 * This exists because the two ways a short goes wrong are both invisible to a
 * unit test: type that overflows its box, and a script with no font. Both look
 * fine in the spec and both are obvious in a picture.
 *
 * It bakes through the real `bakeComposition`, so what is photographed is the
 * same HTML the MP4 render captures — a harness that built its own page could
 * pass while the product failed.
 */

import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

import { bakeComposition } from '@/lib/render/bake';
import { buildNarrationScript } from '@/lib/script/build';
import { alignScriptToAudio } from '@/lib/voice/align';
import { directionFor, getLanguage } from '@/lib/languages/registry';
import { verifyVerbatim } from '@/lib/verify/verbatim';
import type { DeviceItem, Passage, ShortSpec, StyleId } from '@/lib/types';

const ROOT = process.cwd();
const OUT = join(ROOT, '.render-tmp', 'shots');

/**
 * Deliberately long content. A short passage fits anything; the question this
 * harness answers is what happens when it does not, which is the case that
 * used to run off the top of the frame.
 */
const CASES: Record<string, { passage: Passage; device: DeviceItem }> = {
  en: {
    passage: {
      reference: 'John 3:16',
      usfm: 'JHN.3.16',
      text: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.',
      versionId: 3034,
      versionAbbreviation: 'BSB',
      versionName: 'Berean Standard Bible',
      attribution: 'Berean Standard Bible (BSB)',
      languageCode: 'en',
    },
    device: {
      type: 'hook',
      content:
        'We quote this verse at weddings and print it on stadium signs. It was written for a frightened man who came looking for answers after dark.',
      point: 'Nicodemus arrives at night; the verse answers a fear.',
      reference: 'John 3:16',
      emoji: '🌙',
      explanation:
        'Nicodemus was a respected teacher who could not afford to be seen asking questions. He waited until the streets were empty and then went looking for a carpenter from Nazareth. Jesus did not scold him for coming in the dark or send him away until morning. He gave him the sentence that has outlived every other sentence spoken that night. The verse was never a slogan; it was an answer handed quietly to a frightened man.',
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
      attribution: 'पवित्र बाइबिल (HINOVBSI)',
      languageCode: 'hi',
    },
    device: {
      type: 'hook',
      content:
        'यह आयत हम शादियों में पढ़ते हैं और बड़े बोर्डों पर लिखते हैं। पर यह उस डरे हुए आदमी से कही गई थी जो रात के अँधेरे में आया था।',
      point: 'नीकुदेमुस अँधेरे में आता है।',
      reference: 'यूहन्ना 3:16',
      emoji: '🌙',
    },
  },
  ar: {
    passage: {
      reference: 'يوحنا 3:16',
      usfm: 'JHN.3.16',
      text: 'لأَنَّهُ هكَذَا أَحَبَّ اللهُ الْعَالَمَ حَتَّى بَذَلَ ابْنَهُ الْوَحِيدَ، لِكَيْ لاَ يَهْلِكَ كُلُّ مَنْ يُؤْمِنُ بِهِ، بَلْ تَكُونُ لَهُ الْحَيَاةُ الأَبَدِيَّةُ.',
      versionId: 0,
      versionAbbreviation: 'KEH',
      versionName: 'كتاب الحياة',
      attribution: 'كتاب الحياة (KEH)',
      languageCode: 'ar',
    },
    device: {
      type: 'hook',
      content: 'نقرأ هذه الآية في الأعراس ونكتبها على اللافتات. لكنها قيلت لرجل خائف جاء في ظلام الليل يبحث عن أجوبة.',
      point: 'جاء نيقوديموس ليلاً.',
      reference: 'يوحنا 3:16',
      emoji: '🌙',
    },
  },
  zh: {
    passage: {
      reference: '约翰福音 3:16',
      usfm: 'JHN.3.16',
      text: '神爱世人，甚至将他的独生子赐给他们，叫一切信他的，不至灭亡，反得永生。',
      versionId: 0,
      versionAbbreviation: 'CUNPSS',
      versionName: '和合本',
      attribution: '和合本 (CUNPSS)',
      languageCode: 'zh',
    },
    device: {
      type: 'hook',
      content: '我们在婚礼上诵读这节经文，把它写在标语上。但这句话原本是对一个深夜前来、心怀恐惧的人说的。',
      point: '尼哥底母是在夜里来的。',
      reference: '约翰福音 3:16',
      emoji: '🌙',
    },
  },
  ko: {
    passage: {
      reference: '요한복음 3:16',
      usfm: 'JHN.3.16',
      text: '하나님이 세상을 이처럼 사랑하사 독생자를 주셨으니 이는 그를 믿는 자마다 멸망하지 않고 영생을 얻게 하려 하심이라',
      versionId: 0,
      versionAbbreviation: 'KRV',
      versionName: '개역한글',
      attribution: '개역한글 (KRV)',
      languageCode: 'ko',
    },
    device: {
      type: 'hook',
      content: '우리는 이 구절을 결혼식에서 읽고 경기장 현수막에 새깁니다. 그러나 이 말씀은 어둠 속에서 찾아온 두려워하는 사람에게 주어진 것입니다.',
      point: '니고데모는 밤에 찾아왔습니다.',
      reference: '요한복음 3:16',
      emoji: '🌙',
    },
  },
  te: {
    passage: {
      reference: 'యోహాను 3:16',
      usfm: 'JHN.3.16',
      text: 'దేవుడు లోకమును ఎంతో ప్రేమించెను. కాగా ఆయన తన అద్వితీయకుమారునిగా పుట్టిన వానియందు విశ్వాసముంచు ప్రతివాడును నశింపక నిత్యజీవము పొందునట్లు ఆయనను అనుగ్రహించెను.',
      versionId: 0,
      versionAbbreviation: 'TELOVBSI',
      versionName: 'పరిశుద్ధ గ్రంథము',
      attribution: 'పరిశుద్ధ గ్రంథము (TELOVBSI)',
      languageCode: 'te',
    },
    device: {
      type: 'hook',
      content:
        'ఈ వచనాన్ని మనం పెళ్ళిళ్ళలో చదువుతాము. కానీ ఇది చీకటిలో వచ్చిన ఒక భయపడిన మనిషితో చెప్పబడింది.',
      point: 'నీకొదేము రాత్రి వస్తాడు.',
      reference: 'యోహాను 3:16',
      emoji: '🌙',
    },
  },
};

function buildSpec(lang: string, style: StyleId, theme: ShortSpec['theme']) {
  const { passage, device } = CASES[lang];
  const { script, segments } = buildNarrationScript({ device, passage });
  const words = script.trim().split(/\s+/).length;
  const durationSec = Math.max(18, Math.min(60, words / 2.6));
  const aligned = alignScriptToAudio(script, [], durationSec);
  const entry = getLanguage(lang);

  return {
    id: `shot-${lang}-${style}`,
    passage,
    device,
    style,
    theme,
    languageCode: lang,
    voice: { engine: 'browser' as const, model: lang, label: 'shot' },
    narration: {
      script,
      audioUrl: '',
      durationSec,
      timings: aligned.timings,
      timingSource: 'estimated' as const,
      segments,
    },
    music: null,
    durationSec,
    verified: true,
    script: entry?.script ?? 'latin',
    dir: directionFor(lang),
  };
}

function parse(argv: string[]) {
  const out: Record<string, string> = {};
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}

async function main() {
  const args = parse(process.argv);
  const langs = args.lang ? [args.lang] : ['en', 'hi', 'te', 'ko', 'ar', 'zh'];
  const styles: StyleId[] = args.style
    ? [args.style as StyleId]
    : ['kinetic-type', 'warm-minimal', 'neon-night'];

  // The theme the report named: Clean face, Large size. That combination is
  // what pushed the teaching off the top of the frame, so it is the one the
  // harness shoots by default.
  const theme: ShortSpec['theme'] = {
    fontId: args.font ?? 'inter',
    sizeId: args.size ?? 'bold',
    paletteId: args.palette ?? 'midnight',
    backgroundId: 'grain',
  };

  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'public', 'fonts'), join(OUT, 'fonts'), { recursive: true });
  cpSync(
    join(ROOT, 'node_modules', 'gsap', 'dist', 'gsap.min.js'),
    join(OUT, 'vendor', 'gsap.min.js'),
  );

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });

  const report: string[] = [];

  for (const style of styles) {
    const template = readFileSync(
      join(ROOT, 'templates', style, 'index.html'),
      'utf8',
    );
    for (const lang of langs) {
      const spec = buildSpec(lang, style, theme);
      // assetPrefix '' is what the MP4 renderer uses: a self-contained bundle
      // with `fonts/` sitting beside the page. Photographing it any other way
      // would test a page the product never serves.
      const html = bakeComposition({
        template,
        spec: spec as unknown as Record<string, unknown>,
        assetPrefix: '',
      });
      const file = join(OUT, `${style}-${lang}.html`);
      writeFileSync(file, html, 'utf8');

      await page.goto(`file://${file.replace(/\\/g, '/')}`, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);

      // A page is photographed at the moment its LAST word lands, which is
      // the only frame where all of it is on screen — these styles bring
      // words in on the voice, so any earlier instant shows a half-empty box
      // and proves nothing about whether the whole sentence fits.
      // 92% of the way through each segment: late enough that every word has
      // landed, early enough to be clear of the seam that hands the frame to
      // the next page. Sitting exactly on `end` photographs the changeover.
      const marks: number[] = [];
      for (const seg of spec.narration.segments) {
        const first = spec.narration.timings[seg.wordStart];
        const last = spec.narration.timings[seg.wordEnd - 1];
        if (!first || !last) continue;
        // Back off from the end by the length of a seam: the handoff to the
        // next page starts before the segment's last word finishes, so the
        // final instant photographs a cross-fade rather than the page.
        const span = last.end - first.start;
        marks.push(Math.max(first.start + span * 0.5, last.end - 0.9));
      }

      if (!args.check) {
        for (let m = 0; m < marks.length; m += 1) {
          await page.evaluate((t) => {
            const tl = (window as unknown as {
              __timelines?: Record<string, { seek: (n: number) => void }>;
            }).__timelines;
            if (tl) Object.values(tl).forEach((line) => line.seek(t));
          }, marks[m]);
          await page.screenshot({
            path: join(OUT, `${style}-${lang}-${String(m).padStart(2, '0')}.png`),
          });
        }
      }

      // The measurement the pictures are there to confirm: does anything
      // actually stick out of the 1080x1920 frame?
      const spill = await page.evaluate(() => {
        const out: string[] = [];
        const ids = ['wall', 'teach', 'stage', 'verse-stage', 'verse-block', 'caption-rail'];
        for (const id of ids) {
          const box = document.getElementById(id);
          if (!box) continue;
          const rows = box.querySelectorAll('.tline, .tchunk, .tpage, .caption-line');
          for (const row of Array.from(rows)) {
            const r = row.getBoundingClientRect();
            if (r.height === 0) continue;
            if (r.top < -1 || r.bottom > 1921 || r.left < -1 || r.right > 1081) {
              out.push(
                `${id} > ${row.className}: ` +
                  `top ${Math.round(r.top)} bottom ${Math.round(r.bottom)} ` +
                  `left ${Math.round(r.left)} right ${Math.round(r.right)}`,
              );
            }
          }
        }

        // Overflow is only half the question.
        //
        // A block handed a box NARROWER than the room it really has does not
        // overflow. It sets one word per line, shrinks to make that column
        // fit, and passes every check above — which is exactly how a collapsed
        // verse looked "fine" to a spill test. Shrinking on its own is not the
        // tell: a long opening line at poster scale legitimately drops to half
        // size. The tell is a page made almost entirely of single words that
        // do not come close to filling their own line, because that is what a
        // width budget of nearly zero produces.
        for (const node of Array.from(document.querySelectorAll('[data-fit]'))) {
          const page = node as HTMLElement;
          const rows = Array.from(page.children) as HTMLElement[];
          if (rows.length < 4) continue;
          const room = page.clientWidth;
          const starved = rows.filter(
            (r) => r.children.length === 1 && r.offsetWidth < room * 0.5,
          ).length;
          if (starved / rows.length > 0.6) {
            out.push(
              `${page.id || page.className}: ${starved}/${rows.length} rows hold one short ` +
                `word in ${room}px of room (fit ${page.getAttribute('data-fit')}) — ` +
                'the width it was measured against is not the width it has',
            );
          }
        }
        return out;
      });

      // The integrity gate reads [data-verse-text].textContent and collapses
      // whitespace before diffing. Laying the verse out as rows of words is
      // exactly the change that could fuse two words across a row boundary
      // and fail a verse that is word-for-word correct, so the harness runs
      // the same comparison the renderer will.
      const renderedVerse = await page.evaluate(() => {
        const node = document.querySelector('[data-verse-text]');
        return node ? (node.textContent ?? '') : null;
      });
      const gate =
        renderedVerse && renderedVerse.trim()
          ? verifyVerbatim(renderedVerse, spec.passage.text)
          : null;

      const problems = [...spill];
      if (gate && !gate.ok) problems.push(`VERSE GATE: ${gate.message.split('\n')[0]}`);

      const line = problems.length
        ? `FAIL   ${style}/${lang}\n        ${problems.join('\n        ')}`
        : `ok     ${style}/${lang}` +
          (gate ? `  (verse gate passed, ${marks.length} frames)` : `  (${marks.length} frames)`);
      report.push(line);
      console.log(line);
    }
  }

  await browser.close();
  writeFileSync(join(OUT, 'report.txt'), report.join('\n'), 'utf8');
  console.log(`\nshots in ${OUT}`);
  if (report.some((r) => r.startsWith('FAIL'))) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
