/**
 * Reviews: read them, leave one.
 *
 * Anonymous, name-and-text, newest first. No moderation queue at this scale —
 * the honest controls are the ones that actually run: a tight per-IP rate
 * limit (three per minute is plenty for a human, useless for a script), hard
 * length caps enforced twice (here for the error message, in the schema as a
 * CHECK so a bypass of this route still cannot store junk), and plain text
 * end to end — the gallery renders review text as text, never as markup.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { addReview, feedbackConfigured, listReviews } from '@/lib/feedback/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!feedbackConfigured()) {
    return NextResponse.json({ reviews: null });
  }
  return NextResponse.json({ reviews: await listReviews() });
}

export async function POST(request: Request) {
  const limited = guard(request, 'reviews', 3);
  if (limited) return limited;

  let body: { name?: string; body?: string };
  try {
    body = (await request.json()) as { name?: string; body?: string };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  if (!feedbackConfigured()) {
    return NextResponse.json(
      { error: 'Reviews are not available on this deployment.' },
      { status: 503 },
    );
  }

  const result = await addReview(String(body.name ?? ''), String(body.body ?? ''));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
