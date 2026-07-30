import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { readReferenceResponse } from './provider';

/*
 * A model asked for passages on "VLSI test pattern generation" is supposed to
 * decline. The prompt gives it a JSON shape for that, and it often ignores the
 * shape and simply writes the refusal — which is the right behaviour in the
 * wrong wrapper.
 *
 * Reading that as a malformed response was wrong twice: the creator saw an
 * error where the model had behaved correctly, and once a live Claude fallback
 * existed, a perfect Gloo decline looked like a Gloo outage and spent a second
 * API call to obtain the same refusal.
 */

test('the documented JSON shape still wins', () => {
  const result = readReferenceResponse(
    '{"references":["Psalm 23:1-4","John 14:27"]}',
  );
  assert.deepEqual(result.references, ['Psalm 23:1-4', 'John 14:27']);
  assert.equal(result.decline, undefined);
});

test('a fenced JSON block is still read', () => {
  const result = readReferenceResponse(
    'Here you go:\n```json\n{"references":["Romans 8:28"]}\n```',
  );
  assert.deepEqual(result.references, ['Romans 8:28']);
});

test('a declared decline is passed through', () => {
  const result = readReferenceResponse(
    '{"references":[],"decline":"This tool creates Scripture shorts about faith and life."}',
  );
  assert.deepEqual(result.references, []);
  assert.match(result.decline ?? '', /Scripture shorts/);
});

test('a decline written as prose is read as a decline', () => {
  // Verbatim from Gloo on the live deployment.
  const prose =
    'This tool creates Scripture shorts related to faith, feelings, and life ' +
    'situations — things like worry, doubt, work stress, or longing for ' +
    'guidance. VLSI testing is a technical engineering subject.';
  const result = readReferenceResponse(prose);
  assert.deepEqual(result.references, []);
  assert.equal(result.decline, prose);
});

test('a mangled reference list is still an error', () => {
  // Contains a citation, so it is a broken answer rather than a refusal, and
  // silently reporting "declined" would hide a real formatting failure.
  assert.throws(() =>
    readReferenceResponse('Sure! Try Psalm 23:1-4 and also John 14:27.'),
  );
});

test('a long unparseable response is still an error', () => {
  assert.throws(() => readReferenceResponse('lorem ipsum '.repeat(80)));
});

test('an empty response is still an error', () => {
  assert.throws(() => readReferenceResponse('   '));
});
