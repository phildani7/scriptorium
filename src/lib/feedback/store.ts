/**
 * The one place the app talks to its feedback store (likes + reviews).
 *
 * Supabase, spoken to over plain PostgREST fetch rather than the SDK: two
 * endpoints and an RPC do not justify a dependency, and a route handler you
 * can read top to bottom is easier to trust with the only write path the
 * public has.
 *
 * The key used here is the ANON key, and it never reaches the browser — the
 * client talks to our API routes, which talk to Supabase server-side. That
 * ordering is what lets the rate limiter in front of these calls mean
 * something. The key's actual power is bounded by RLS: SELECT on both tables,
 * INSERT on reviews (length-checked in the schema), and EXECUTE on the
 * increment function. There is deliberately no UPDATE policy on the counter,
 * so even this key cannot set it to an arbitrary number.
 *
 * Everything degrades to null when unconfigured: a fork of this repo without
 * the env vars builds and runs, and the UI simply hides the social surface.
 */

import { cleanEnv } from '@/lib/env';

const URL_VAR = 'SCRIPTORIUM_FEEDBACK_URL';
const KEY_VAR = 'SCRIPTORIUM_FEEDBACK_KEY';

export interface Review {
  name: string;
  body: string;
  createdAt: string;
}

export function feedbackConfigured(): boolean {
  return Boolean(cleanEnv(URL_VAR) && cleanEnv(KEY_VAR));
}

async function rest(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const url = cleanEnv(URL_VAR);
  const key = cleanEnv(KEY_VAR);
  if (!url || !key) return null;

  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    signal: AbortSignal.timeout(8000),
  });
}

/** Current like count, or null when the store is unreachable/unconfigured. */
export async function likeCount(): Promise<number | null> {
  try {
    const response = await rest('scriptorium_likes?select=count&limit=1');
    if (!response?.ok) return null;
    const rows = (await response.json()) as Array<{ count: number }>;
    return rows[0]?.count ?? 0;
  } catch {
    return null;
  }
}

/** Atomically add one like; returns the new count, or null on failure. */
export async function addLike(): Promise<number | null> {
  try {
    const response = await rest('rpc/scriptorium_like', {
      method: 'POST',
      body: '{}',
    });
    if (!response?.ok) return null;
    return (await response.json()) as number;
  } catch {
    return null;
  }
}

/** Newest reviews first. */
export async function listReviews(limit = 50): Promise<Review[] | null> {
  try {
    const response = await rest(
      `scriptorium_reviews?select=name,body,created_at&order=created_at.desc&limit=${limit}`,
    );
    if (!response?.ok) return null;
    const rows = (await response.json()) as Array<{
      name: string;
      body: string;
      created_at: string;
    }>;
    return rows.map((r) => ({ name: r.name, body: r.body, createdAt: r.created_at }));
  } catch {
    return null;
  }
}

/** Store one review. The schema re-checks the lengths; this is the UX copy. */
export async function addReview(
  name: string,
  body: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const cleanName = name.trim().slice(0, 60);
  const cleanBody = body.trim();
  if (!cleanName) return { ok: false, error: 'Please add your name.' };
  if (cleanBody.length < 3) return { ok: false, error: 'Please write a few words.' };
  if (cleanBody.length > 1000) {
    return { ok: false, error: 'Reviews are capped at 1000 characters.' };
  }

  try {
    const response = await rest('scriptorium_reviews', {
      method: 'POST',
      body: JSON.stringify({ name: cleanName, body: cleanBody }),
      headers: { Prefer: 'return=minimal' },
    });
    if (!response?.ok) {
      return { ok: false, error: 'Could not save the review. Please try again.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not reach the review store.' };
  }
}

export interface QueuedRender {
  id: string;
  reference: string;
  language: string;
  style: string;
  createdAt: string;
}

/**
 * Record a dispatched render, fire-and-forget. The gallery shows the row
 * until the id turns up in the manifest; a failure to record must never fail
 * the export it describes.
 */
export async function addQueued(entry: {
  id: string;
  reference: string;
  language: string;
  style: string;
}): Promise<void> {
  try {
    await rest('scriptorium_queue', {
      method: 'POST',
      // Re-queuing the same id (a retry) is a no-op, not an error.
      headers: { Prefer: 'return=minimal,resolution=ignore-duplicates' },
      body: JSON.stringify({
        id: entry.id.slice(0, 120),
        reference: entry.reference.slice(0, 120),
        language: entry.language.slice(0, 12),
        style: entry.style.slice(0, 40),
      }),
    });
  } catch {
    // The queue is a courtesy display; the render itself is already running.
  }
}

/** Renders dispatched in the last few hours, newest first. */
export async function listQueued(hours = 3): Promise<QueuedRender[] | null> {
  try {
    const since = new Date(Date.now() - hours * 3_600_000).toISOString();
    const response = await rest(
      `scriptorium_queue?select=id,reference,language,style,created_at` +
        `&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20`,
    );
    if (!response?.ok) return null;
    const rows = (await response.json()) as Array<{
      id: string; reference: string; language: string; style: string; created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id, reference: r.reference, language: r.language,
      style: r.style, createdAt: r.created_at,
    }));
  } catch {
    return null;
  }
}
