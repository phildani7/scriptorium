/**
 * Passage + lens -> teaching devices.
 *
 * Returns every option the model produced rather than silently picking one.
 * That is a deliberate product decision: showing 3-7 cards, each with the
 * passage point it is anchored to, makes the quality of the generation visible
 * and keeps the human in the loop on the one part of the short that is authored
 * rather than retrieved.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { getProvider, providerStatus } from '@/lib/ai';
import type { Tradition } from '@/lib/ai';
import type { AgeGroup, DeviceType, Passage, Tone } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface GenerateBody {
  passage?: Passage;
  lens?: DeviceType;
  ageGroup?: AgeGroup;
  tradition?: Tradition;
  tone?: Tone;
  languageCode?: string;
}

export async function POST(request: Request) {
  const limited = guard(request, 'generate', 15);
  if (limited) return limited;

  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const { passage, lens, ageGroup = 'adult', tradition = 'none' } = body;

  if (!passage?.text || !passage.reference) {
    return NextResponse.json(
      { error: 'A resolved passage is required before generating.' },
      { status: 400 },
    );
  }

  try {
    const provider = getProvider();
    const result = await provider.generateDevices({
      context: {
        ageGroup,
        proficiencyLevel: 'intermediate',
        preferredLanguage: body.languageCode ?? passage.languageCode ?? 'en',
        passageReference: passage.reference,
        // The model sees the verse so it can teach from it. It is instructed,
        // and structurally prevented, from reproducing it as its own output.
        passageText: passage.text,
        versionAbbreviation: passage.versionAbbreviation,
        tone: body.tone,
      },
      filterType: lens,
      tradition,
    });

    return NextResponse.json({
      devices: result.devices,
      meta: result.meta,
      provider: providerStatus(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
