/**
 * What this deployment can actually do right now.
 *
 * The UI reads this on load so it can tell the truth about which provider is
 * serving generation and which capabilities are missing, instead of failing
 * halfway through a run with a stack trace.
 */

import { NextResponse } from 'next/server';
import { providerStatus } from '@/lib/ai';
import { LANGUAGES, coverage, tierOf } from '@/lib/languages/registry';

export const dynamic = 'force-dynamic';

export function GET() {
  const ai = providerStatus();

  return NextResponse.json({
    ai,
    scripture: {
      configured: Boolean(process.env.YVP_APP_KEY),
      note: process.env.YVP_APP_KEY
        ? undefined
        : 'YVP_APP_KEY is not set, so Scripture cannot be retrieved. Register an app at platform.youversion.com.',
    },
    voice: {
      configured: Boolean(process.env.SPEECHMATICS_API_KEY),
      note: process.env.SPEECHMATICS_API_KEY
        ? undefined
        : 'SPEECHMATICS_API_KEY is not set, so narration falls back to the device voice.',
    },
    coverage: coverage(),
    languages: LANGUAGES.map((l) => ({
      code: l.code,
      name: l.name,
      nativeName: l.nativeName,
      script: l.script,
      dir: l.dir,
      tier: tierOf(l),
    })),
  });
}
