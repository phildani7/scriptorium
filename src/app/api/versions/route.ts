/**
 * Bible versions licensed to this app key for a language, for the version
 * dropdown. The list is what YouVersion serves — nothing is invented, and
 * with no App Key configured the route degrades to an empty list so the UI
 * simply hides the control.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { getScriptureClient } from '@/lib/scripture/youversion';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const limited = guard(request, 'versions', 30);
  if (limited) return limited;

  const url = new URL(request.url);
  const languageCode = url.searchParams.get('lang') ?? 'en';

  if (!process.env.YVP_APP_KEY) {
    return NextResponse.json({ versions: [] });
  }

  try {
    const versions = await getScriptureClient().listBibles(languageCode);
    return NextResponse.json({
      versions: versions.map((v) => ({
        id: v.id,
        abbreviation: v.localizedAbbreviation || v.abbreviation,
        title: v.localizedTitle || v.title,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
