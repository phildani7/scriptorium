/**
 * Self-host a webfont for every script in the language registry.
 *
 *   node scripts/fetch-script-fonts.mjs
 *
 * The registry names a font stack per script, but naming one is not shipping
 * one. Until this script existed, only Devanagari had files on disk: every
 * other complex script — Telugu, Tamil, Malayalam, Bengali, Hebrew, Arabic,
 * Thai, Han, Hangul, Georgian, Armenian — resolved to whatever the machine
 * happened to have. On a developer's Windows box that is Nirmala UI and the
 * page looks fine; in the headless Chrome that captures the MP4 there is no
 * such fallback, and the text comes out blank. A short whose whole claim is
 * "Scripture in your own language" cannot leave that to the host.
 *
 * Google's CSS2 endpoint is asked for each family, its `src: url(...)` targets
 * are downloaded next to this repo's other faces, and the rules are rewritten
 * to point at the local copies. Re-running it is safe: files are overwritten
 * and `fonts.css` is regenerated from scratch.
 *
 * A browser User-Agent is required. Without one the endpoint serves TrueType
 * rather than woff2 — four times the bytes, for the same glyphs.
 */

import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = join(ROOT, 'public', 'fonts');

/** Chrome, so gstatic serves woff2 rather than ttf. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/**
 * One family per script, plus the Latin/UI faces the templates already used.
 *
 * Weights are the ones the templates actually set. Asking for a range the
 * stylesheet never uses would download subsets nothing renders.
 */
const FAMILIES = [
  // Latin display + body (already shipped; regenerated here so fonts.css has
  // a single generator rather than two half-histories).
  { family: 'Fraunces', axis: 'opsz,wght', value: '9..144,700', slug: 'fraunces' },
  { family: 'Archivo Black', axis: 'wght', value: '400', slug: 'archivoblack' },
  { family: 'Space Grotesk', axis: 'wght', value: '400;600;700', slug: 'spacegrotesk' },
  { family: 'Inter', axis: 'wght', value: '600', slug: 'inter' },

  // One per complex script in the registry.
  { family: 'Noto Serif Devanagari', axis: 'wght', value: '400;600;700', slug: 'notoserifdevanagari' },
  { family: 'Noto Serif Bengali', axis: 'wght', value: '400;600;700', slug: 'notoserifbengali' },
  { family: 'Noto Serif Telugu', axis: 'wght', value: '400;600;700', slug: 'notoseriftelugu' },
  { family: 'Noto Serif Tamil', axis: 'wght', value: '400;600;700', slug: 'notoseriftamil' },
  { family: 'Noto Serif Malayalam', axis: 'wght', value: '400;600;700', slug: 'notoserifmalayalam' },
  { family: 'Noto Serif Thai', axis: 'wght', value: '400;600;700', slug: 'notoserifthai' },
  { family: 'Noto Serif Hebrew', axis: 'wght', value: '400;600;700', slug: 'notoserifhebrew' },
  { family: 'Noto Serif Armenian', axis: 'wght', value: '400;600;700', slug: 'notoserifarmenian' },
  { family: 'Noto Serif Georgian', axis: 'wght', value: '400;600;700', slug: 'notoserifgeorgian' },
  { family: 'Noto Naskh Arabic', axis: 'wght', value: '400;600;700', slug: 'notonaskharabic' },
  { family: 'Noto Nastaliq Urdu', axis: 'wght', value: '400;600;700', slug: 'notonastaliqurdu' },
  // Cyrillic and Greek: one family covers both, and it is the serif companion
  // to the Latin display face rather than a system fallback.
  { family: 'Noto Serif', axis: 'wght', value: '400;600;700', slug: 'notoserif' },
  // CJK. These are large even subsetted, which is why the render bundler
  // copies only the script a given short is actually set in.
  { family: 'Noto Serif SC', axis: 'wght', value: '400;700', slug: 'notoserifsc' },
  { family: 'Noto Serif KR', axis: 'wght', value: '400;700', slug: 'notoserifkr' },
  { family: 'Noto Serif JP', axis: 'wght', value: '400;700', slug: 'notoserifjp' },
];

async function fetchCss({ family, axis, value }) {
  const url =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}` +
    `:${axis}@${value}&display=swap`;
  const response = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!response.ok) {
    throw new Error(`${family}: CSS request failed (${response.status})`);
  }
  return response.text();
}

/**
 * Rewrite every remote `src: url(...)` to a local file, downloading as it
 * goes. Subsets are numbered per family in the order the endpoint lists them,
 * which is stable, so re-running produces the same filenames.
 */
async function localize(css, slug) {
  const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)];
  const seen = new Map();
  let out = css;
  let bytes = 0;

  for (const [, remote] of urls) {
    if (seen.has(remote)) continue;
    const name = `${slug}-${seen.size}.woff2`;
    const response = await fetch(remote, { headers: { 'User-Agent': UA } });
    if (!response.ok) throw new Error(`${remote}: ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    writeFileSync(join(OUT, name), body);
    bytes += body.length;
    seen.set(remote, name);
  }

  for (const [remote, name] of seen) {
    out = out.split(remote).join(`/fonts/${name}`);
  }
  return { css: out, bytes, files: seen.size };
}

async function main() {
  mkdirSync(OUT, { recursive: true });

  // Regenerated wholesale, so stale subsets from an earlier run cannot linger
  // and be served to a unicode-range nothing else claims.
  for (const file of readdirSync(OUT)) {
    if (file.endsWith('.woff2')) unlinkSync(join(OUT, file));
  }

  const blocks = [
    '/* Generated by scripts/fetch-script-fonts.mjs — do not edit by hand.',
    ' *',
    ' * Every face the templates can ask for, self-hosted. The offline renderer',
    ' * loads compositions from file:// with no network at all, so a font that is',
    ' * merely referenced is a font that silently does not exist.',
    ' */',
    '',
  ];

  let total = 0;
  for (const entry of FAMILIES) {
    const css = await fetchCss(entry);
    const localized = await localize(css, entry.slug);
    total += localized.bytes;
    blocks.push(`/* ---- ${entry.family} ---- */`, localized.css.trim(), '');
    console.log(
      `${entry.family.padEnd(24)} ${String(localized.files).padStart(3)} subsets  ` +
        `${(localized.bytes / 1024).toFixed(0)} KB`,
    );
  }

  writeFileSync(join(OUT, 'fonts.css'), blocks.join('\n'), 'utf8');
  console.log(`\ntotal ${(total / 1024 / 1024).toFixed(1)} MB in public/fonts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
