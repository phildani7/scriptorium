/**
 * CC0 photos from the Openverse API (api.openverse.org). No key required for
 * anonymous use; results are filtered to license=cc0, so nothing rendered
 * ever needs attribution — the source is still recorded in `credit` because
 * provenance is this product's habit.
 *
 * Failures degrade to `null` silently: a missing photo means the short ships
 * icons-only, never an error.
 */

import type { VisualItem } from '@/lib/types';

interface OpenverseResult {
  url: string;
  width?: number;
  height?: number;
  foreign_landing_url?: string;
  source?: string;
}

export async function findCc0Photo(term: string): Promise<VisualItem | null> {
  const query = new URLSearchParams({
    q: term,
    license: 'cc0',
    page_size: '10',
    aspect_ratio: 'square',
  });
  try {
    const response = await fetch(
      `https://api.openverse.org/v1/images/?${query}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { results?: OpenverseResult[] };
    const results = json.results ?? [];
    // Prefer images big enough for a 1080-wide frame but not absurd.
    const pick =
      results.find((r) => (r.width ?? 0) >= 640 && (r.width ?? 0) <= 4000) ??
      results[0];
    if (!pick?.url) return null;
    return {
      kind: 'photo',
      src: pick.url,
      term,
      timeSec: 0, // anchored by the caller
      slot: 0,
      credit: `CC0 via Openverse${pick.source ? ` (${pick.source})` : ''}`,
    };
  } catch {
    return null;
  }
}
