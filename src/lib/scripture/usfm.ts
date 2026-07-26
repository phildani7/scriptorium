/**
 * USFM reference parsing.
 *
 * The YouVersion Platform API addresses passages by USFM: `JHN.3.16`, or
 * `PSA.23.1-PSA.23.4` for a range. Users type "John 3:16", "Ps 23", or
 * "1 Cor 13:4-7". This module is the bridge, and it is deliberately strict:
 * anything it cannot parse with confidence is reported as unparseable so the
 * caller can fall back to topical search rather than guessing at a book.
 */

/** Canonical USFM book codes, with the aliases users actually type. */
const BOOKS: ReadonlyArray<{ code: string; names: readonly string[] }> = [
  { code: 'GEN', names: ['genesis', 'gen', 'ge', 'gn'] },
  { code: 'EXO', names: ['exodus', 'exod', 'exo', 'ex'] },
  { code: 'LEV', names: ['leviticus', 'lev', 'le', 'lv'] },
  { code: 'NUM', names: ['numbers', 'num', 'nu', 'nm', 'nb'] },
  { code: 'DEU', names: ['deuteronomy', 'deut', 'deu', 'dt'] },
  { code: 'JOS', names: ['joshua', 'josh', 'jos', 'jsh'] },
  { code: 'JDG', names: ['judges', 'judg', 'jdg', 'jg', 'jdgs'] },
  { code: 'RUT', names: ['ruth', 'rut', 'rth', 'ru'] },
  { code: '1SA', names: ['1 samuel', '1samuel', '1 sam', '1sam', '1sa', 'i samuel'] },
  { code: '2SA', names: ['2 samuel', '2samuel', '2 sam', '2sam', '2sa', 'ii samuel'] },
  { code: '1KI', names: ['1 kings', '1kings', '1 kgs', '1kgs', '1ki', 'i kings'] },
  { code: '2KI', names: ['2 kings', '2kings', '2 kgs', '2kgs', '2ki', 'ii kings'] },
  { code: '1CH', names: ['1 chronicles', '1chronicles', '1 chron', '1 chr', '1chr', '1ch'] },
  { code: '2CH', names: ['2 chronicles', '2chronicles', '2 chron', '2 chr', '2chr', '2ch'] },
  { code: 'EZR', names: ['ezra', 'ezr', 'ez'] },
  { code: 'NEH', names: ['nehemiah', 'neh', 'ne'] },
  { code: 'EST', names: ['esther', 'esth', 'est', 'es'] },
  { code: 'JOB', names: ['job', 'jb'] },
  { code: 'PSA', names: ['psalms', 'psalm', 'psa', 'pss', 'ps', 'psm'] },
  { code: 'PRO', names: ['proverbs', 'prov', 'pro', 'prv', 'pr'] },
  { code: 'ECC', names: ['ecclesiastes', 'eccles', 'eccl', 'ecc', 'ec', 'qoheleth'] },
  { code: 'SNG', names: ['song of solomon', 'song of songs', 'song', 'sos', 'sng', 'canticles'] },
  { code: 'ISA', names: ['isaiah', 'isa', 'is'] },
  { code: 'JER', names: ['jeremiah', 'jer', 'je', 'jr'] },
  { code: 'LAM', names: ['lamentations', 'lam', 'la'] },
  { code: 'EZK', names: ['ezekiel', 'ezek', 'ezk', 'eze', 'ezk'] },
  { code: 'DAN', names: ['daniel', 'dan', 'da', 'dn'] },
  { code: 'HOS', names: ['hosea', 'hos', 'ho'] },
  { code: 'JOL', names: ['joel', 'joe', 'jol', 'jl'] },
  { code: 'AMO', names: ['amos', 'amo', 'am'] },
  { code: 'OBA', names: ['obadiah', 'obad', 'oba', 'ob'] },
  { code: 'JON', names: ['jonah', 'jon', 'jnh'] },
  { code: 'MIC', names: ['micah', 'mic', 'mc'] },
  { code: 'NAM', names: ['nahum', 'nah', 'nam', 'na'] },
  { code: 'HAB', names: ['habakkuk', 'hab', 'hb'] },
  { code: 'ZEP', names: ['zephaniah', 'zeph', 'zep', 'zp'] },
  { code: 'HAG', names: ['haggai', 'hag', 'hg'] },
  { code: 'ZEC', names: ['zechariah', 'zech', 'zec', 'zc'] },
  { code: 'MAL', names: ['malachi', 'mal', 'ml'] },
  { code: 'MAT', names: ['matthew', 'matt', 'mat', 'mt'] },
  { code: 'MRK', names: ['mark', 'mrk', 'mar', 'mk', 'mr'] },
  { code: 'LUK', names: ['luke', 'luk', 'lk'] },
  { code: 'JHN', names: ['john', 'jhn', 'joh', 'jn'] },
  { code: 'ACT', names: ['acts', 'act', 'ac'] },
  { code: 'ROM', names: ['romans', 'rom', 'ro', 'rm'] },
  { code: '1CO', names: ['1 corinthians', '1corinthians', '1 cor', '1cor', '1co'] },
  { code: '2CO', names: ['2 corinthians', '2corinthians', '2 cor', '2cor', '2co'] },
  { code: 'GAL', names: ['galatians', 'gal', 'ga'] },
  { code: 'EPH', names: ['ephesians', 'eph', 'ep'] },
  { code: 'PHP', names: ['philippians', 'phil', 'php', 'pp'] },
  { code: 'COL', names: ['colossians', 'col', 'co'] },
  { code: '1TH', names: ['1 thessalonians', '1thessalonians', '1 thess', '1thess', '1th'] },
  { code: '2TH', names: ['2 thessalonians', '2thessalonians', '2 thess', '2thess', '2th'] },
  { code: '1TI', names: ['1 timothy', '1timothy', '1 tim', '1tim', '1ti'] },
  { code: '2TI', names: ['2 timothy', '2timothy', '2 tim', '2tim', '2ti'] },
  { code: 'TIT', names: ['titus', 'tit', 'ti'] },
  { code: 'PHM', names: ['philemon', 'philem', 'phm', 'pm'] },
  { code: 'HEB', names: ['hebrews', 'heb', 'hb'] },
  { code: 'JAS', names: ['james', 'jas', 'jm'] },
  { code: '1PE', names: ['1 peter', '1peter', '1 pet', '1pet', '1pe', '1pt'] },
  { code: '2PE', names: ['2 peter', '2peter', '2 pet', '2pet', '2pe', '2pt'] },
  { code: '1JN', names: ['1 john', '1john', '1 jn', '1jn', '1jo'] },
  { code: '2JN', names: ['2 john', '2john', '2 jn', '2jn', '2jo'] },
  { code: '3JN', names: ['3 john', '3john', '3 jn', '3jn', '3jo'] },
  { code: 'JUD', names: ['jude', 'jud', 'jd'] },
  { code: 'REV', names: ['revelation', 'revelations', 'rev', 're', 'apocalypse'] },
];

