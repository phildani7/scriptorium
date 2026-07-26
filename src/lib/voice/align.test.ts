/**
 * Alignment and WAV-header tests.
 *
 * The `wavDurationSeconds` cases pin a bug that produced a 268,435-second
 * composition from four seconds of speech: Speechmatics' TTS writes a
 * streaming WAV whose `data` chunk carries the 0xFFFFFFFF "unknown length"
 * placeholder, and trusting it silently poisons every downstream timing.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { alignScriptToAudio, wavDurationSeconds } from './align';
import type { AsrWord } from './speechmatics';

/** Build a minimal 16 kHz mono 16-bit WAV with a chosen declared data size. */
function makeWav(sampleBytes: number, declaredDataSize?: number): Uint8Array {
  const byteRate = 16000 * 2; // 16 kHz, mono, 16-bit
  const buffer = new ArrayBuffer(44 + sampleBytes);
  const view = new DataView(buffer);
  const ascii = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i += 1) view.setUint8(offset + i, s.charCodeAt(i));
  };

  ascii(0, 'RIFF');
  view.setUint32(4, 36 + sampleBytes, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 16000, true); // sample rate
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, declaredDataSize ?? sampleBytes, true);

  return new Uint8Array(buffer);
}

describe('wavDurationSeconds', () => {
  it('reads a well-formed header', () => {
    // 32000 bytes at 32000 B/s = exactly 1 second.
    assert.equal(wavDurationSeconds(makeWav(32_000)), 1);
  });

  it('ignores the 0xFFFFFFFF streaming placeholder and uses the real length', () => {
    const wav = makeWav(32_000, 0xffffffff);
    const duration = wavDurationSeconds(wav);
    assert.equal(
      duration,
      1,
      `expected 1s from actual bytes, got ${duration}s — the placeholder was trusted`,
    );
  });

  it('bounds any over-declared size by the bytes actually present', () => {
    assert.equal(wavDurationSeconds(makeWav(32_000, 999_999_999)), 1);
  });

  it('returns 0 for a non-WAV buffer', () => {
    assert.equal(wavDurationSeconds(new Uint8Array(64)), 0);
  });

  it('returns 0 for a truncated buffer rather than throwing', () => {
    assert.equal(wavDurationSeconds(new Uint8Array(8)), 0);
  });
});

describe('alignScriptToAudio', () => {
  const script = 'For God so loved the world';

  function asr(words: Array<[string, number, number]>): AsrWord[] {
    return words.map(([content, start, end]) => ({
      content,
      start,
      end,
      confidence: 1,
    }));
  }

  it('renders the script words, never the ASR words', () => {
    // ASR mishears casing and a word; neither may reach the screen.
    const result = alignScriptToAudio(
      script,
      asr([
        ['for', 0, 0.2],
        ['god', 0.2, 0.4],
        ['so', 0.4, 0.5],
        ['love', 0.5, 0.8],
        ['the', 0.8, 0.9],
        ['word', 0.9, 1.2],
      ]),
      1.2,
    );

    assert.equal(
      result.timings.map((t) => t.word).join(' '),
      script,
      'caption text must come from the script',
    );
  });

  it('uses measured times for matched words', () => {
    const result = alignScriptToAudio(
      script,
      asr([
        ['For', 0, 0.2],
        ['God', 0.2, 0.4],
        ['so', 0.4, 0.5],
        ['loved', 0.5, 0.8],
        ['the', 0.8, 0.9],
        ['world', 0.9, 1.2],
      ]),
      1.2,
    );

    assert.equal(result.matchRate, 1);
    assert.equal(result.timings[1].start, 0.2);
    assert.equal(result.timings[5].end, 1.2);
  });

  it('interpolates words ASR dropped, keeping order', () => {
    const result = alignScriptToAudio(
      script,
      asr([
        ['For', 0, 0.2],
        // "God so loved the" dropped entirely
        ['world', 0.9, 1.2],
      ]),
      1.2,
    );

    assert.equal(result.timings.length, 6);
    assert.ok(result.interpolatedCount > 0);
    for (let i = 1; i < result.timings.length; i += 1) {
      assert.ok(
        result.timings[i].start >= result.timings[i - 1].start,
        'timings must advance monotonically',
      );
    }
  });

  it('estimates a full timeline when there is no ASR at all', () => {
    const result = alignScriptToAudio(script, [], 6);
    assert.equal(result.timings.length, 6);
    assert.equal(result.matchRate, 0);
    assert.ok(result.timings[5].end <= 6);
  });

  it('never emits a timing beyond the audio duration', () => {
    const result = alignScriptToAudio(
      script,
      asr([['For', 0, 99]]), // nonsense end time
      2,
    );
    for (const t of result.timings) {
      assert.ok(t.end <= 2, `word "${t.word}" ends at ${t.end}, past the audio`);
    }
  });
});
