/**
 * Input -> passage.
 *
 * Three kinds of input, resolved in order:
 *   1. Looks like a reference ("John 3:16", "Ps 23")  -> fetch directly
 *   2. A topic or feeling ("anxiety at work")         -> ask the model for
 *      REFERENCES ONLY, then fetch each one's text from YouVersion
 *   3. Neither                                        -> report it plainly
 *
 * Case 2 is where the project's central rule is easiest to break and most
 * important to keep: the model proposes where to look, and the API says what
 * it says. No verse text ever originates from a model.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { getProvider } from '@/lib/ai';
import { getScriptureClient } from '@/lib/scripture/youversion';
import { matchFixtures } from '@/lib/scripture/fixtures';
import { parseReference } from '@/lib/scripture/usfm';
import type { Passage } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ResolveBody {
  input?: string;
  languageCode?: string;
  versionId?: number;
}

export async function POST(request: Request) {
  const limited = guard(request, 'resolve', 30);
  if (limited) return limited;

  let body: ResolveBody;
  try {
    body = (await request.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const input = (body.input ?? '').trim();
  const languageCode = body.languageCode ?? 'en';

  if (!input) {
    return NextResponse.json(
      { error: 'Type a reference, a word, or an idea.' },
      { status: 400 },
    );
  }

  // No App Key: fall back to offline fixtures rather than failing.
  //
  // The alternative — asking a model for the verse — is the one thing this
  // project will not do, so degradation means serving fewer, known-good
  // passages, clearly marked, and never inventing one.
  if (!process.env.YVP_APP_KEY) {
    return NextResponse.json({
      mode: 'fixture',
      candidates: matchFixtures(input, languageCode),
      notice:
        'Showing offline sample passages: no YouVersion App Key is configured. ' +
        'These are real published translations included with the project, not API responses, and not generated.',
    });
  }

  const scripture = getScriptureClient();

  try {
    // Choose a version for the language, unless one was pinned.
    const versionId = body.versionId ?? (await pickVersion(languageCode));
    if (!versionId) {
      return NextResponse.json(
        {
          error: `No Bible version is licensed to this app key for "${languageCode}".`,
        },
        { status: 404 },
      );
    }

    // --- 1. direct reference ---------------------------------------------
    const parsed = parseReference(input);
    if (parsed) {
      // Not every licensed version contains every book. Hebrew's first
      // version is the Tanakh, which genuinely has no John — so "John 1:1"
      // failed there while being a perfectly good reference. When the chosen
      // version lacks the passage, the language's OTHER licensed versions
      // are tried before anyone is told anything is wrong.
      const tryIds = [versionId];
      if (body.versionId === undefined) {
        try {
          const others = await scripture.listBibles(languageCode);
          for (const v of others.slice(0, 6)) {
            if (!tryIds.includes(v.id)) tryIds.push(v.id);
          }
        } catch {
          // The primary version alone will have to answer.
        }
      }
      for (const id of tryIds) {
        try {
          const passage = await scripture.getPassage(id, parsed.usfm);
          return NextResponse.json({ mode: 'reference', candidates: [passage] });
        } catch {
          // Try the next licensed version.
        }
      }
      {
        // A reference that parses is not a reference that exists. This is
        // how a model-planned series day ("Job 8:38" — Job 8 has 22 verses)
        // used to surface a raw YouVersion 404, URL and all, to someone who
        // never typed a reference in their life.
        return NextResponse.json(
          {
            error:
              `"${input}" was not found in any Bible version licensed for ` +
              'this language. The passage may not exist, or these versions ' +
              'may not include that book — the Hebrew Bible, for example, ' +
              'has no New Testament.',
          },
          { status: 404 },
        );
      }
    }

    // --- 2. topical --------------------------------------------------------
    const suggestion = await getProvider().suggestReferences(input, languageCode);

    // A purely technical/commercial topic: declined politely, never
    // proof-texted. The studio shows the note and stays on the input.
    if (suggestion.decline) {
      return NextResponse.json({
        mode: 'declined',
        candidates: [],
        declined: true,
        message: suggestion.decline,
      });
    }

    const candidates: Passage[] = [];
    for (const reference of suggestion.references.slice(0, 4)) {
      const ref = parseReference(reference);
      if (!ref) continue;
      try {
        candidates.push(await scripture.getPassage(versionId, ref.usfm));
      } catch {
        // A suggestion that does not resolve is dropped rather than surfaced;
        // the user asked for passages, not for our retry log.
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error: `Could not find passages for "${input}". Try a reference like "John 3:16", or a different word.`,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ mode: 'topical', candidates });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Upstream errors carry their request URL and raw response body, which is
    // the right thing for a log and the wrong thing for a person.
    console.error(`[resolve] ${message}`);
    const friendly = /passages|bibles|YouVersion/i.test(message)
      ? 'The Bible service could not answer just now. Please try again in a moment.'
      : message;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }
}

/** First licensed version for a language. */
async function pickVersion(languageCode: string): Promise<number | null> {
  const scripture = getScriptureClient();
  const versions = await scripture.listBibles(languageCode);
  return versions.length > 0 ? versions[0].id : null;
}
