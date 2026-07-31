/**
 * Cross-check every input path and every visual mode against a running app.
 *
 *   npm run smoke:modes -- [baseUrl]
 *
 * Defaults to http://localhost:3000. Pass a deployment URL to check production.
 *
 * This exists because the modes fail INDEPENDENTLY. Topic resolution, document
 * extraction, link reading and series planning each call the model with a
 * different prompt and coerce a different shape; the three visual modes each
 * resolve pictures a different way. A change that quietly breaks one of them
 * leaves the other five working, which is precisely how it ships unnoticed.
 *
 * Every check asserts the format contract too — five teaching pages, a verse
 * page, and a verse that survived the verbatim gate — because a mode that
 * returns 200 while producing four pages is still broken.
 */

interface Check {
  name: string;
  ok: boolean;
  detail: string;
  ms: number;
}

const results: Check[] = [];
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');

async function post<T>(path: string, body: unknown, timeoutMs = 300_000): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

async function check(name: string, run: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await run();
    results.push({ name, ok: true, detail, ms: Date.now() - started });
    console.log(`  ✓ ${name} — ${detail} (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, ok: false, detail, ms: Date.now() - started });
    console.log(`  ✗ ${name} — ${detail}`);
  }
}

/* ---------------------------------------------------------------------- */

interface Spec {
  id: string;
  narration: {
    segments: Array<{ kind: string; page?: number; text: string }>;
    durationSec: number;
  };
  visuals?: { mode: string; items: Array<{ kind: string; src?: string; band?: number }> };
  device: { explanation?: string };
}

/** The format contract, asserted the same way for every path that reaches it. */
function assertShape(spec: Spec, expectVisual: string | null): string {
  const pages = spec.narration.segments.filter((s) => s.kind === 'teaching');
  if (pages.length !== 5) throw new Error(`expected 5 teaching pages, got ${pages.length}`);

  const numbered = pages.map((p) => p.page).join(',');
  if (numbered !== '0,1,2,3,4') throw new Error(`pages misnumbered: ${numbered}`);

  if (!spec.narration.segments.some((s) => s.kind === 'verse')) {
    throw new Error('no verse page');
  }

  const item = spec.visuals?.items?.[0];
  if (expectVisual === null) {
    if (spec.visuals) throw new Error(`expected no visuals, got ${spec.visuals.mode}`);
  } else if (expectVisual === 'ai') {
    if (!item || !['doodle', 'ai-image'].includes(item.kind)) {
      throw new Error(`expected a full-frame visual, got ${item?.kind ?? 'none'}`);
    }
    if (!item.band) throw new Error('full-frame visual has no band');
  } else if (expectVisual === 'free') {
    if (!spec.visuals) throw new Error('expected free-graphics visuals, got none');
  }

  const kind = item ? `${item.kind}${item.src?.startsWith('/') ? ' (reused)' : ''}` : 'text only';
  return `5 pages + verse, ${Math.round(spec.narration.durationSec)}s, ${kind}`;
}

/** Resolve a reference through the real route; the passage is never faked. */
async function resolveOne(input: string): Promise<Record<string, unknown>> {
  const resolved = await post<{
    candidates: Array<Record<string, unknown>>;
    declined?: boolean;
  }>('/api/resolve', { input, languageCode: 'en' });
  const passage = resolved.candidates?.[0];
  if (!passage) throw new Error('resolve returned no passage');
  return passage;
}

/** Compose through the real route and assert the verse survived the gate. */
async function composeSpec(
  passage: Record<string, unknown>,
  device: Record<string, unknown>,
  visualMode: 'text' | 'free' | 'ai',
): Promise<Spec> {
  const composed = await post<{ spec: Spec; verification: string }>('/api/compose', {
    passage, device, style: 'warm-minimal', visualMode, languageCode: 'en',
  });
  if (!/verified/i.test(composed.verification)) {
    throw new Error(`verse not verified: ${composed.verification}`);
  }
  return composed.spec;
}

async function makeShort(
  input: string,
  lens: string,
  visualMode: 'text' | 'free' | 'ai',
): Promise<Spec> {
  const passage = await resolveOne(input);
  const generated = await post<{ devices: Array<Record<string, unknown>> }>('/api/generate', {
    passage, lens, ageGroup: 'adult', tone: 'conversational', languageCode: 'en',
  });
  const device = generated.devices?.[0];
  if (!device) throw new Error('generate returned no devices');
  return composeSpec(passage, device, visualMode);
}

/**
 * Compose a real passage with a device written here rather than generated.
 *
 * Used where the check is about the pipeline's own wiring and the model's
 * choice of imagery would only add noise. The passage still comes from
 * YouVersion and the verbatim gate still runs — only the teaching is fixed.
 */
async function composeFixedDevice(
  input: string,
  device: Record<string, unknown>,
  visualMode: 'text' | 'free' | 'ai',
): Promise<Spec> {
  return composeSpec(await resolveOne(input), device, visualMode);
}

async function main() {
  console.log(`\nChecking ${BASE}\n`);

  const status = await fetch(`${BASE}/api/status`).then((r) => r.json());
  console.log(
    `provider: ${status.ai.active}` +
      (status.ai.glooModel ? ` (${status.ai.glooModel})` : '') +
      ` · fallback ${status.ai.fallbackReady ? 'ready' : 'NOT ready'}` +
      ` · grok ${status.visuals?.grok ? 'on' : 'off'}` +
      ` · ${status.visuals?.doodles ?? 0} panels\n`,
  );
  if (status.ai.degradedReason) console.log(`  ! ${status.ai.degradedReason}\n`);

  console.log('input paths');
  await check('topic → passage', async () => {
    const r = await post<{ candidates: Array<{ reference: string }> }>('/api/resolve', {
      input: 'anxiety at work', languageCode: 'en',
    });
    if (!r.candidates?.length) throw new Error('no candidates');
    return r.candidates.map((c) => c.reference).join(', ');
  });

  await check('reference → passage', async () => {
    const r = await post<{ candidates: Array<{ reference: string; text: string }> }>(
      '/api/resolve', { input: 'Psalm 23:1-3', languageCode: 'en' },
    );
    const first = r.candidates?.[0];
    if (!first?.text) throw new Error('no verse text');
    return `${first.reference}, ${first.text.length} chars`;
  });

  await check('pasted text → teachings', async () => {
    const r = await post<{ teachings: Array<{ summary: string }> }>('/api/extract', {
      languageCode: 'en',
      text:
        'The father in the parable does something no dignified man of that culture would do: he runs. ' +
        'Running meant lifting your robe and showing your legs, and it meant abandoning your standing ' +
        'in front of the whole village. He does it anyway, because the alternative is his son walking ' +
        'that last stretch alone under everyone\'s eyes. Grace is not only forgiveness, it is the ' +
        'willingness to lose face on behalf of the person coming home. That is what the cross looks ' +
        'like in miniature, long before anyone had words for it.',
    });
    const counts = r.teachings.map(
      (t) => t.summary.split(/(?<=[.!?])\s+/).filter((s) => s.trim()).length,
    );
    if (!r.teachings.length) throw new Error('no teachings');
    return `${r.teachings.length} teachings, sentence counts ${counts.join('/')}`;
  });

  await check('article link → teachings', async () => {
    const r = await post<{ teachings: unknown[]; notice?: string }>('/api/extract', {
      url: 'https://en.wikipedia.org/wiki/Parable_of_the_Prodigal_Son', languageCode: 'en',
    });
    if (!r.teachings.length) throw new Error('no teachings');
    return `${r.teachings.length} teachings`;
  });

  await check('YouTube link → refused', async () => {
    try {
      await post('/api/extract', {
        url: 'https://www.youtube.com/watch?v=8S0FDjFBj8o', languageCode: 'en',
      });
      throw new Error('accepted a YouTube link');
    } catch (error) {
      const message = String(error);
      if (!/not supported/i.test(message)) throw new Error(`wrong refusal: ${message}`);
      return 'refused with the transcript workaround';
    }
  });

  await check('series planning', async () => {
    const r = await post<{
      days: Array<{ day: number; reference: string; lens: string }>;
      notice?: string;
    }>('/api/series', { theme: 'learning to rest', days: 3, languageCode: 'en' });

    if (r.days.length !== 3) {
      throw new Error(`expected 3 days, got ${r.days.length}${r.notice ? ` — ${r.notice}` : ''}`);
    }
    // The creator picked a number from a dropdown; skipped or repeated day
    // numbers make the plan look broken even when the passages are good.
    const numbers = r.days.map((d) => d.day).join(',');
    if (numbers !== '1,2,3') throw new Error(`days misnumbered: ${numbers}`);

    return r.days.map((d) => `${d.reference} (${d.lens})`).join(', ');
  });

  await check('off-topic source declined', async () => {
    const r = await post<{ declined?: boolean; message?: string }>('/api/resolve', {
      input: 'VLSI test pattern generation', languageCode: 'en',
    });
    if (!r.declined) throw new Error('proof-texted a technical topic instead of declining');
    return 'declined politely';
  });

  console.log('\nvisual modes');
  await check('text only', async () =>
    assertShape(await makeShort('Hebrews 12:1', 'hook', 'text'), null));

  await check('free graphics', async () =>
    assertShape(await makeShort('Psalm 23:1', 'analogy', 'free'), 'free'));

  // Both AI branches, asserted together rather than one apiece.
  //
  // Which branch a short takes depends on the nouns the model happened to pick
  // for it, and those vary a great deal: asked to illustrate Luke 15:20, Gloo
  // will sometimes reach for a father running down a road — which the library
  // has — and sometimes for a parent waiting in a driveway beside a car, which
  // it does not. Both are good teachings. Neither is a defect.
  //
  // So the reuse leg is driven by a FIXED device rather than a generated one.
  // What has to hold is that a teaching the library genuinely covers reaches a
  // panel through the real compose route — the wiring, not the weather. The
  // generation leg stays live, because "Grok is reachable" is a claim about
  // the deployment that only a real call can settle.
  await check('AI images — reuse and generation both work', async () => {
    const covered = await composeFixedDevice(
      'Luke 15:20',
      {
        type: 'illustration',
        content:
          'A father sees his son on the road while he is still a long way off, and runs.',
        point: 'The father closes the distance the son could not.',
        explanation:
          'The son had rehearsed a speech about being unworthy. He never finished it. ' +
          'His father saw him on the road and ran, which no dignified man of that age did. ' +
          'The embrace happened before a word of the apology was spoken. ' +
          'Repentance did not buy the welcome; it only walked toward one already waiting. ' +
          'That is the shape of the whole gospel in one road and one father.',
        reference: 'Luke 15:20',
        visualTerms: ['father', 'son', 'road', 'run', 'embrace'],
      },
      'ai',
    );
    const uncovered = await makeShort('Ephesians 2:19-20', 'analogy', 'ai');

    const shapes = [assertShape(covered, 'ai'), assertShape(uncovered, 'ai')];
    const kinds = [covered, uncovered].map((s) => s.visuals?.items?.[0]?.kind);

    if (kinds[0] !== 'doodle') {
      throw new Error(
        `a teaching the library plainly covers did not reuse a panel (got ` +
          `${kinds[0]}) — the library is shipping but never being chosen`,
      );
    }
    if (kinds[1] !== 'ai-image') {
      throw new Error(
        `a teaching the library does not cover did not generate (got ` +
          `${kinds[1]}) — Grok is configured but never being reached`,
      );
    }
    return `${shapes[0]} | ${shapes[1]}`;
  });

  console.log('\nlanguages');
  await check('Hindi passage + devices', async () => {
    const resolved = await post<{ candidates: Array<Record<string, unknown>> }>('/api/resolve', {
      input: 'John 3:16', languageCode: 'hi',
    });
    const passage = resolved.candidates?.[0] as { text: string; reference: string } | undefined;
    if (!passage) throw new Error('no Hindi passage');
    if (!/[ऀ-ॿ]/.test(passage.text)) throw new Error('passage is not Devanagari');
    const generated = await post<{ devices: Array<{ content: string }> }>('/api/generate', {
      passage, lens: 'summary', ageGroup: 'adult', tone: 'conversational', languageCode: 'hi',
    });
    const device = generated.devices?.[0];
    if (!device) throw new Error('no devices');
    if (!/[ऀ-ॿ]/.test(device.content)) throw new Error('device is not in Hindi');
    return `${passage.reference}, device in Devanagari`;
  });

  console.log('\nrendering');
  await check('preview bakes with art', async () => {
    const spec = await makeShort('Luke 15:20', 'illustration', 'ai');
    const html = await fetch(`${BASE}/api/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec }),
      signal: AbortSignal.timeout(120_000),
    }).then((r) => r.text());
    if (!/data-art="1"/.test(html)) throw new Error('composition has no art layer');
    if (!/--t-art-band/.test(html)) throw new Error('composition has no sentence band');
    return `${Math.round(html.length / 1024)}KB, art layer + band present`;
  });

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} passed` +
      (failed.length ? `\n\nFAILED:\n${failed.map((f) => `  ${f.name}: ${f.detail}`).join('\n')}` : ''),
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