const BOOK_LOOKUP: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const { code, names } of BOOKS) {
    map.set(code.toLowerCase(), code);
    for (const name of names) map.set(name, code);
  }
  return map;
})();

/**
 * Books whose conventional display name is not just the title-cased first
 * alias. A single psalm is cited "Psalm 23", never "Psalms 23" — and that is
 * also how the Platform API renders it back to us, so matching avoids the
 * reference visibly changing between our screen and the API's.
 */
const DISPLAY_OVERRIDES: Readonly<Record<string, string>> = {
  PSA: 'Psalm',
  SNG: 'Song of Songs',
  PHP: 'Philippians',
  REV: 'Revelation',
  '1CO': '1 Corinthians',
  '2CO': '2 Corinthians',
  '1TH': '1 Thessalonians',
  '2TH': '2 Thessalonians',
  '1TI': '1 Timothy',
  '2TI': '2 Timothy',
  '1SA': '1 Samuel',
  '2SA': '2 Samuel',
  '1KI': '1 Kings',
  '2KI': '2 Kings',
  '1CH': '1 Chronicles',
  '2CH': '2 Chronicles',
  '1PE': '1 Peter',
  '2PE': '2 Peter',
  '1JN': '1 John',
  '2JN': '2 John',
  '3JN': '3 John',
};

/** English display names, used to render a canonical reference string. */
export const BOOK_DISPLAY_NAMES: ReadonlyMap<string, string> = new Map(
  BOOKS.map(({ code, names }) => [
    code,
    DISPLAY_OVERRIDES[code] ?? titleCase(names[0]),
  ]),
);

