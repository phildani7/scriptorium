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
    const provider = getProvider();

    const ask = (extra = '') =>
      provider.completeJson({
        system: buildSeriesPlanPrompt(languageName, days),
        user: `Theme: ${theme}${extra}`,
        maxTokens: 1800,
        schema: SERIES_PLAN_SCHEMA,
      });

    let plan = coerceSeriesPlan(await ask());

    // The creator picked "3 days" from a dropdown, so three is a promise, not
    // a hint. The model honours it most of the time and quietly returns two
    // the rest, which reads as the app losing a day. One retry costs a few
    // seconds and turns an occasional visible defect into a rare one.
    if (!plan.decline && plan.days.length < days) {
      const short = plan.days.length;
      const retry = coerceSeriesPlan(
        await ask(
          `\n\nIMPORTANT: your previous attempt returned only ${short} ` +
            `day${short === 1 ? '' : 's'}. Return exactly ${days}, numbered 1 to ${days}.`,
        ),
      );
      if (retry.days.length > plan.days.length) plan = retry;
    }

    if (plan.decline) {
      return NextResponse.json({ days: [], declined: true, message: plan.decline });
    }

    // Renumber after slicing: a model that skips a number leaves days 1, 2, 4,
    // and a series that visibly skips day 3 looks broken even when the
    // passages are good.
    const planned = plan.days
      .slice(0, days)
      .map((entry, index) => ({ ...entry, day: index + 1 }));

    return NextResponse.json({
      days: planned,
      notice:
        planned.length < days
          ? `Planned ${planned.length} days instead of ${days} — the model could not find ${days} distinct passages for this theme. Try a broader theme, or make the shorts you have.`
          : undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
