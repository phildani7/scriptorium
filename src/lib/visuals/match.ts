/**
 * Turn a device + narration into timed visual items.
 *
 * The matcher owns WHERE and WHEN a visual appears; providers own WHAT it is.
 * Everything here is deterministic: same spec in, same visuals out — the
 * render contract allows nothing less.
 */

import type {
  DeviceItem,
  Narration,
  ShortVisuals,
  VisualItem,
  VisualMode,
} from '@/lib/types';
import { ICON_BY_TERM } from './icons.generated';
import { CLIPARTS } from './cliparts';

/** Max simultaneous-ish visuals per short; slots cycle 0..3. */
const MAX_ITEMS = 4;

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'was', 'is', 'are', 'were', 'be', 'been', 'that', 'this', 'it',
  'he', 'she', 'his', 'her', 'they', 'them', 'you', 'your', 'we', 'our',
  'not', 'no', 'so', 'as', 'by', 'from', 'when', 'who', 'what', 'did',
  'does', 'do', 'just', 'still', 'him', 'has', 'have', 'had', 'will',
]);

function normalize(word: string): string {
  const w = word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  // Light stemming: plural s, possessive s. Enough for a keyword library.
  return w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w;
}

/**
 * Both libraries keyed by NORMALIZED term, built once at module load. The
 * lookup side always normalizes, so un-normalized keys (e.g. "cross", which
 * stems to "cros") could never match — normalizing the keys too closes that
 * gap for both libraries at once.
 */
const CLIPART_BY_NORM: Record<string, string> = {};
for (const entry of CLIPARTS) {
  for (const term of entry.terms) {
    CLIPART_BY_NORM[normalize(term)] ??= entry.src;
  }
}
const ICON_BY_NORM: Record<string, string> = {};
for (const [term, svg] of Object.entries(ICON_BY_TERM)) {
  ICON_BY_NORM[normalize(term)] ??= svg;
}

type Art = { kind: 'clipart'; src: string } | { kind: 'icon'; svg: string };

/** Full-colour clipart outranks a palette-recolored line icon. */
function artFor(term: string): Art | null {
  const clip = CLIPART_BY_NORM[term];
  if (clip) return { kind: 'clipart', src: clip };
  const svg = ICON_BY_NORM[term];
  if (svg) return { kind: 'icon', svg };
  return null;
}

/**
 * The words of the teaching window (device + teaching segments) with their
 * measured times — the region visuals belong to. The citation is left alone.
 */
function teachingWindow(narration: Narration) {
  const spans: Array<{ word: string; time: number }> = [];
  for (const seg of narration.segments) {
    if (seg.kind !== 'device' && seg.kind !== 'teaching') continue;
    for (let i = seg.wordStart; i < seg.wordEnd; i += 1) {
      const t = narration.timings[i];
      if (t) spans.push({ word: normalize(t.word), time: t.start });
    }
  }
  return spans;
}

/**
 * Choose up to MAX_ITEMS icon visuals for this short.
 *
 * Preference order: the model's `visualTerms` (concrete English nouns) when
 * they hit the library, then any narration word that hits the library. Each
 * visual is anchored to the moment its word is spoken; when a term never
 * appears in the narration (visualTerms are English, narration may not be),
 * it is spread evenly across the teaching window instead.
 */
export function matchIcons(device: DeviceItem, narration: Narration): VisualItem[] {
  const window = teachingWindow(narration);
  if (window.length === 0) return [];
  const windowStart = window[0].time;
  const windowEnd = window[window.length - 1].time;

  const items: VisualItem[] = [];
  const usedTerms = new Set<string>();
  const usedTimes: number[] = [];
  /** Two visuals landing within 1.2s read as clutter, not rhythm. */
  const clearOf = (t: number) => usedTimes.every((u) => Math.abs(u - t) > 1.2);

  const push = (term: string, time: number, art: Art) => {
    items.push({
      ...(art.kind === 'clipart' ? { kind: 'clipart' as const, src: art.src } : art),
      term,
      timeSec: Math.round(time * 1000) / 1000,
      slot: items.length % 4,
    });
    usedTerms.add(term);
    usedTimes.push(time);
  };

  // 1. The model's own terms, anchored to their spoken word when present.
  for (const raw of device.visualTerms ?? []) {
    if (items.length >= MAX_ITEMS) break;
    const term = normalize(raw);
    const art = artFor(term);
    if (!art || usedTerms.has(term)) continue;
    const hit = window.find((w) => w.word === term && clearOf(w.time));
    if (hit) {
      push(term, hit.time, art);
    } else {
      // Not spoken (non-English narration): spread across the window.
      const spread =
        windowStart +
        ((items.length + 1) / (MAX_ITEMS + 1)) * (windowEnd - windowStart);
      if (clearOf(spread)) push(term, spread, art);
    }
  }

  // 2. Fill remaining slots from narration words that hit the libraries.
  for (const w of window) {
    if (items.length >= MAX_ITEMS) break;
    if (STOPWORDS.has(w.word) || usedTerms.has(w.word)) continue;
    const art = artFor(w.word);
    if (!art || !clearOf(w.time)) continue;
    push(w.word, w.time, art);
  }

  return items;
}

/** Assemble the spec's visuals block. Photos/AI items are appended upstream. */
export function buildVisuals(
  mode: VisualMode,
  device: DeviceItem,
  narration: Narration,
  extras: VisualItem[] = [],
): ShortVisuals | undefined {
  if (mode === 'text') return undefined;
  const icons = matchIcons(device, narration);
  // Extras (a hero photo or AI image) claim slot 0; keep total bounded.
  const items = [...extras, ...icons].slice(0, MAX_ITEMS + 1);
  return { mode, items };
}
