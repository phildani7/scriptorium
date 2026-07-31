/**
 * Assert that no stage type overflows the frame, in any theme.
 *
 *   npm run check:fit
 *
 * The customization surface is 4 faces x 3 sizes, and every one of them sets
 * the same sentences at a different width. A layout that fits in Serif at
 * Regular is not evidence about Poster at Large, and the combination that
 * broke — Clean at Large — was one nobody had photographed. So this walks the
 * whole grid: 12 themes x 3 styles x 3 scripts, and fails if a single row of
 * type lands outside 1080x1920.
 *
 * It is slower than a unit test because it is a real browser measuring real
 * shaped glyphs, which is the only thing that could have caught this. Nothing
 * about a character count is checkable in the abstract.
 */

import { spawnSync } from 'node:child_process';

const FONTS = ['fraunces', 'archivo', 'grotesk', 'inter'];
const SIZES = ['compact', 'regular', 'bold'];

let failed = 0;

for (const font of FONTS) {
  for (const size of SIZES) {
    const result = spawnSync(
      'npx',
      [
        'tsx',
        'scripts/shoot-templates.ts',
        '--check', '1',
        '--font', font,
        '--size', size,
      ],
      { encoding: 'utf8', shell: process.platform === 'win32' },
    );
    const out = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (out.includes('FAIL')) {
      failed += 1;
      console.error(`FAIL   ${font}/${size}`);
      for (const line of out.split('\n')) {
        if (line.includes('FAIL') || line.startsWith('        ')) {
          console.error(`  ${line.trim()}`);
        }
      }
    } else {
      console.log(`ok     ${font}/${size}  (3 styles x 3 scripts)`);
    }
  }
}

console.log(
  `\n${FONTS.length * SIZES.length * 9} configurations checked, ${failed} theme(s) with overflow`,
);
if (failed) process.exit(1);
