/**
 * Forced alignment: ASR timings, script words.
 *
 * Speechmatics tells us WHEN each word was spoken. It also tells us what it
 * thought the word was — and we throw that away.
 *
 * The reason is specific to this project. Captions sit directly under a verse.
 * If ASR mishears "he gave His one and only Son" and we render what it heard,
 * a viewer sees altered Scripture, and no amount of care elsewhere in the
 * pipeline would catch it, because the verse element itself was never touched.
 * So the caption text is always the script we already hold, and ASR contributes
 * nothing but a clock.
 *
 * That turns captioning into an alignment problem: walk the script and the ASR
 * output together, match what we can, and interpolate the rest. Failure to
 * match a word costs timing precision on that word. It can never cost accuracy.
 */

import type { WordTiming } from '@/lib/types';
import type { AsrWord } from './speechmatics';

export interface AlignmentResult {
  timings: WordTiming[];
  /** 0-1. Share of script words that matched an ASR word directly. */
  matchRate: number;
  /** Words whose timing was interpolated rather than measured. */
  interpolatedCount: number;
  durationSec: number;
}

/** A word of the script, in its original surface form. */
interface ScriptToken {
  /** Exactly as it appears in the script — this is what renders. */
  surface: string;
  /** Folded form used only for matching against ASR. */
  key: string;
}

/**
 * Align a script against ASR output.
 *
 * @param script      the narration text, the source of truth for what is shown
 * @param asrWords    Speechmatics words, the source of truth for when
 * @param audioDurationSec used to bound the final word and to interpolate tails
 */
export function alignScriptToAudio(
  script: string,
  asrWords: AsrWord[],
  audioDurationSec: number,
): AlignmentResult {
  const tokens = tokenizeScript(script);

  if (tokens.length === 0) {
    return { timings: [], matchRate: 1, interpolatedCount: 0, durationSec: audioDurationSec };
  }

  // No usable ASR: fall back to weighted estimation across the whole clip.
  if (asrWords.length === 0) {
    return {
      timings: estimateTimings(tokens, 0, audioDurationSec),
      matchRate: 0,
      interpolatedCount: tokens.length,
      durationSec: audioDurationSec,
    };
  }

  const anchors = findAnchors(tokens, asrWords);
  const timings = fillFromAnchors(tokens, anchors, audioDurationSec);

  return {
    timings,
    matchRate: anchors.size / tokens.length,
    interpolatedCount: tokens.length - anchors.size,
    durationSec: audioDurationSec,
  };
}

/**
 * Match script tokens to ASR words with a bounded lookahead on both sides.
 *
 * A strict two-pointer walk desynchronises permanently the first time ASR drops
 * or merges a word. The lookahead lets the walk resynchronise: when the current
 * pair does not match, we search a small window ahead in each stream for the
 * nearest agreement and jump there, treating whatever was skipped as unmatched.
 *
 * @returns map of script-token index -> ASR word
 */
function findAnchors(
  tokens: ScriptToken[],
  asrWords: AsrWord[],
): Map<number, AsrWord> {
  const anchors = new Map<number, AsrWord>();
  const WINDOW = 5;

  let t = 0;
  let a = 0;

  while (t < tokens.length && a < asrWords.length) {
    const tokenKey = tokens[t].key;
    const asrKey = fold(asrWords[a].content);

    if (tokenKey && tokenKey === asrKey) {
      anchors.set(t, asrWords[a]);
      t += 1;
      a += 1;
      continue;
    }

    // Look for the nearest resynchronisation point within the window.
    const jump = findResync(tokens, asrWords, t, a, WINDOW);
    if (jump) {
      anchors.set(jump.t, asrWords[jump.a]);
      t = jump.t + 1;
      a = jump.a + 1;
      continue;
    }

    // No agreement nearby. Advance whichever side is likely behind: prefer
    // consuming the script token, since ASR dropping a word is the common case.
    t += 1;
    if (t % 2 === 0) a += 1;
  }

  return anchors;
}