export interface ParsedReference {
  book: string;
  chapter: number;
  /** Undefined for a whole chapter. */
  verseStart?: number;
  /** Undefined for a single verse. */
  verseEnd?: number;
  /** USFM string for the API, e.g. "PSA.23.1-PSA.23.4" or "PSA.23". */
  usfm: string;
  /** Canonical human-readable form, e.g. "Psalm 23:1-4". */
  display: string;
}

/**
 * Normalise a user-typed reference.
 *
 * Handles: "John 3:16" · "john3:16" · "1 Cor 13:4-7" · "Psalm 23" ·
 * "Ps 23:1–4" (en dash) · "JHN.3.16" (already USFM) · "Genesis 1:1-3".
 *
 * Returns null when the input does not look like a reference at all, which is
 * the signal to treat it as a topic and search instead.
 */
export function parseReference(input: string): ParsedReference | null {
  const cleaned = input
    .trim()
    .replace(/[‐-―−]/g, '-') // dashes of all kinds → hyphen
    .replace(/\s+/g, ' ');

  if (cleaned.length === 0) return null;

  // Already USFM: JHN.3.16, PSA.23.1-4, or the fully-qualified
  // PSA.23.1-PSA.23.4 that other tooling emits (accepted on input, normalised
  // to the short form the Platform API requires on output).
  const usfmDirect = cleaned.match(
    /^([1-3]?[A-Za-z]{2,3})\.(\d{1,3})(?:\.(\d{1,3}))?(?:\s*-\s*(?:[1-3]?[A-Za-z]{2,3}\.\d{1,3}\.)?(\d{1,3}))?$/,
  );
  if (usfmDirect) {
    const code = BOOK_LOOKUP.get(usfmDirect[1].toLowerCase());
    if (code) {
      return build(
        code,
        Number(usfmDirect[2]),
        usfmDirect[3] ? Number(usfmDirect[3]) : undefined,
        usfmDirect[4] ? Number(usfmDirect[4]) : undefined,
      );
    }
  }

  // "<book> <chapter>[:<verse>[-<verse>]]"
  const match = cleaned.match(
    /^([1-3]?\s*[A-Za-z][A-Za-z\s]*?)\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?$/,
  );
  if (!match) return null;

  const bookKey = match[1].toLowerCase().replace(/\.$/, '').replace(/\s+/g, ' ').trim();
  const code =
    BOOK_LOOKUP.get(bookKey) ?? BOOK_LOOKUP.get(bookKey.replace(/\s+/g, ''));
  if (!code) return null;

  const chapter = Number(match[2]);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 150) return null;

  const verseStart = match[3] ? Number(match[3]) : undefined;
  const verseEnd = match[4] ? Number(match[4]) : undefined;

  if (verseEnd !== undefined && verseStart !== undefined && verseEnd < verseStart) {
    return null;
  }

  return build(code, chapter, verseStart, verseEnd);
}

function build(
  book: string,
  chapter: number,
  verseStart?: number,
  verseEnd?: number,
): ParsedReference {
  const name = BOOK_DISPLAY_NAMES.get(book) ?? book;

  let usfm: string;
  let display: string;

  if (verseStart === undefined) {
    usfm = `${book}.${chapter}`;
    display = `${name} ${chapter}`;
  } else if (verseEnd === undefined || verseEnd === verseStart) {
    usfm = `${book}.${chapter}.${verseStart}`;
    display = `${name} ${chapter}:${verseStart}`;
  } else {
    // Ranges are `BOOK.CH.V1-V2`. The fully-qualified form some USFM tooling
    // uses — `PSA.27.1-PSA.27.3` — is rejected by the Platform API with a 404,
    // which reads as "no such passage" rather than "bad syntax". Verified
    // against the live API; see usfm.test.ts.
    usfm = `${book}.${chapter}.${verseStart}-${verseEnd}`;
    display = `${name} ${chapter}:${verseStart}-${verseEnd}`;
  }

  return { book, chapter, verseStart, verseEnd, usfm, display };
}

/**
 * Does this input look like someone reaching for a reference at all?
 * Used to decide between direct lookup and topical search.
 */
export function looksLikeReference(input: string): boolean {
  return parseReference(input) !== null;
}

function titleCase(s: string): string {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}
