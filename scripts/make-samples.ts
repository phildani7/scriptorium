/**
 * Generate sample ShortSpecs for the gallery.
 *
 *   npm run samples            # all
 *   npm run samples -- hi-fear # one, by id
 *
 * Runs the real pipeline — YouVersion retrieval, device generation, script
 * assembly, narration where a server voice exists — and writes one spec JSON
 * per short to `samples/`. `render/render.mjs` turns each into an MP4.
 *
 * These are the shorts that ship pre-rendered in the gallery, so the demo never
 * depends on a cold API during judging.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getProvider } from '@/lib/ai';
import { getScriptureClient } from '@/lib/scripture/youversion';
import { parseReference } from '@/lib/scripture/usfm';
import { buildNarrationScript } from '@/lib/script/build';
import { verifyVerbatim } from '@/lib/verify/verbatim';
import { alignScriptToAudio } from '@/lib/voice/align';
import { synthesizeAndAlign } from '@/lib/voice';
import { directionFor, getLanguage } from '@/lib/languages/registry';
import type { AgeGroup, DeviceType, StyleId, VoiceId } from '@/lib/types';

interface SampleDef {
  id: string;
  languageCode: string;
  versionId: number;
  reference: string;
  lens: DeviceType;
  ageGroup: AgeGroup;
  style: StyleId;
  theme?: {
    paletteId?: string;
    fontId?: string;
    sizeId?: string;
    backgroundId?: string;
    musicId?: string;
    captions?: 'on' | 'off';
  };
  voice?: VoiceId;
}

/**
 * Chosen to span the axes a judge will look at: three languages, three
 * scripts, all three styles, several themes, all five lenses, and both the
 * measured-timing and estimated-timing paths.
 */
const SAMPLES: SampleDef[] = [
  {
    id: 'en-prodigal-hook',
    languageCode: 'en',
    versionId: 3034,
    reference: 'Luke 15:20',
    lens: 'hook',
    ageGroup: 'adult',
    style: 'warm-minimal',
    theme: { paletteId: 'parchment', fontId: 'fraunces', backgroundId: 'grain' },
    voice: { engine: 'speechmatics', model: 'theo', label: 'Theo' },
  },
  {
    id: 'en-john316-punch',
    languageCode: 'en',
    versionId: 3034,
    reference: 'John 3:16',
    lens: 'punch-line',
    ageGroup: 'youth',
    style: 'kinetic-type',
    theme: { paletteId: 'midnight', fontId: 'archivo', backgroundId: 'rays' },
    voice: { engine: 'speechmatics', model: 'sarah', label: 'Sarah' },
  },
  {
    id: 'en-psalm23-analogy',
    languageCode: 'en',
    versionId: 3034,
    reference: 'Psalm 23:1-4',
    lens: 'analogy',
    ageGroup: 'kids',
    style: 'warm-minimal',
    theme: { paletteId: 'sage', fontId: 'fraunces', backgroundId: 'mesh' },
    voice: { engine: 'speechmatics', model: 'megan', label: 'Megan' },
  },
  {
    id: 'hi-john316-hook',
    languageCode: 'hi',
    versionId: 819,
    reference: 'John 3:16',
    lens: 'hook',
    ageGroup: 'adult',
    style: 'neon-night',
    theme: { paletteId: 'plum-neon', fontId: 'grotesk', backgroundId: 'particles' },
  },
  {
    id: 'hi-isaiah41-object',
    languageCode: 'hi',
    versionId: 819,
    reference: 'Isaiah 41:10',
    lens: 'object-lesson',
    ageGroup: 'kids',
    style: 'warm-minimal',
    theme: { paletteId: 'ivory-navy', fontId: 'fraunces', backgroundId: 'grain' },
  },
  {
    id: 'es-philippians4-illustration',
    languageCode: 'es',
    versionId: 0, // resolved below
    reference: 'Philippians 4:6-7',
    lens: 'illustration',
    ageGroup: 'adult',
    style: 'neon-night',
    theme: {
      paletteId: 'ocean-glow',
      fontId: 'grotesk',
      backgroundId: 'img-nebula',
      musicId: 'beyond-the-pull',
    },
  },
  {
    id: 'en-james1-hook-kinetic',
    languageCode: 'en',
    versionId: 3034,
    reference: 'James 1:19',
    lens: 'hook',
    ageGroup: 'youth',
    style: 'kinetic-type',
    theme: { paletteId: 'crimson-gold', fontId: 'archivo', backgroundId: 'particles' },
    voice: { engine: 'speechmatics', model: 'jack', label: 'Jack' },
  },
];

