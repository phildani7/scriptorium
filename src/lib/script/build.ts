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
}

export function buildNarrationScript(options: BuildScriptOptions): BuiltScript {
  const { device, passage, speakReference = true } = options;

  const parts: Array<{ kind: ScriptSegment['kind']; text: string }> = [
    { kind: 'device', text: normalizeSpoken(device.content) },
    // Verbatim. This is the only part of the script that is not ours to shape.
    { kind: 'verse', text: passage.text },
  ];

  if (speakReference) {
    parts.push({ kind: 'reference', text: `${passage.reference}.` });
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
    });
    scriptParts.push(part.text);
    wordCursor += words;
  }

  return { script: scriptParts.join(' '), segments };
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

/** The segment carrying Scripture, which the integrity gate checks. */
export function verseSegment(segments: ScriptSegment[]): ScriptSegment | undefined {
  return segments.find((s) => s.kind === 'verse');
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
