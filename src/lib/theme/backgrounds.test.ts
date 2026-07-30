import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { BACKGROUNDS, resolveTheme } from './options';
import { bakeComposition } from '@/lib/render/bake';
import { readFileSync } from 'node:fs';

/*
 * Seventy backgrounds, each with a file the picker promises and a file the
 * renderer loads. A typo in either is invisible until a creator picks that one
 * tile and gets a blank frame, so the whole set is checked rather than a
 * sample.
 */

const PUBLIC = join(process.cwd(), 'public');
const shipped = (path: string) => existsSync(join(PUBLIC, path.replace(/^\//, '')));

test('every background ships the asset it names', () => {
  for (const bg of BACKGROUNDS) {
    if (bg.src) assert.ok(shipped(bg.src), `${bg.id}: missing src ${bg.src}`);
  }
});

test('every background ships a thumbnail for the picker', () => {
  // The picker is now pictures. A background with no thumbnail is a hole in
  // the grid that a creator cannot tell from a very plain background.
  for (const bg of BACKGROUNDS) {
    assert.ok(bg.thumb, `${bg.id}: no thumb`);
    assert.ok(shipped(bg.thumb!), `${bg.id}: missing thumb ${bg.thumb}`);
  }
});

test('ids are unique and grouped', () => {
  const seen = new Set<string>();
  for (const bg of BACKGROUNDS) {
    assert.ok(!seen.has(bg.id), `duplicate background id ${bg.id}`);
    seen.add(bg.id);
    assert.ok(
      ['texture', 'doodle', 'image', 'video'].includes(bg.group),
      `${bg.id}: unknown group ${bg.group}`,
    );
  }
});

test('an unknown background id falls back rather than throwing', () => {
  // Old specs in the gallery name backgrounds that have since been removed —
  // the NASA photos, for instance. Rendering one must not explode.
  const resolved = resolveTheme({ backgroundId: 'photo-starfield' });
  assert.ok(resolved.background, 'expected a fallback background');
});

test('video backgrounds bake for the browser and for the render bundle', () => {
  const template = readFileSync(
    join(process.cwd(), 'templates', 'warm-minimal', 'index.html'),
    'utf8',
  );
  const spec = {
    id: 'x',
    passage: {
      reference: 'Psalm 23:1', usfm: 'PSA.23.1', text: 'x', versionId: 3034,
      versionAbbreviation: 'BSB', versionName: 'BSB', attribution: 'BSB', languageCode: 'en',
    },
    durationSec: 20,
    narration: { durationSec: 20, audioUrl: '' },
  };

  for (const bg of BACKGROUNDS.filter((b) => b.kind === 'video')) {
    const theme = { backgroundId: bg.id };

    // The browser serves assets from the origin, so paths stay root-relative.
    const web = bakeComposition({ template, spec: { ...spec, theme } });
    assert.match(web, /data-bg="video"/, `${bg.id}: web bake lost data-bg`);
    assert.ok(web.includes(`src="${bg.src}"`), `${bg.id}: web bake lost the clip`);

    // The renderer serves from file://, so they must become plain relative —
    // and the element itself must survive, or the loop silently never plays.
    const bundle = bakeComposition({
      template, spec: { ...spec, theme }, assetPrefix: '', audioSrc: '',
    });
    assert.ok(
      bundle.includes(`src="${bg.src!.replace(/^\//, '')}"`),
      `${bg.id}: bundle bake did not rebase the clip`,
    );
    assert.match(bundle, /id="bg-video"/, `${bg.id}: bundle dropped the video element`);
  }
});
