import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { buildNarrationScript, splitSentences, TEACHING_PAGES } from './build';
import type { DeviceItem, Passage } from '@/lib/types';

/*
 * The format's one hard promise: five sentences, five pages, one on screen at
 * a time, then the verse. Everything here defends the "five" — the "one at a
 * time" is enforced in the template timeline, and the "verse" is enforced by
 * the verbatim gate.
 *
 * The model is asked for exactly five sentences and usually complies, but a
 * layout cannot be built on "usually": four pages leaves a blank beat and six
 * collides with the verse. So the reconciliation is tested, not trusted.
 */

const FIVE =
  'You check the lock twice before you leave. ' +
  'This passage says that worry is not the same as care. ' +
  'It does not promise the outcome you wanted. ' +
  'It promises you will not carry the night alone. ' +
  'Set the worry down where someone stronger can hold it.';

const PASSAGE: Passage = {
  reference: 'Psalm 46:1',
  usfm: 'PSA.46.1',
  text: 'God is our refuge and strength, an ever-present help in trouble.',
  versionId: 3034,
  versionAbbreviation: 'BSB',
  versionName: 'Berean Standard Bible',
  attribution: 'Berean Standard Bible',
  languageCode: 'en',
};

const device = (explanation: string): DeviceItem => ({
  type: 'hook',
  content: 'Everyone in this story does the sensible thing.',
  point: 'That is exactly the problem.',
  explanation,
  reference: 'Psalm 46:1',
  emoji: '🕯️',
});

test('five sentences stay five pages, in order and unaltered', () => {
  const pages = splitSentences(FIVE, TEACHING_PAGES);
  assert.equal(pages.length, 5);
  assert.match(pages[0], /^You check the lock twice/);
  assert.match(pages[4], /someone stronger can hold it\.$/);
  // Every word survives the split; nothing is dropped or reordered.
  assert.equal(pages.join(' '), FIVE.trim());
});

test('too many sentences merge down to five, keeping every word', () => {
  const seven = `${FIVE} It costs nothing to try. Tonight is a fine time.`;
  const pages = splitSentences(seven, TEACHING_PAGES);
  assert.equal(pages.length, 5);
  assert.equal(pages.join(' ').replace(/\s+/g, ' '), seven.replace(/\s+/g, ' '));
});

test('the merge takes the shortest neighbours, not the tail', () => {
  // Sentence 1 and 2 are the shortest adjacent pair, so they should join and
  // the long final sentence should survive as its own page.
  const six =
    'He left. He ran. ' +
    'The father had been watching that road for a long time. ' +
    'Nobody watches a road they have given up on. ' +
    'The son rehearsed a speech about wages and worth. ' +
    'He never got to finish it because the welcome outran the apology.';
  const pages = splitSentences(six, TEACHING_PAGES);
  assert.equal(pages.length, 5);
  assert.equal(pages[0], 'He left. He ran.');
  assert.match(pages[4], /^He never got to finish it/);
});

test('too few sentences split at a clause break to reach five', () => {
  const four =
    'You check the lock twice before you leave, and then you check it again. ' +
    'This passage says that worry is not the same as care. ' +
    'It does not promise the outcome you wanted. ' +
    'It promises you will not carry the night alone.';
  const pages = splitSentences(four, TEACHING_PAGES);
  assert.equal(pages.length, 5);
  // The comma became a full stop, and the tail — which was a clause and so
  // began lowercase — is sentence-cased, because it is now a whole page on
  // its own and a page opening mid-sentence reads as a bug.
  assert.equal(pages[0], 'You check the lock twice before you leave.');
  assert.equal(pages[1], 'And then you check it again.');
});

test('every page starts with a capital, however it was produced', () => {
  // The real defect this catches: a model returning four sentences forces a
  // clause split, and the tail of a clause is lowercase by construction.
  const four =
    'The father saw him a long way off, which means he had been watching. ' +
    'Nobody watches a road they have given up on. ' +
    'The son had a speech ready about wages and worth. ' +
    'He never finished it.';
  for (const page of splitSentences(four, TEACHING_PAGES)) {
    const first = page.charAt(0);
    assert.equal(first, first.toLocaleUpperCase(), `page starts lowercase: "${page}"`);
  }
});

test('a short teaching with no clause break is left alone rather than shredded', () => {
  // Nothing to split on, so returning three honest pages beats inventing five
  // fragments. The template simply shows the pages that exist.
  const three = 'He ran to him. He held him. He would not hear the speech.';
  const pages = splitSentences(three, TEACHING_PAGES);
  assert.ok(pages.length <= TEACHING_PAGES);
  assert.equal(pages.join(' '), three);
});

test('the danda ends a sentence in Devanagari', () => {
  const hindi = 'वह भागा। उसने उसे गले लगाया। उसने भाषण नहीं सुना।';
  assert.deepEqual(splitSentences(hindi, 3), [
    'वह भागा।',
    'उसने उसे गले लगाया।',
    'उसने भाषण नहीं सुना।',
  ]);
});

test('segments carry one teaching page each, numbered in spoken order', () => {
  const { segments } = buildNarrationScript({ device: device(FIVE), passage: PASSAGE });
  const teaching = segments.filter((s) => s.kind === 'teaching');

  assert.equal(teaching.length, 5);
  assert.deepEqual(teaching.map((s) => s.page), [0, 1, 2, 3, 4]);
  // Pages tile the narration: each starts where the previous ended.
  for (let i = 1; i < teaching.length; i += 1) {
    assert.equal(teaching[i].wordStart, teaching[i - 1].wordEnd);
  }
});

test('the verse is the sixth page, and it is verbatim', () => {
  const { segments } = buildNarrationScript({ device: device(FIVE), passage: PASSAGE });
  const kinds = segments.map((s) => s.kind);

  assert.deepEqual(kinds, [
    'device',
    'teaching', 'teaching', 'teaching', 'teaching', 'teaching',
    'verse',
    'reference',
  ]);
  // Untouched: not trimmed, not re-punctuated, not whitespace-collapsed.
  assert.equal(segments.find((s) => s.kind === 'verse')!.text, PASSAGE.text);
});

test('word indices address the assembled script exactly', () => {
  const { script, segments } = buildNarrationScript({
    device: device(FIVE),
    passage: PASSAGE,
  });
  const words = script.split(/\s+/);

  // The caption rail and the stage index into one shared timing array, so a
  // segment boundary that is off by one silently mistimes both.
  for (const segment of segments) {
    assert.equal(
      words.slice(segment.wordStart, segment.wordEnd).join(' '),
      segment.text.trim().replace(/\s+/g, ' '),
      `segment ${segment.kind} does not line up with the script`,
    );
  }
  assert.equal(segments.at(-1)!.wordEnd, words.length);
});

test('opting out of the verse leaves five pages and a citation', () => {
  const { segments } = buildNarrationScript({
    device: device(FIVE),
    passage: PASSAGE,
    includeVerse: false,
  });
  assert.equal(segments.filter((s) => s.kind === 'teaching').length, 5);
  assert.equal(segments.filter((s) => s.kind === 'verse').length, 0);
  assert.match(segments.at(-1)!.text, /^This is based on/);
});

test('a spec with no teaching keeps the old verse-display shape', () => {
  // Specs generated before the teaching format carry no explanation at all.
  // They must still build, or every short in the gallery stops rendering.
  const { segments } = buildNarrationScript({
    device: { ...device(''), explanation: undefined },
    passage: PASSAGE,
  });
  assert.deepEqual(segments.map((s) => s.kind), ['device', 'verse', 'reference']);
});
