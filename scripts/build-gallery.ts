/**
 * Render every sample spec into the shipped gallery.
 *
 *   npm run gallery            # all samples
 *   npm run gallery -- hi-john316-hook
 *
 * For each spec in samples/: render (the gate re-fetches the passage from
 * YouVersion inside render.ts), copy the MP4 into public/gallery, grab a
 * poster frame, and rebuild manifest.json. The gallery ships pre-rendered so
 * the demo never blocks on a cold service.
 */

import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { resolveMusic } from '../src/lib/theme/options';

const GALLERY = join('public', 'gallery');

function run(command: string, args: string[]): number {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const files = readdirSync('samples')
    .filter((f) => f.endsWith('.json') && f !== 'manifest.json' && !f.startsWith('.'))
    .filter((f) => (only.length === 0 ? true : only.includes(f.replace(/\.json$/, ''))));

  if (files.length === 0) {
    console.error('No sample specs found. Run `npm run samples` first.');
    process.exit(1);
  }

  mkdirSync(GALLERY, { recursive: true });
  mkdirSync('renders', { recursive: true });

  const manifestPath = join(GALLERY, 'manifest.json');
  const manifest: Array<Record<string, unknown>> = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8'))
    : [];

  const failures: string[] = [];

  for (const file of files) {
    const id = file.replace(/\.json$/, '');
    const specPath = join('samples', file);
    const outPath = join('renders', `${id}.mp4`);

    console.log(`\n=== ${id} ===`);
    const code = run('npx', [
      'tsx', '--env-file-if-exists=.env.local',
      'render/render.ts',
      '--spec', specPath,
      '--out', outPath,
      '--quality', 'high',
    ]);
    if (code !== 0) {
      failures.push(id);
      console.error(`${id}: render failed (${code})`);
      continue;
    }

    copyFileSync(outPath, join(GALLERY, `${id}.mp4`));

    const spec = JSON.parse(readFileSync(specPath, 'utf8'));
    const durationSec = Number(spec.durationSec ?? 30);

    run('ffmpeg', [
      '-y', '-ss', String(Math.max(1, durationSec * 0.66)),
      '-i', outPath, '-frames:v', '1', '-q:v', '3',
      join(GALLERY, `${id}.jpg`),
    ]);

    const entry = {
      id,
      video: `/gallery/${id}.mp4`,
      poster: existsSync(join(GALLERY, `${id}.jpg`)) ? `/gallery/${id}.jpg` : null,
      reference: spec.passage.reference,
      version: spec.passage.versionAbbreviation,
      attribution: spec.passage.attribution,
      musicCredit: resolveMusic(spec.theme).credit || undefined,
      language: spec.languageCode,
      style: spec.style,
      lens: spec.device.type,
      durationSec: Math.round(durationSec),
      timingSource: spec.narration.timingSource,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const at = manifest.findIndex((m) => m.id === id);
    if (at >= 0) manifest[at] = entry;
    else manifest.push(entry);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`gallery: ${entry.video}`);
  }

  console.log(
    `\ndone — ${manifest.length} entries, ${failures.length} failure(s)` +
      (failures.length ? `: ${failures.join(', ')}` : ''),
  );
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
