/**
 * The render queue, as the gallery shows it: what has been dispatched
 * recently and may not have landed yet. `queue: null` means no store is
 * configured and the strip should not be drawn at all.
 */

import { NextResponse } from 'next/server';
import { feedbackConfigured, listQueued } from '@/lib/feedback/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!feedbackConfigured()) return NextResponse.json({ queue: null });
  return NextResponse.json({ queue: await listQueued() });
}
