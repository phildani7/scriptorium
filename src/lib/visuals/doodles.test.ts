import { strict as assert } from 'node:assert';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  DOODLE_PANELS,
  MIN_BAND,
  doodleVisual,
  matchDoodle,
} from './doodles';
import type { DeviceItem } from '@/lib/types';

const device = (overrides: Partial<DeviceItem> = {}): DeviceItem => ({
  type: 'analogy',
  content: 'A placeholder opening line.',
  point: 'A placeholder point.',
  explanation: 'A placeholder teaching.',
  reference: 'Psalm 46:1',
  emoji: '🕯️',
  ...overrides,
});

test('every catalogued panel actually ships', () => {
  // The catalogue is hand-written and the files are copied in separately, so
  // a typo in a path would only surface as a missing background at render.
  for (const panel of DOODLE_PANELS) {
    const file = join(process.cwd(), 'public', panel.src.replace(/^\//, ''));
    assert.ok(existsSync(file), `missing panel file: ${panel.src}`);
  }
});

test('the catalogue is internally consistent', () => {
  const ids = new Set<string>();
  for (const panel of DOODLE_PANELS) {
    assert.ok(!ids.has(panel.id), `duplicate panel id: ${panel.id}`);
    ids.add(panel.id);
    assert.match(panel.paper, /^#[0-9a-f]{6}$/i, `${panel.id} paper`);
    assert.ok(panel.band >= 0 && panel.band <= 100, `${panel.id} band`);
    assert.ok(panel.tags.length >= 4, `${panel.id} needs enough tags to match on`);
    assert.ok(panel.description.length > 20, `${panel.id} description`);
  }
});

test('a strong visualTerms hit finds its panel', () => {
  const match = matchDoodle(device({ visualTerms: ['pig', 'mud', 'hunger'] }));
  assert.ok(match);
  assert.equal(match.panel.id, 'prodigal-2');
});

test('a teaching with no drawable overlap gets no panel', () => {
  // The honest answer is "generate one", not "use whatever scored highest".
  // A wrong picture actively misteaches, so a near-miss must not pass.
  const match = matchDoodle(
    device({
      visualTerms: ['spreadsheet', 'mortgage', 'algorithm'],
      content: 'Quarterly reconciliation deadlines.',
      point: 'Nothing drawable here.',
      explanation: 'Nothing drawable here either.',
    }),
  );
  assert.equal(match, null);
});

test('English prose alone is too weak to earn a panel', () => {
  // visualTerms are the model's own nouns for this teaching and score 3;
  // words merely present in the prose score 1 and cannot reach the floor on
  // their own. Otherwise a stray "light" or "hand" would pick a picture.
  const match = matchDoodle(
    device({
      visualTerms: [],
      content: 'He reached out a hand.',
      point: 'A hand, and nothing else to go on.',
      explanation: 'Just a hand.',
    }),
  );
  assert.equal(match, null);
});

test('matching is deterministic', () => {
  const d = device({ visualTerms: ['boat', 'storm', 'wave'] });
  const first = matchDoodle(d);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(matchDoodle(d)?.panel.id, first?.panel.id);
  }
});

test('a text-free panel wins a tie against one with baked-in text', () => {
  // 'donkey-0' (no text) and 'donkey-1' (a "HMPH!" bubble) both carry the
  // 'donkey' and 'road' tags. English lettering under a Hindi sentence reads
  // as a mistake, so the clean panel has to win.
  const match = matchDoodle(device({ visualTerms: ['donkey', 'road'] }));
  assert.ok(match);
  assert.equal(match.panel.hasText, false);
  assert.equal(match.panel.id, 'donkey-0');
});

test('a matched panel becomes a full-frame visual with a usable band', () => {
  const panel = DOODLE_PANELS.find((p) => p.id === 'psalm22-0')!;
  const visual = doodleVisual(panel, 0);

  assert.equal(visual.kind, 'doodle');
  assert.equal(visual.src, panel.src);
  assert.equal(visual.paper, panel.paper);
  // psalm22 is full-bleed (2%): the floor is what makes the sentence legible,
  // via the scrim the template lays over it.
  assert.equal(visual.band, MIN_BAND);
  assert.ok(visual.credit);
});

test('a panel with a wide natural band keeps it', () => {
  const panel = DOODLE_PANELS.find((p) => p.id === 'prodigal-4')!;
  assert.equal(doodleVisual(panel, 0).band, panel.band);
  assert.ok(panel.band > MIN_BAND);
});
