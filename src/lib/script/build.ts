/**
 * Assemble the narration script from a teaching device and a passage.
 *
 * This is the one place where generated prose and retrieved Scripture are
 * concatenated, so it is the one place that has to be careful about it. The
 * verse is spliced in as an opaque run of words whose boundaries are recorded,
 * and every consumer downstream — the template, the caption engine, the
 * integrity gate — works from those boundaries rather than from string search.
 *
 * Nothing here modifies `passage.text`. Not trimming, not re-punctuating, not
 * collapsing whitespace. The exact string that arrived from YouVersion is the
 * exact string that ends up in the verse segment.
 */

import type { DeviceItem, Passage, ScriptSegment } from '@/lib/types';

export interface BuiltScript {
  /** The complete narration text, ready for TTS. */
  script: string;
  /** Word ranges for each part, in spoken order. */
  segments: ScriptSegment[];
}

export interface BuildScriptOptions {
  device: DeviceItem;
  passage: Passage;
  /**
   * Speak the reference after the verse ("John 3:16"). On by default: hearing
   * where a verse comes from is how people learn to find it again.
   */
  speakReference?: boolean;
  /**
   * Speak and display the verse itself after the teaching, as the sixth and
   * final page. On by default. The verse segment goes through the verbatim
   * gate; passing false gives the older cite-only shape, which is kept for
   * passages the creator has chosen not to quote on screen.
   */
  includeVerse?: boolean;
}

/** Sentence pages in the teaching body. One sentence, one page, no exceptions. */
export const TEACHING_PAGES = 5;

export function buildNarrationScript(options: BuildScriptOptions): BuiltScript {
  const { device, passage, speakReference = true, includeVerse = true } = options;

  // The format: an opening line, then the teaching in five sentences — one
  // per page — then the verse itself on the sixth, then the citation. Specs
  // from before the teaching format carry no explanation at all, so they keep
  // the original device → verse → reference shape.
  const explanation = normalizeSpoken(device.explanation ?? '');
  const pages = explanation ? splitSentences(explanation, TEACHING_PAGES) : [];

  const parts: Array<{ kind: ScriptSegment['kind']; text: string; page?: number }> =
    pages.length
      ? [
          { kind: 'device', text: normalizeSpoken(device.content) },
          ...pages.map((text, page) => ({ kind: 'teaching' as const, text, page })),
          // Verbatim. The one part of the script that is not ours to shape.
          ...(includeVerse ? [{ kind: 'verse' as const, text: passage.text }] : []),
        ]
      : [
          { kind: 'device', text: normalizeSpoken(device.content) },
          // Verbatim. The one part of the script that is not ours to shape.
          { kind: 'verse', text: passage.text },
        ];

  const verseSpoken = !pages.length || includeVerse;
  if (speakReference) {
    parts.push({
      kind: 'reference',
      text: verseSpoken
        ? `${spokenReference(passage.reference, passage.languageCode)}.`
        : spokenCitation(passage.reference, passage.languageCode),
    });
  }

  const segments: ScriptSegment[] = [];
  const scriptParts: string[] = [];
  let wordCursor = 0;

  for (const part of parts) {
    const words = countWords(part.text);
    if (words === 0) continue;

    segments.push({
      kind: part.kind,
      text: part.text,
      wordStart: wordCursor,
      wordEnd: wordCursor + words,
      ...(part.page === undefined ? {} : { page: part.page }),
    });
    scriptParts.push(part.text);
    wordCursor += words;
  }

  return { script: scriptParts.join(' '), segments };
}

/**
 * Cut spoken prose into exactly `target` sentence-sized pages.
 *
 * The prompt asks the model for five sentences and the model usually obliges,
 * but "usually" is not a layout guarantee and a page that never renders — or
 * a sixth page colliding with the verse — is a visible defect. So the split is
 * reconciled here rather than trusted:
 *
 *   too many   the shortest neighbouring pair is joined, repeatedly, so the
 *              merge lands on the two sentences that read most like one
 *              thought instead of always clipping the tail
 *   too few    the longest page is split at the clause break nearest its
 *              middle (a comma, a semicolon, a colon), and only at a real
 *              break — mid-clause fragments read as a stutter on screen, so
 *              if there is no break to use the page simply stays long
 *
 * Both directions preserve word order and every word, which matters because
 * the caption rail is built from the same words and the segment boundaries
 * index into one shared timing array.
 */
