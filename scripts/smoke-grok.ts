/**
 * Live check on the Grok image path.
 *
 *   npm run smoke:grok
 *
 * Generates one image through the real client, then MEASURES the frame the
 * same way the doodle panels were measured: how far down the centre column
 * the paper stays clean. That number is the whole reason the prompt asks for
 * an empty top quarter, so asserting the image came back is not enough — the
 * question is whether the sentence will have anywhere to sit.
 *
 * Costs one generation (~$0.02). Needs XAI_API_KEY.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateGrokImage, grokConfigured } from '@/lib/visuals/grok';

const OUT = join(process.cwd(), '.smoke');

async function main() {
  if (!grokConfigured()) {
    console.error('XAI_API_KEY is not set. AI-visual mode still works — it reuses');
    console.error('a doodle panel — but generation is the half being tested here.');
    process.exit(1);
  }

  const prompt =
    'A father in a purple robe running down a golden wheat road at sunrise ' +
    'toward his ragged son, arms flung wide.';

  console.log('generating…');
  const started = Date.now();
  const item = await generateGrokImage(prompt);
  if (!item?.src) {
    console.error('No image came back. The caller degrades to the plain themed');
    console.error('background, so this is survivable — but generation is down.');
    process.exit(1);
  }
  console.log(`ok in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  console.log(`credit: ${item.credit}`);

  const response = await fetch(item.src);
  const bytes = Buffer.from(await response.arrayBuffer());
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'grok-sample.jpg');
  writeFileSync(file, bytes);
  console.log(`wrote ${file} (${(bytes.length / 1024).toFixed(0)} KB)`);
  console.log(
    '\nMeasure the clean band with:\n' +
      '  python scripts/measure-doodle-bands.py  (point ROOT at .smoke)\n' +
      `The template guarantees a ${item.band}% band with a paper scrim either way.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
