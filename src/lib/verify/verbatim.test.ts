/**
 * Tests for the Scripture integrity gate.
 *
 * The project's headline claim is that Scripture is retrieved, never generated.
 * These tests are what make that claim checkable rather than rhetorical: they
 * prove the gate accepts faithful rendering, and — more importantly — that it
 * fails loudly on text that has been altered, including alterations subtle
 * enough that a human proofreader would miss them.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  ScriptureIntegrityError,
  assertVerbatim,
  normalizeScripture,
  verifyVerbatim,
} from './verbatim';

// John 3:16, Berean Standard Bible (public domain).
const JHN_3_16 =
  'For God so loved the world that He gave His one and only Son, that everyone who believes in Him shall not perish but have eternal life.';

// Psalm 23:1 in Hindi (Devanagari) — the script this project is built to serve.
const PSA_23_1_HI = 'यहोवा मेरा चरवाहा है, मुझे कुछ घटी न होगी।';

describe('normalizeScripture', () => {
  it('collapses whitespace introduced by HTML layout', () => {
    const rendered = `For God so loved   the world\n  that He gave His one and only Son,\nthat everyone who believes in Him shall not perish but have eternal life.`;
    assert.equal(normalizeScripture(rendered), JHN_3_16);
  });

  it('applies NFC so decomposed Devanagari matches composed', () => {
    // Nukta letters are the Devanagari characters that genuinely have two
    // encodings: ZA is either U+095B, or U+091C (JA) followed by the combining
    // nukta U+093C. Both render identically as ज़. A browser text node may hand
    // back either form, which is exactly why the gate normalizes first.
    //
    // Written as escapes rather than literals: a source file can only store one
    // of the two forms, so a literal would silently collapse the distinction
    // this test exists to check.
    const composed = '\u095B\u093F\u0928\u094D\u0926\u0917\u0940'; // ZA + i + na + virama + da + ga + ii
    const decomposed = '\u091C\u093C\u093F\u0928\u094D\u0926\u0917\u0940'; // JA + NUKTA + ... (same word)

    assert.notEqual(
      decomposed,
      composed,
      'precondition: this string must actually have two Unicode forms',
    );
    assert.equal(normalizeScripture(decomposed), normalizeScripture(composed));
    assert.equal(verifyVerbatim(decomposed, composed).ok, true);
  });

  it('strips render artefacts but preserves ZWJ and ZWNJ', () => {
    // Soft hyphen and a bidi mark are layout artefacts and must go.
    const withArtefacts = `For God so loved­ the world‎`;
    assert.equal(normalizeScripture(withArtefacts), 'For God so loved the world');

    // ZWNJ changes how a Devanagari conjunct is shaped — it is part of the
    // text, so removing it would corrupt exactly the languages we exist for.
    const withZwnj = 'क‌ष';
    assert.ok(
      normalizeScripture(withZwnj).includes('‌'),
      'ZWNJ must survive normalization',
    );
  });
});

describe('verifyVerbatim', () => {
  it('passes when the rendered verse matches the API response', () => {
    const result = verifyVerbatim(JHN_3_16, JHN_3_16);
    assert.equal(result.ok, true);
    assert.match(result.message, /Verse verified/);
  });

  it('passes across scripts', () => {
    assert.equal(verifyVerbatim(PSA_23_1_HI, PSA_23_1_HI).ok, true);
  });

  // The cases below are the point of the whole module. Each is a plausible way
  // Scripture could drift in an AI pipeline, and each must be caught.

  it('fails on a single substituted word', () => {
    const tampered = JHN_3_16.replace('loved', 'adored');
    const result = verifyVerbatim(tampered, JHN_3_16);
    assert.equal(result.ok, false);
    assert.match(result.message, /First difference at character/);
  });

  it('fails on a dropped clause', () => {
    const tampered = JHN_3_16.replace(
      ' that everyone who believes in Him shall not perish but',
      '',
    );
    assert.equal(verifyVerbatim(tampered, JHN_3_16).ok, false);
  });

  it('fails on an appended editorial addition', () => {
    const tampered = `${JHN_3_16} (Amen.)`;
    assert.equal(verifyVerbatim(tampered, JHN_3_16).ok, false);
  });

  it('fails on a single altered Devanagari matra', () => {
    // मुझे -> मुझ : one vowel sign removed. Visually near-identical at
    // 1080x1920, and it changes the meaning.
    const tampered = PSA_23_1_HI.replace('मुझे', 'मुझ');
    const result = verifyVerbatim(tampered, PSA_23_1_HI);
    assert.equal(result.ok, false, 'a dropped matra must fail the gate');
  });

  it('fails on a swapped punctuation mark', () => {
    const tampered = PSA_23_1_HI.replace('।', '.');
    assert.equal(verifyVerbatim(tampered, PSA_23_1_HI).ok, false);
  });

  it('reports where the divergence starts', () => {
    const tampered = JHN_3_16.replace('world', 'cosmos');
    const result = verifyVerbatim(tampered, JHN_3_16);
    assert.equal(result.ok, false);
    assert.equal(result.divergenceIndex, JHN_3_16.indexOf('world'));
  });
});

describe('assertVerbatim', () => {
  it('is silent when the text matches', () => {
    assert.doesNotThrow(() => assertVerbatim(JHN_3_16, JHN_3_16));
  });

  it('throws ScriptureIntegrityError on tampered text, so a render cannot proceed', () => {
    assert.throws(
      () => assertVerbatim(JHN_3_16.replace('God', 'the universe'), JHN_3_16),
      (error: unknown) => {
        assert.ok(error instanceof ScriptureIntegrityError);
        assert.match(error.message, /Scripture integrity check failed/);
        return true;
      },
    );
  });
});

