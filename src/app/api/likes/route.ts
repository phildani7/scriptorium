/**
 * The heart on the front page.
 *
 * GET returns the count; POST adds one. The browser only ever talks to this
 * route — the store key stays server-side, which is what makes the rate limit
 * in front of the increment mean something.
 *
 * `count: null` is a real answer, not an error: it means no store is
 * configured (a fork without the env vars) and tells the UI to hide the heart
 * rather than render a counter that can never move.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { addLike, likeCount } from '@/lib/feedback/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ count: await likeCount() });
}

export async function POST(request: Request) {
  // Generous enough for a shared office IP, tight enough that holding the
  // button down is not a strategy.
  const limited = guard(request, 'likes', 10);
  if (limited) return limited;

  const count = await addLike();
  if (count === null) {
    return NextResponse.json(
      { error: 'Likes are not available on this deployment.' },
      { status: 503 },
    );
  }
  return NextResponse.json({ count });
}
