/**
 * Offline passage fixtures.
 *
 * Two jobs, both required by the build spec's fourth principle — never block
 * the demo on a cold service:
 *
 *   1. Development before a YouVersion App Key exists.
 *   2. A live demo that still works if the API is slow, rate-limited, or the
 *      network is flaky during judging.
 *
 * These are real published translations, transcribed here verbatim. They are
 * ALWAYS labelled as fixtures in the UI and in the run manifest — a fixture
 * that could be mistaken for a live API response would undermine exactly the
 * claim this project is built on.
 *
 * Fixtures are never used when `YVP_APP_KEY` is set.
 */

import type { Passage } from '@/lib/types';

export interface FixturePassage extends Passage {
  /** Always true. Consumers must surface this. */
  fixture: true;
}

function fixture(passage: Passage): FixturePassage {
  return { ...passage, fixture: true };
}

export const FIXTURE_PASSAGES: Record<string, FixturePassage[]> = {
  en: [
    fixture({
      reference: 'John 3:16',
      usfm: 'JHN.3.16',
      text: 'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.',
      versionId: 3034,
      versionAbbreviation: 'BSB',
      versionName: 'Berean Standard Bible',
      attribution:
        'Berean Standard Bible (BSB) · This text of God’s Word has been dedicated to the public domain.',
      languageCode: 'en',
    }),
    fixture({
      reference: 'Psalm 23:1-4',
      usfm: 'PSA.23.1-PSA.23.4',
      text: 'The LORD is my shepherd; I shall not want. He makes me lie down in green pastures; He leads me beside quiet waters. He restores my soul; He guides me in the paths of righteousness for the sake of His name. Even though I walk through the valley of the shadow of death, I will fear no evil, for You are with me; Your rod and Your staff, they comfort me.',
      versionId: 3034,
      versionAbbreviation: 'BSB',
      versionName: 'Berean Standard Bible',
      attribution:
        'Berean Standard Bible (BSB) · This text of God’s Word has been dedicated to the public domain.',
      languageCode: 'en',
    }),
    fixture({
      reference: 'Luke 15:20',
      usfm: 'LUK.15.20',
      text: 'So he got up and went to his father. But while he was still in the distance, his father saw him and was filled with compassion. He ran to his son, embraced him, and kissed him.',
      versionId: 3034,
      versionAbbreviation: 'BSB',
      versionName: 'Berean Standard Bible',
      attribution:
        'Berean Standard Bible (BSB) · This text of God’s Word has been dedicated to the public domain.',
      languageCode: 'en',
    }),
  ],
  hi: [
    fixture({
      reference: 'यूहन्ना 3:16',
      usfm: 'JHN.3.16',
      text: 'क्योंकि परमेश्वर ने जगत से ऐसा प्रेम रखा कि उस ने अपना एकलौता पुत्र दे दिया, ताकि जो कोई उस पर विश्वास करे, वह नाश न हो, परन्तु अनन्त जीवन पाए।',
      versionId: 0,
      versionAbbreviation: 'HINOVBSI',
      versionName: 'पवित्र बाइबिल',
      attribution: 'पवित्र बाइबिल (HINOVBSI) · Bible Society of India',
      languageCode: 'hi',
    }),
    fixture({
      reference: 'भजन संहिता 23:1',
      usfm: 'PSA.23.1',
      text: 'यहोवा मेरा चरवाहा है, मुझे कुछ घटी न होगी।',
      versionId: 0,
      versionAbbreviation: 'HINOVBSI',
      versionName: 'पवित्र बाइबिल',
      attribution: 'पवित्र बाइबिल (HINOVBSI) · Bible Society of India',
      languageCode: 'hi',
    }),
  ],
};

/** Fixtures for a language, falling back to English. */
export function fixturesFor(languageCode: string): FixturePassage[] {
  return FIXTURE_PASSAGES[languageCode] ?? FIXTURE_PASSAGES.en;
}

/**
 * Best fixture match for a typed input. Matches on reference or on a keyword
 * in the verse; returns the whole set when nothing matches, so the user always
 * has something to choose from.
 */
export function matchFixtures(
  input: string,
  languageCode: string,
): FixturePassage[] {
  const pool = fixturesFor(languageCode);
  const needle = input.trim().toLowerCase();
  if (!needle) return pool;

  const hits = pool.filter(
    (p) =>
      p.reference.toLowerCase().includes(needle) ||
      p.usfm.toLowerCase().includes(needle.replace(/\s+/g, '')) ||
      p.text.toLowerCase().includes(needle),
  );

  return hits.length > 0 ? hits : pool;
}
