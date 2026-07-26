/**
 * Reference-parser tests.
 *
 * The range-format cases are the important ones. The YouVersion Platform API
 * accepts `PSA.27.1-3` and rejects the fully-qualified `PSA.27.1-PSA.27.3`
 * with a **404** — which reads as "no such passage", not "bad syntax". That
 * shape of bug silently empties the topical-search path while every single
 * verse lookup keeps working, so it is pinned here.
 *
 * Verified against the live API on 2026-07-26.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { looksLikeReference, parseReference } from './usfm';

describe('parseReference — single verses', () => {
  it('parses a plain reference', () => {
    assert.equal(parseReference('John 3:16')?.usfm, 'JHN.3.16');
  });

  it('parses common abbreviations', () => {
    assert.equal(parseReference('Jn 3:16')?.usfm, 'JHN.3.16');
    assert.equal(parseReference('Ps 23')?.usfm, 'PSA.23');
    assert.equal(parseReference('Rom 8:28')?.usfm, 'ROM.8.28');
  });

  it('parses numbered books', () => {
    assert.equal(parseReference('1 Cor 13:4')?.usfm, '1CO.13.4');
    assert.equal(parseReference('2Tim 1:7')?.usfm, '2TI.1.7');
    assert.equal(parseReference('1 Peter 5:7')?.usfm, '1PE.5.7');
  });

  it('tolerates missing spaces and odd separators', () => {
    assert.equal(parseReference('john3:16')?.usfm, 'JHN.3.16');
    assert.equal(parseReference('John 3.16')?.usfm, 'JHN.3.16');
  });
});

describe('parseReference — ranges', () => {
  it('emits the short range form the Platform API accepts', () => {
    assert.equal(parseReference('Psalm 27:1-3')?.usfm, 'PSA.27.1-3');
    assert.equal(parseReference('1 Peter 5:6-7')?.usfm, '1PE.5.6-7');
  });

  it('never emits the fully-qualified form, which the API 404s', () => {
    for (const input of ['Psalm 27:1-3', 'PSA.27.1-PSA.27.3', 'Ps 27:1 - 3']) {
      const usfm = parseReference(input)?.usfm;
      assert.ok(usfm, `expected "${input}" to parse`);
      assert.doesNotMatch(
        usfm,
        /-[A-Z1-3]{3}\./,
        `"${input}" produced the rejected fully-qualified range "${usfm}"`,
      );
    }
  });

  it('normalises a fully-qualified range on input', () => {
    assert.equal(parseReference('PSA.23.1-PSA.23.4')?.usfm, 'PSA.23.1-4');
  });

  it('normalises en and em dashes', () => {
    assert.equal(parseReference('Psalm 27:1–3')?.usfm, 'PSA.27.1-3');
    assert.equal(parseReference('Psalm 27:1—3')?.usfm, 'PSA.27.1-3');
  });

  it('collapses a range that spans one verse', () => {
    assert.equal(parseReference('John 3:16-16')?.usfm, 'JHN.3.16');
  });

  it('rejects a backwards range', () => {
    assert.equal(parseReference('Psalm 27:5-2'), null);
  });
});

describe('parseReference — display form', () => {
  it('renders a canonical human-readable reference', () => {
    assert.equal(parseReference('ps 23:1-4')?.display, 'Psalm 23:1-4');
    assert.equal(parseReference('1cor 13')?.display, '1 Corinthians 13');
  });
});

describe('looksLikeReference', () => {
  it('accepts references', () => {
    assert.equal(looksLikeReference('John 3:16'), true);
    assert.equal(looksLikeReference('Psalm 23'), true);
  });

  it('rejects topics, so they route to search instead', () => {
    for (const topic of ['anxiety at work', 'forgiveness', 'fear', '']) {
      assert.equal(
        looksLikeReference(topic),
        false,
        `"${topic}" should not parse as a reference`,
      );
    }
  });
});
