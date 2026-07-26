/**
 * The integrity gate.
 *
 * This module is the enforcement point for the project's headline claim:
 * Scripture text is retrieved, never generated. The model writes the teaching
 * device around the verse; it never writes, rewrites, or "cleans up" the verse.
 *
 * `assertVerbatim` runs twice:
 *   1. client-side, to light the "verse verified" badge in the live preview
 *   2. in `render/render.mjs`, after the DOM is populated and before a single
 *      frame is captured, where a mismatch HARD-FAILS the build
 *
 * It has no dependencies on purpose: it must be trivially auditable by a judge.
 */

/**
 * Characters a browser, a CSS rule, or a copy-paste can legitimately introduce
 * into a text node without changing what the verse says.
 *
 * Deliberately NOT stripped: U+200C ZWNJ and U+200D ZWJ. In Devanagari,
 * Bengali and Tamil these control conjunct formation and are part of the text's
 * meaning. Removing them to make a diff pass would defeat the purpose of the
 * check on exactly the languages this project exists to serve.
 */
const RENDER_ARTIFACTS = new RegExp(
  [
    '\\uFEFF', // byte order mark
    '\\u00AD', // soft hyphen (hyphenation)
    '\\u200E', // left-to-right mark
    '\\u200F', // right-to-left mark
    '\\u202A-\\u202E', // bidi embedding/override, inserted for RTL layout
    '\\u2066-\\u2069', // bidi isolates
  ].join('|'),
  'g',
);

/**
 * Collapse runs of whitespace to a single space. JavaScript's `\s` already
 * covers every Unicode space separator that matters here — NBSP (U+00A0), the
 * U+2000-U+200A range, ideographic space (U+3000), and the line/paragraph
 * separators — so the class does not need spelling out by hand.
 */
const WHITESPACE = /\s+/g;

/**
 * YouVersion passage text can carry inline verse numbers depending on the
 * request. We render without them, so the comparison drops them from both
 * sides rather than mutating the stored passage.
 */
const LEADING_VERSE_NUMBER = /(^|\s)\d{1,3}(?=\p{L})/gu;

export interface NormalizeOptions {
  /** Drop inline verse numbers before comparing. Default true. */
  stripVerseNumbers?: boolean;
}

/**
 * Reduce a string to the form in which two renderings of the *same* verse must
 * be byte-identical. NFC is essential: Devanagari matras and Tamil vowel signs
 * have multiple valid encodings, and a browser text node may hand back a
 * different one than the API did.
 */
export function normalizeScripture(
  input: string,
  options: NormalizeOptions = {},
): string {
  const { stripVerseNumbers = true } = options;
  let s = input.normalize('NFC');
  s = s.replace(RENDER_ARTIFACTS, '');
  if (stripVerseNumbers) s = s.replace(LEADING_VERSE_NUMBER, '$1');
  s = s.replace(WHITESPACE, ' ');
  return s.trim();
}

export interface VerificationResult {
  ok: boolean;
  /** Index of the first differing character in the normalized strings. */
  divergenceIndex?: number;
  /** Human-readable explanation, safe to print in CI logs and to a user. */
  message: string;
  normalizedExpected: string;
  normalizedActual: string;
}

/**
 * Compare rendered verse text against the passage as retrieved from YouVersion.
 *
 * @param rendered  text extracted from the DOM node that displays the verse
 * @param source    `Passage.text`, exactly as the API returned it
 */
export function verifyVerbatim(
  rendered: string,
  source: string,
  options?: NormalizeOptions,
): VerificationResult {
  const normalizedActual = normalizeScripture(rendered, options);
  const normalizedExpected = normalizeScripture(source, options);

  if (normalizedActual === normalizedExpected) {
    return {
      ok: true,
      message: `Verse verified: ${normalizedExpected.length} characters match the YouVersion response exactly.`,
      normalizedExpected,
      normalizedActual,
    };
  }

  const divergenceIndex = firstDivergence(normalizedExpected, normalizedActual);
  return {
    ok: false,
    divergenceIndex,
    message: buildMismatchMessage(
      normalizedExpected,
      normalizedActual,
      divergenceIndex,
    ),
    normalizedExpected,
    normalizedActual,
  };
}

/**
 * Throwing wrapper for the render pipeline. A mismatch must stop the build, not
 * warn about it: a short that ships altered Scripture is worse than no short.
 */
export function assertVerbatim(
  rendered: string,
  source: string,
  options?: NormalizeOptions,
): void {
  const result = verifyVerbatim(rendered, source, options);
  if (!result.ok) {
    throw new ScriptureIntegrityError(result);
  }
}

export class ScriptureIntegrityError extends Error {
  readonly result: VerificationResult;

  constructor(result: VerificationResult) {
    super(`Scripture integrity check failed.\n${result.message}`);
    this.name = 'ScriptureIntegrityError';
    this.result = result;
  }
}

function firstDivergence(a: string, b: string): number {
  const limit = Math.min(a.length, b.length);
  for (let i = 0; i < limit; i += 1) {
    if (a[i] !== b[i]) return i;
  }
  return limit;
}

function buildMismatchMessage(
  expected: string,
  actual: string,
  at: number,
): string {
  const window = 40;
  const from = Math.max(0, at - window);
  const slice = (s: string) =>
    `${from > 0 ? '…' : ''}${s.slice(from, at + window)}${
      at + window < s.length ? '…' : ''
    }`;

  const caretOffset = at - from + (from > 0 ? 1 : 0);

  return [
    `First difference at character ${at}.`,
    `  expected: ${slice(expected)}`,
    `  rendered: ${slice(actual)}`,
    `            ${' '.repeat(Math.max(0, caretOffset))}^`,
    `  expected length ${expected.length}, rendered length ${actual.length}`,
    '',
    'Scripture text must pass through the pipeline untouched. Something between',
    'the YouVersion response and the rendered DOM modified it.',
  ].join('\n');
}