function findResync(
  tokens: ScriptToken[],
  asrWords: AsrWord[],
  tStart: number,
  aStart: number,
  window: number,
): { t: number; a: number } | null {
  let best: { t: number; a: number; cost: number } | null = null;

  for (let dt = 0; dt < window && tStart + dt < tokens.length; dt += 1) {
    const key = tokens[tStart + dt].key;
    if (!key) continue;

    for (let da = 0; da < window && aStart + da < asrWords.length; da += 1) {
      const asrKey = fold(asrWords[aStart + da].content);
      if (!asrKey) continue;

      const exact = key === asrKey;
      // Near-matches catch ASR normalising numerals, plurals and elisions.
      const near = !exact && key.length > 3 && similar(key, asrKey);
      if (!exact && !near) continue;

      // Prefer the closest match to the current position, exact over near.
      const cost = dt + da + (exact ? 0 : 1);
      if (!best || cost < best.cost) {
        best = { t: tStart + dt, a: aStart + da, cost };
      }
    }
  }

  return best ? { t: best.t, a: best.a } : null;
}

/**
 * Give every script token a timing, using matched words as fixed anchors and
 * distributing unmatched runs between them in proportion to word length —
 * longer words take longer to say, so this beats an even split.
 */
function fillFromAnchors(
  tokens: ScriptToken[],
  anchors: Map<number, AsrWord>,
  audioDurationSec: number,
): WordTiming[] {
  const timings: WordTiming[] = new Array(tokens.length);

  const anchorIndices = [...anchors.keys()].sort((x, y) => x - y);

  for (const i of anchorIndices) {
    const word = anchors.get(i)!;
    timings[i] = { word: tokens[i].surface, start: word.start, end: word.end };
  }

  // Leading run, before the first anchor.
  const first = anchorIndices[0] ?? tokens.length;
  if (first > 0) {
    const end = first < tokens.length ? timings[first].start : audioDurationSec;
    writeSpan(timings, tokens, 0, first, 0, end);
  }

  // Runs between anchors.
  for (let k = 0; k < anchorIndices.length - 1; k += 1) {
    const from = anchorIndices[k];
    const to = anchorIndices[k + 1];
    if (to - from > 1) {
      writeSpan(timings, tokens, from + 1, to, timings[from].end, timings[to].start);
    }
  }

  // Trailing run, after the last anchor.
  const last = anchorIndices[anchorIndices.length - 1];
  if (last !== undefined && last < tokens.length - 1) {
    writeSpan(
      timings,
      tokens,
      last + 1,
      tokens.length,
      timings[last].end,
      audioDurationSec,
    );
  }

  return enforceMonotonic(timings, audioDurationSec);
}

/** Distribute [from, to) across [startSec, endSec] weighted by word length. */
function writeSpan(
  timings: WordTiming[],
  tokens: ScriptToken[],
  from: number,
  to: number,
  startSec: number,
  endSec: number,
): void {
  const span = Math.max(0, endSec - startSec);
  const weights = [];
  let total = 0;
  for (let i = from; i < to; i += 1) {
    // +1 so a one-character word still occupies time.
    const w = tokens[i].surface.length + 1;
    weights.push(w);
    total += w;
  }

  let cursor = startSec;
  for (let i = from; i < to; i += 1) {
    const share = total > 0 ? (weights[i - from] / total) * span : 0;
    timings[i] = {
      word: tokens[i].surface,
      start: cursor,
      end: cursor + share,
    };
    cursor += share;
  }
}

/** Even fallback when there is no ASR at all. */
function estimateTimings(
  tokens: ScriptToken[],
  startSec: number,
  endSec: number,
): WordTiming[] {
  const timings: WordTiming[] = new Array(tokens.length);
  writeSpan(timings, tokens, 0, tokens.length, startSec, endSec);
  return timings;
}

