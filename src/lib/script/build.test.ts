import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { spokenReference } from './build';

// The user-reported bug: TTS reading "Psalm 46:1" as "forty-six one" or a
// timestamp. The narrated segment must spell the citation out.

test('english single verse gets chapter/verse words', () => {
  assert.equal(spokenReference('Psalm 46:1', 'en'), 'Psalm 46, verse 1');
});

test('english range gets "verses X to Y"', () => {
  assert.equal(
    spokenReference('Philippians 4:6-7', 'en'),
    'Philippians 4, verses 6 to 7',
  );
});

test('english is the default language', () => {
  assert.equal(spokenReference('Hebrews 12:2'), 'Hebrews 12, verse 2');
});

test('numbered books keep their number', () => {
  assert.equal(spokenReference('1 John 4:19', 'en'), '1 John 4, verse 19');
});

test('non-english gets pause commas, no english words', () => {
  assert.equal(spokenReference('भजन संहिता 46:1', 'hi'), 'भजन संहिता 46, 1');
  assert.equal(spokenReference('Filipenses 4:6-7', 'es'), 'Filipenses 4, 6, 7');
});

test('unparseable references fall back to punctuation swap', () => {
  assert.equal(spokenReference('Jude 3', 'en'), 'Jude 3');
});
