/**
 * Live smoke test for the voice pipeline.
 *
 *   npm run smoke:voice
 *
 * Synthesizes narration with Speechmatics, transcribes it back for word
 * timings, and aligns those timings onto the ORIGINAL script.
 *
 * The assertion at the end is the point: the rendered words must be the script's
 * words, not the transcriber's. Speechmatics reliably hears "he" where the
 * Berean Standard Bible says "He", so if the caption text came from ASR that
 * difference would appear on screen, under a verse, as altered Scripture.
 */

import { writeFileSync } from 'node:fs';
import { getSpeechmatics } from '@/lib/voice/speechmatics';
import { alignScriptToAudio, wavDurationSeconds } from '@/lib/voice/align';

// Device sentence + verbatim BSB verse, as the narration would actually run.
const SCRIPT =
  'Everyone in this story does the sensible thing. That is exactly the problem. ' +
  'For God so loved the world that He gave His one and only Son, ' +
  'that everyone who believes in Him shall not perish but have eternal life. ' +
  'John 3:16.';

async function main() {
  const speechmatics = getSpeechmatics();

  console.log('1/3  synthesizing narration (Speechmatics TTS, voice: theo)...');
  const audio = await speechmatics.synthesize(SCRIPT, 'theo');
  const duration = wavDurationSeconds(audio);
  console.log(`     ${audio.byteLength.toLocaleString()} bytes, ${duration.toFixed(2)}s\n`);

  writeFileSync('scripts/.out-narration.wav', audio);

  console.log('2/3  transcribing for word timings (Speechmatics batch ASR)...');
  const words = await speechmatics.transcribe(audio, 'en');
  console.log(`     ${words.length} words heard\n`);

  console.log('3/3  aligning ASR timings onto the original script...');
  const aligned = alignScriptToAudio(SCRIPT, words, duration);
  console.log(
    `     match rate ${(aligned.matchRate * 100).toFixed(1)}%  ` +
      `(${aligned.interpolatedCount} of ${aligned.timings.length} interpolated)\n`,
  );

  console.log('   caption timeline');
  console.log('   ----------------');
  for (const t of aligned.timings) {
    const bar = '#'.repeat(Math.max(1, Math.round((t.end - t.start) * 25)));
    console.log(
      `   ${t.start.toFixed(2).padStart(6)}s ${t.word.padEnd(14)} ${bar}`,
    );
  }

  // --- the assertion that matters -----------------------------------------
  const rendered = aligned.timings.map((t) => t.word).join(' ');
  const asrHeard = words.map((w) => w.content).join(' ');

  console.log('\n   what ASR heard   :', asrHeard.slice(0, 90), '...');
  console.log('   what we render   :', rendered.slice(0, 90), '...');

  if (rendered !== SCRIPT.split(/\s+/).join(' ')) {
    throw new Error(
      'FAIL: rendered caption text drifted from the script.\n' +
        `  script  : ${SCRIPT}\n  rendered: ${rendered}`,
    );
  }

  const asrLowercasedHim = /\bhe gave his\b/.test(asrHeard);
  console.log(
    `\n   ASR lowercased "He gave His": ${asrLowercasedHim ? 'yes' : 'no'}` +
      `${asrLowercasedHim ? '  <- and we correctly ignored it' : ''}`,
  );
  console.log('   PASS: caption text is byte-identical to the script.');
}

main().catch((error) => {
  console.error('\nVOICE SMOKE TEST FAILED');
  console.error(error);
  process.exit(1);
});