/**
 * Captions are driven by a monotonically advancing clock, so overlapping or
 * backwards timings would make a word flicker or never appear. Repair rather
 * than trust: alignment produces these rarely, and a broken caption is worse
 * than a slightly imprecise one.
 */
function enforceMonotonic(
  timings: WordTiming[],
  audioDurationSec: number,
): WordTiming[] {
  const MIN = 0.04;
  let previousEnd = 0;

  for (let i = 0; i < timings.length; i += 1) {
    const t = timings[i] ?? { word: '', start: previousEnd, end: previousEnd };
    let start = Math.max(t.start, previousEnd);
    let end = Math.max(t.end, start + MIN);

    if (audioDurationSec > 0) {
      start = Math.min(start, audioDurationSec);
      end = Math.min(end, audioDurationSec);
      if (end <= start) end = Math.min(audioDurationSec, start + MIN);
    }

    timings[i] = { word: t.word, start: round(start), end: round(end) };
    previousEnd = end;
  }

  return timings;
}

/**
 * Split narration into display tokens.
 *
 * Whitespace-delimited, so punctuation stays attached to its word and renders
 * naturally. Works for scripts that have no spaces between words (Thai,
 * Japanese) only at phrase granularity — acceptable, because those languages
 * are text-first tier today.
 */
function tokenizeScript(script: string): ScriptToken[] {
  return script
    .normalize('NFC')
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .map((surface) => ({ surface, key: fold(surface) }));
}

/**
 * Fold a word for comparison: NFC, lowercase, and strip everything that is not
 * a letter or a number in any script. Devanagari matras and Arabic diacritics
 * are letters or marks, so they survive; commas, quotes and the danda do not.
 */
function fold(word: string): string {
  return word
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/** Cheap near-match: shared prefix over most of the shorter word. */
function similar(a: string, b: string): boolean {
  if (a === b) return true;
  const shorter = a.length < b.length ? a : b;
  const longer = a.length < b.length ? b : a;
  if (longer.length - shorter.length > 3) return false;

  let common = 0;
  while (common < shorter.length && shorter[common] === longer[common]) common += 1;

  return common >= Math.max(3, Math.floor(shorter.length * 0.75));
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * WAV duration from the header.
 *
 * The declared `data` chunk size cannot be trusted. A WAV produced by a
 * streaming encoder — Speechmatics' TTS among them — is written before its
 * own length is known, so it carries the "unknown length" placeholder
 * 0xFFFFFFFF. Taking that at face value yields ~268,435 seconds, which is
 * three days of composition for four seconds of speech.
 *
 * So: read the declared size, but bound it by how many bytes actually follow.
 */
export function wavDurationSeconds(wav: Uint8Array): number {
  if (wav.byteLength < 44) return 0;

  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  if (view.getUint32(0, false) !== 0x52494646 /* "RIFF" */) return 0;

  let offset = 12;
  let byteRate = 0;

  while (offset + 8 <= wav.byteLength) {
    const id = view.getUint32(offset, false);
    const declared = view.getUint32(offset + 4, true);

    if (id === 0x666d7420 /* "fmt " */) {
      // Layout from the chunk start: +0 id, +4 size, +8 format, +10 channels,
      // +12 sample rate, +16 BYTE RATE. Reading +12 yields the sample rate,
      // which for 16-bit mono is exactly half the byte rate — so every
      // duration comes out twice as long, quietly.
      byteRate = view.getUint32(offset + 16, true);
    } else if (id === 0x64617461 /* "data" */) {
      if (byteRate <= 0) return 0;
      const remaining = wav.byteLength - (offset + 8);
      // Whichever is smaller: what the header claims, or what is really there.
      const actual = Math.min(declared, Math.max(0, remaining));
      return round(actual / byteRate);
    }

    // A placeholder size would also send the chunk walk past the end of the
    // buffer, so stop rather than loop on a bogus offset.
    if (declared > wav.byteLength) break;
    offset += 8 + declared + (declared % 2); // chunks are word-aligned
  }

  return 0;
}