async function build(def: SampleDef) {
  const scripture = getScriptureClient();

  let versionId = def.versionId;
  if (!versionId) {
    const versions = await scripture.listBibles(def.languageCode);
    if (versions.length === 0) {
      throw new Error(`No Bible version licensed for "${def.languageCode}".`);
    }
    versionId = versions[0].id;
  }

  const parsed = parseReference(def.reference);
  if (!parsed) throw new Error(`Unparseable reference "${def.reference}".`);

  const passage = await scripture.getPassage(versionId, parsed.usfm);

  const { devices } = await getProvider().generateDevices({
    context: {
      ageGroup: def.ageGroup,
      proficiencyLevel: 'intermediate',
      preferredLanguage: def.languageCode,
      passageReference: passage.reference,
      passageText: passage.text,
      versionAbbreviation: passage.versionAbbreviation,
    },
    filterType: def.lens,
  });

  const device = devices[0];
  if (!device) throw new Error('Provider returned no devices.');

  const { script, segments } = buildNarrationScript({ device, passage });

  // The gate, before anything expensive happens. Teaching-format scripts have
  // no verse segment; the render-time refetch covers provenance for those.
  const verseSeg = segments.find((s) => s.kind === 'verse');
  if (verseSeg) {
    const verification = verifyVerbatim(verseSeg.text, passage.text);
    if (!verification.ok) throw new Error(verification.message);
  }

  let audioUrl = '';
  let durationSec: number;
  let timings;
  let timingSource: 'speechmatics' | 'estimated';

  if (def.voice?.engine === 'speechmatics') {
    const result = await synthesizeAndAlign({
      script,
      languageCode: def.languageCode,
      voice: def.voice,
    });
    audioUrl = `data:audio/wav;base64,${Buffer.from(result.audio).toString('base64')}`;
    durationSec = result.durationSec;
    timings = result.timings;
    timingSource = result.timingSource;
  } else {
    const words = script.trim().split(/\s+/).length;
    durationSec = Math.max(15, Math.min(45, words / 2.6));
    timings = alignScriptToAudio(script, [], durationSec).timings;
    timingSource = 'estimated';
  }

  const entry = getLanguage(def.languageCode);

  return {
    id: def.id,
    passage,
    device,
    style: def.style,
    theme: def.theme ?? {},
    languageCode: def.languageCode,
    voice: def.voice ?? {
      engine: 'browser',
      model: def.languageCode,
      label: 'Device voice',
    },
    narration: { script, audioUrl, durationSec, timings, timingSource, segments },
    music: null,
    durationSec,
    verified: true,
    script: entry?.script ?? 'latin',
    dir: directionFor(def.languageCode),
    lens: def.lens,
    ageGroup: def.ageGroup,
  };
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const targets = only.length > 0
    ? SAMPLES.filter((s) => only.includes(s.id))
    : SAMPLES;

  mkdirSync('samples', { recursive: true });

  const manifest: Array<Record<string, unknown>> = [];

  for (const def of targets) {
    process.stdout.write(`${def.id.padEnd(32)} `);
    try {
      const spec = await build(def);
      writeFileSync(
        join('samples', `${def.id}.json`),
        `${JSON.stringify(spec, null, 2)}\n`,
        'utf8',
      );
      manifest.push({
        id: spec.id,
        reference: spec.passage.reference,
        version: spec.passage.versionAbbreviation,
        language: spec.languageCode,
        lens: def.lens,
        style: spec.style,
        durationSec: Math.round(spec.durationSec),
        timingSource: spec.narration.timingSource,
      });
      console.log(
        `ok  ${spec.passage.reference} · ${Math.round(spec.durationSec)}s · ${spec.narration.timingSource}`,
      );
    } catch (error) {
      console.log(`FAILED  ${(error as Error).message}`);
    }
  }

  writeFileSync(
    join('samples', 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  console.log(`\nwrote ${manifest.length} spec(s) to samples/`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
