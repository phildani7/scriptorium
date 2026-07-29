import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { DeviceItem, Narration } from '@/lib/types';
import { buildVisuals, matchIcons } from './match';

function narrationOf(words: string[], kind: 'device' | 'teaching' = 'teaching'): Narration {
  const timings = words.map((word, i) => ({ word, start: i, end: i + 0.8 }));
  return {
    script: words.join(' '),
    audioUrl: '',
    durationSec: words.length,
    timings,
    timingSource: 'estimated',
    segments: [{ kind, text: words.join(' '), wordStart: 0, wordEnd: words.length }],
  };
}

const device: DeviceItem = {
  type: 'hook',
  content: 'x',
  point: 'x',
  reference: 'John 3:16',
  emoji: '🌙',
  visualTerms: ['mountain', 'storm'],
};

describe('matchIcons', () => {
  it('anchors a visual term to the moment its word is spoken', () => {
    const items = matchIcons(device, narrationOf(['the', 'climb', 'up', 'the', 'mountain', 'begins']));
    const mountain = items.find((i) => i.term === 'mountain');
    assert.ok(mountain, 'mountain visual matched');
    assert.equal(mountain.timeSec, 4); // word index 4
    // Full-colour clipart outranks the line icon for a term both libraries know.
    assert.equal(mountain.kind, 'clipart');
    assert.ok(mountain.src?.startsWith('/cliparts/'));
  });

  it('spreads unspoken terms across the window instead of dropping them', () => {
    const items = matchIcons(device, narrationOf(['पहाड़', 'पर', 'चढ़ाई', 'शुरू', 'होती', 'है']));
    assert.ok(items.length >= 1);
    for (const item of items) {
      assert.ok(item.timeSec >= 0 && item.timeSec <= 5);
    }
  });

  it('never stacks two visuals within 1.2 seconds', () => {
    const items = matchIcons(
      { ...device, visualTerms: [] },
      narrationOf(['storm', 'mountain', 'anchor', 'fire', 'seed']),
    );
    const times = items.map((i) => i.timeSec).sort((a, b) => a - b);
    for (let i = 1; i < times.length; i += 1) {
      assert.ok(times[i] - times[i - 1] > 1.2);
    }
  });

  it('is deterministic', () => {
    const n = narrationOf(['storm', 'x', 'x', 'mountain', 'x', 'x', 'anchor']);
    assert.deepEqual(matchIcons(device, n), matchIcons(device, n));
  });
});

describe('buildVisuals', () => {
  it('returns undefined for text mode', () => {
    assert.equal(buildVisuals('text', device, narrationOf(['mountain'])), undefined);
  });

  it('puts extras (hero image) first', () => {
    const hero = { kind: 'ai-image' as const, src: 'https://x/y.png', term: 'ai', timeSec: 2, slot: 0 };
    const visuals = buildVisuals('ai', device, narrationOf(['the', 'x', 'y', 'mountain']), [hero]);
    assert.ok(visuals);
    assert.equal(visuals.items[0].kind, 'ai-image');
    assert.equal(visuals.mode, 'ai');
  });
});
