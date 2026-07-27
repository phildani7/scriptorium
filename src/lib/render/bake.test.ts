import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bakeComposition } from './bake';

/** The smallest template the bake step's replacements all match against. */
const TEMPLATE = `<!doctype html>
<div id="short" data-duration="30" data-script="latin" data-dir="ltr">
  <div class="clip" data-start="0" data-duration="30"></div>
</div>
<script id="short-spec" type="application/json">{}</script>`;

describe('bakeComposition theme attributes', () => {
  it('stamps the chosen text-motion style as data-anim', () => {
    const html = bakeComposition({
      template: TEMPLATE,
      spec: { theme: { textStyleId: 'floating' } },
    });
    assert.match(html, /data-anim="floating"/);
  });

  it('defaults to signature, including for unknown ids', () => {
    for (const theme of [undefined, { textStyleId: 'wobble' }]) {
      const html = bakeComposition({ template: TEMPLATE, spec: { theme } });
      assert.match(html, /data-anim="signature"/);
    }
  });
});
