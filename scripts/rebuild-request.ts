/**
 * Reconstruct a render request for an existing gallery entry and hand it to
 * render-request.ts — used to re-render a short whose original request is gone
 * (CI runners keep nothing), e.g. after a bake or voice fix.
 *
 *   npx tsx --env-file-if-exists=.env.local scripts/rebuild-request.ts \
 *     --id short-HEB.12.2-warm-minimal-ms1zv20c \
 *     --reference "Hebrews 12:2" --version-abbr ASV \
 *     --style kinetic-type --lens analogy --language en --voice theo
 *
 * The verse is re-fetched from YouVersion and the device is re-generated, so
 * the wording of the hook line may differ from the original — the Scripture
 * never does.
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { getProvider } from '@/lib/ai';
import { parseReference } from '@/lib/scripture/usfm';
import { getScriptureClient } from '@/lib/scripture/youversion';
import { directionFor, getLanguage } from '@/lib/languages/registry';
import type { AgeGroup, DeviceType } from '@/lib/types';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const id = arg('id');
  const reference = arg('reference');
  if (!id || !reference) throw new Error('--id and --reference are required');

  const versionAbbr = arg('version-abbr') ?? 'BSB';
  const style = arg('style') ?? 'warm-minimal';
  const lens = (arg('lens') ?? 'hook') as DeviceType;
  const languageCode = arg('language') ?? 'en';
  const ageGroup = (arg('age') ?? 'adult') as AgeGroup;
  const voiceModel = arg('voice');

  const scripture = getScriptureClient();
  const versions = await scripture.listBibles(languageCode);
  const version = versions.find((v) => v.abbreviation === versionAbbr) ?? versions[0];
  if (!version) throw new Error(`No Bible version for "${languageCode}".`);

  const parsed = parseReference(reference);
  if (!parsed) throw new Error(`Unparseable reference "${reference}".`);

  const passage = await scripture.getPassage(version.id, parsed.usfm);

  const { devices } = await getProvider().generateDevices({
    context: {
      ageGroup,
      proficiencyLevel: 'intermediate',
      preferredLanguage: languageCode,
      passageReference: passage.reference,
      passageText: passage.text,
      versionAbbreviation: passage.versionAbbreviation,
    },
    filterType: lens,
  });
  const device = devices[0];
  if (!device) throw new Error('Provider returned no devices.');

  const entry = getLanguage(languageCode);
  const request = {
    id,
    style,
    theme: JSON.parse(arg('theme') ?? '{}'),
    languageCode,
    voice: voiceModel
      ? { engine: 'speechmatics', model: voiceModel, label: voiceModel }
      : undefined,
    passage,
    device,
    script: entry?.script ?? 'latin',
    dir: directionFor(languageCode),
  };

  mkdirSync('.render-tmp', { recursive: true });
  const requestPath = join('.render-tmp', `${id}.request.json`);
  writeFileSync(requestPath, `${JSON.stringify(request, null, 2)}\n`, 'utf8');
  console.log(`request     ${requestPath} (${passage.reference}, ${version.abbreviation})`);

  const result = spawnSync(
    'npx',
    ['tsx', '--env-file-if-exists=.env.local', 'scripts/render-request.ts', '--request', requestPath],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