export function splitSentences(text: string, target: number): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Sentence-final punctuation, including the Devanagari danda and its
  // double, plus the CJK/fullwidth stops that arrive from some voices.
  const pages = trimmed
    .split(/(?<=[.!?।॥。！？])\s+/u)
    .map((s) => s.trim())
    .filter(Boolean);

  while (pages.length > target) {
    let at = 0;
    let best = Infinity;
    for (let i = 0; i < pages.length - 1; i += 1) {
      const pair = countWords(pages[i]) + countWords(pages[i + 1]);
      if (pair < best) {
        best = pair;
        at = i;
      }
    }
    pages.splice(at, 2, `${pages[at]} ${pages[at + 1]}`);
  }

  while (pages.length < target) {
    let at = -1;
    let longest = 0;
    for (let i = 0; i < pages.length; i += 1) {
      const words = countWords(pages[i]);
      if (words > longest) {
        longest = words;
        at = i;
      }
    }
    // Fewer than four words either side is not a sentence, it is a fragment.
    const halves = at === -1 ? null : splitAtClause(pages[at]);
    if (!halves) break;
    pages.splice(at, 1, ...halves);
  }

  return pages;
}

/** Split one page at the clause break nearest its middle, or null if none. */
function splitAtClause(page: string): [string, string] | null {
  const words = page.split(/\s+/);
  if (words.length < 8) return null;

  const middle = words.length / 2;
  let at = -1;
  let closest = Infinity;
  // A break is a word that ENDS in clause punctuation; splitting after it
  // keeps that punctuation with the half it belongs to.
  for (let i = 2; i < words.length - 3; i += 1) {
    if (!/[,;:—–]$/u.test(words[i])) continue;
    const distance = Math.abs(i + 1 - middle);
    if (distance < closest) {
      closest = distance;
      at = i + 1;
    }
  }
  if (at === -1) return null;

  return [
    words.slice(0, at).join(' ').replace(/[,;:—–]$/u, '.'),
    // The tail was a clause, so it starts lowercase. On screen it is a whole
    // page on its own, and a page that opens mid-sentence reads as a bug
    // rather than a style. Scripts without case are unaffected.
    sentenceCase(words.slice(at).join(' ')),
  ];
}

function sentenceCase(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1);
}

/**
 * Tidy generated prose for speech and for screen. Applies only to model output
 * — never to the verse.
 *
 * Em dashes and ellipses are read aloud badly by every TTS engine we use, and a
 * stray markdown asterisk becomes an audible "asterisk". Models reach for em
 * dashes constantly, so this runs on every generated line.
 *
 * Exported because the review screen must show the creator the line that will
 * actually be spoken and rendered, not the raw model output.
 */
export function normalizeSpoken(text: string): string {
  return text
    .replace(/\*+/g, '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\.{3,}/g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * The spoken form of a reference. Only the NARRATED segment uses this — the
 * on-screen reference stays canonical ("Psalm 46:1").
 *
 * TTS engines read "46:1" as a time, a ratio, or "forty-six one" depending on
 * mood; none of them is how a person cites Scripture aloud. English gets the
 * full "chapter, verse" phrasing; other languages get the punctuation replaced
 * with pauses, which every engine at least reads in order.
 */
export function spokenReference(reference: string, languageCode?: string): string {
  const match = reference.match(/^(.*?)\s*(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/);

  if (!match) return reference.replace(/[:–-]/g, ', ');

  const [, book, chapter, verseStart, verseEnd] = match;

  if ((languageCode ?? 'en') === 'en') {
    return verseEnd
      ? `${book} ${chapter}, verses ${verseStart} to ${verseEnd}`
      : `${book} ${chapter}, verse ${verseStart}`;
  }

  // No reliable "verse" word per language; commas buy pauses in any engine.
  return verseEnd
    ? `${book} ${chapter}, ${verseStart}, ${verseEnd}`
    : `${book} ${chapter}, ${verseStart}`;
}

/**
 * The spoken citation that closes a teaching-format short. English gets the
 * full phrase; other languages get the bare reference — a hand-translated
 * "based on" for forty languages is a liability, a plain citation is not.
 */
export function spokenCitation(reference: string, languageCode?: string): string {
  const spoken = spokenReference(reference, languageCode);
  return (languageCode ?? 'en') === 'en'
    ? `This is based on ${spoken}.`
    : `${spoken}.`;
}

/** The segment carrying Scripture, which the integrity gate checks. */
export function verseSegment(segments: ScriptSegment[]): ScriptSegment | undefined {
  return segments.find((s) => s.kind === 'verse');
}

/** The teaching's sentence pages, in spoken order. */
export function teachingPages(segments: ScriptSegment[]): ScriptSegment[] {
  return segments
    .filter((s) => s.kind === 'teaching')
    .sort((a, b) => (a.page ?? 0) - (b.page ?? 0));
}

/**
 * Wall-clock start and end of a segment, from the aligned word timings.
 * Returns null when the segment has no timed words, which the template treats
 * as "show it for the whole clip" rather than as an error.
 */
export function segmentTimeRange(
  segment: ScriptSegment,
  timings: Array<{ start: number; end: number }>,
): { start: number; end: number } | null {
  const first = timings[segment.wordStart];
  const last = timings[segment.wordEnd - 1];
  if (!first || !last) return null;
  return { start: first.start, end: last.end };
}
