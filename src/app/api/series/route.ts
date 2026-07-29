/**
 * Theme + day count -> a planned series of shorts.
 *
 * The plan is references and lenses only — each day's short is then made
 * through the ordinary path (resolve from YouVersion, generate devices), so a
 * series changes nothing about where Scripture comes from.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { getProvider } from '@/lib/ai';
import {
  buildSeriesPlanPrompt,
  coerceSeriesPlan,
  SERIES_PLAN_SCHEMA,
} from '@/lib/ai/provider';
import { getLanguage } from '@/lib/languages/registry';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface SeriesBody {
  theme?: string;
  days?: number;
  languageCode?: string;
}

export async function POST(request: Request) {
  const limited = guard(request, 'series', 10);
  if (limited) return limited;

  let body: SeriesBody;
  try {
    body = (await request.json()) as SeriesBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const theme = (body.theme ?? '').trim();
  const days = Math.min(14, Math.max(3, Math.round(body.days ?? 5)));
  if (!theme) {
    return NextResponse.json(
      { error: 'Give the series a theme, e.g. "anxiety" or "identity in Christ".' },
      { status: 400 },
    );
  }

  try {
    const languageName =
      getLanguage(body.languageCode ?? 'en')?.name ?? 'English';
    const raw = await getProvider().completeJson({
      system: buildSeriesPlanPrompt(languageName, days),
      user: `Theme: ${theme}`,
      maxTokens: 1800,
      schema: SERIES_PLAN_SCHEMA,
    });
    const plan = coerceSeriesPlan(raw);
    if (plan.decline) {
      return NextResponse.json({ days: [], declined: true, message: plan.decline });
    }
    return NextResponse.json({ days: plan.days.slice(0, days) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
