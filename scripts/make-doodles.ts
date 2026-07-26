/**
 * Generate the doodle background set: 10 hand-drawn-style SVG frames with
 * motifs around the edges and a clear center for text.
 *
 *   npx tsx scripts/make-doodles.ts
 *
 * SVG instead of raster, deliberately: the files are ~4 KB not ~2 MB, crisp
 * at any resolution, license-free (authored here), and — because templates
 * apply them as a CSS mask on a palette-colored layer — the doodles take on
 * whatever ink color the selected palette uses. A baked PNG can't do that.
 *
 * Determinism matters even here: layouts come from a seeded PRNG so the
 * files are reproducible; regenerating never silently changes the gallery.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 1080;
const H = 1920;

/**
 * Motif library. Each motif is drawn in a local ~100x100 box centered on the
 * origin, stroke-only with round caps — the wobble is drawn into the path
 * data itself. White strokes: the SVG is consumed as an alpha mask, so only
 * coverage matters, never color.
 */
const MOTIFS: Record<string, string> = {
  cross: 'M 0 -34 C 2 -20 1 -6 1 8 C 1 20 0 30 -1 36 M -22 -8 C -12 -9 -2 -9 8 -8 C 14 -8 19 -8 23 -9',
  star: 'M 0 -30 C 2 -18 4 -10 7 -7 C 12 -4 20 -2 28 -1 C 19 3 12 6 8 9 C 5 14 3 22 1 30 C -2 21 -5 13 -8 9 C -13 5 -21 2 -28 0 C -20 -3 -12 -5 -8 -8 C -4 -12 -2 -20 0 -30 Z',
  sparkle: 'M 0 -16 C 1 -8 2 -3 4 -1 C 7 1 12 2 16 2 C 11 4 7 6 4 8 C 2 11 1 15 0 19 C -1 13 -3 8 -5 6 C -8 4 -12 3 -16 2 C -11 0 -7 -2 -4 -4 C -2 -7 -1 -11 0 -16 Z',
  heart: 'M 0 24 C -10 12 -24 2 -26 -10 C -27 -20 -20 -27 -12 -26 C -6 -25 -2 -20 0 -14 C 2 -21 7 -26 13 -26 C 21 -26 28 -19 26 -9 C 23 3 10 13 0 24 Z',
  leafSprig: 'M -30 34 C -14 12 6 -10 32 -32 M -18 16 C -22 6 -22 -2 -16 -8 C -6 -10 0 -6 2 4 C -4 12 -12 16 -18 16 Z M 4 -8 C 0 -18 2 -26 8 -30 C 18 -32 24 -26 24 -18 C 18 -10 10 -8 4 -8 Z',
  swirl: 'M -28 6 C -18 -14 4 -22 18 -12 C 28 -4 26 10 14 14 C 4 17 -4 10 -2 2 C 0 -4 8 -6 12 -2',
  dove: 'M -30 4 C -18 -6 -4 -10 8 -8 C 4 -16 6 -24 14 -28 C 12 -20 14 -14 20 -10 C 28 -8 34 -8 38 -10 C 34 -2 26 4 16 6 C 6 16 -8 18 -22 12 C -18 16 -12 20 -6 22 C -16 24 -26 18 -30 4 Z',
  oliveBranch: 'M -34 18 C -12 8 12 -2 34 -16 M -20 12 C -24 4 -22 -2 -16 -4 C -10 -4 -8 2 -10 8 Z M 0 2 C -4 -6 -2 -12 4 -14 C 10 -14 12 -8 10 -2 Z M 20 -8 C 16 -16 18 -22 24 -24 C 30 -24 32 -18 30 -12 Z',
  fish: 'M -30 0 C -18 -14 0 -18 16 -10 C 22 -6 26 -2 28 2 C 22 8 12 12 0 12 C -12 12 -24 8 -30 0 Z M 28 2 C 34 -4 38 -10 40 -16 C 38 -6 38 4 40 12 C 36 8 32 5 28 2 M -14 -2 C -13 -1 -13 0 -14 1',
  wave: 'M -40 6 C -32 -4 -24 -4 -16 4 C -8 12 0 12 8 4 C 16 -4 24 -4 32 4 C 36 8 40 8 42 6',
  sunBurst: 'M 0 0 m -14 0 C -14 -8 -8 -14 0 -14 C 8 -14 14 -8 14 0 C 14 8 8 14 0 14 C -8 14 -14 8 -14 0 Z M 0 -24 C 1 -28 1 -32 0 -36 M 17 -17 C 20 -20 23 -23 25 -26 M 24 0 C 28 -1 32 -1 36 0 M 17 17 C 20 20 23 23 26 25 M 0 24 C 1 28 1 32 0 36 M -17 17 C -20 20 -23 23 -25 26 M -24 0 C -28 1 -32 1 -36 0 M -17 -17 C -20 -20 -23 -23 -26 -25',
  cloud: 'M -30 10 C -38 8 -38 -2 -30 -4 C -30 -12 -20 -16 -12 -12 C -8 -20 6 -20 10 -12 C 20 -14 28 -6 24 2 C 30 4 30 10 24 12 C 8 14 -14 14 -30 10 Z',
  arrow: 'M -34 22 C -18 8 2 -6 30 -22 M 30 -22 C 22 -20 16 -19 10 -20 M 30 -22 C 28 -16 27 -10 28 -4',
  banner: 'M -36 -10 C -12 -16 12 -16 36 -10 C 34 0 34 8 36 16 C 12 10 -12 10 -36 16 C -34 8 -34 0 -36 -10 Z M -36 -10 C -40 -6 -42 0 -44 6 M 36 -10 C 40 -6 42 0 44 6',
  note: 'M -8 20 C -14 22 -20 20 -20 14 C -20 8 -14 6 -8 8 C -8 -2 -8 -12 -6 -22 C 4 -20 12 -16 14 -8 C 12 -12 4 -14 -4 -14 C -5 -3 -6 8 -8 20 Z',
  lamp: 'M -20 6 C -12 -2 12 -2 20 6 C 12 14 -12 14 -20 6 Z M 20 6 C 26 2 30 -2 32 -8 M 0 -4 C 0 -10 2 -16 6 -20 C 2 -16 -2 -16 -6 -20 C -2 -16 0 -10 0 -4 M -8 14 C -6 18 -4 20 0 22 C 4 20 6 18 8 14',
  scroll: 'M -26 -18 C -32 -18 -34 -10 -28 -8 C -24 -7 -22 -11 -24 -14 M -26 -18 C -8 -20 10 -20 26 -18 C 32 -18 34 -10 28 -8 M -26 -8 C -26 2 -26 10 -28 18 C -10 16 8 16 26 18 C 26 8 26 0 28 -8',
  mountain: 'M -40 20 C -28 4 -18 -10 -8 -22 C -2 -14 2 -8 6 -4 C 12 -12 18 -18 24 -24 C 30 -10 36 4 42 20 M -8 -22 C -6 -18 -3 -16 0 -16 C 2 -16 4 -18 5 -20',
  bread: 'M -22 2 C -22 -8 -12 -14 0 -14 C 12 -14 22 -8 22 2 C 22 8 14 12 0 12 C -14 12 -22 8 -22 2 Z M -10 -4 C -8 0 -8 4 -10 8 M 0 -6 C 2 -2 2 4 0 8 M 10 -4 C 12 0 12 4 10 8',
  cup: 'M -18 -20 C -6 -16 6 -16 18 -20 C 18 -8 12 2 2 4 C 2 10 2 14 4 18 C 0 17 0 17 -4 18 C -2 14 -2 10 -2 4 C -12 2 -18 -8 -18 -20 Z M -8 24 C -3 22 3 22 8 24',
  squiggle: 'M -36 0 C -30 -8 -24 -8 -18 0 C -12 8 -6 8 0 0 C 6 -8 12 -8 18 0 C 24 8 30 8 36 0',
  dot: 'M 0 0 m -5 0 a 5 5 0 1 0 10 0 a 5 5 0 1 0 -10 0',
};

interface Design {
  id: string;
  label: string;
  /** Motifs stamped around the frame, weighted by repetition. */
  motifs: string[];
  /** Larger anchor motifs for the four corners. */
  corners: [string, string, string, string];
  seed: number;
  /** Stroke width — thicker reads more marker-like. */
  stroke: number;
}

const DESIGNS: Design[] = [
  { id: 'doodle-faith', label: 'Faith margins', motifs: ['cross', 'star', 'sparkle', 'dot', 'heart'], corners: ['cross', 'star', 'heart', 'cross'], seed: 11, stroke: 7 },
  { id: 'doodle-garden', label: 'Garden frame', motifs: ['leafSprig', 'swirl', 'sparkle', 'dot'], corners: ['leafSprig', 'swirl', 'leafSprig', 'swirl'], seed: 23, stroke: 7 },
  { id: 'doodle-shore', label: 'Sea of Galilee', motifs: ['wave', 'fish', 'dot', 'sparkle'], corners: ['fish', 'wave', 'wave', 'fish'], seed: 37, stroke: 7 },
  { id: 'doodle-dove', label: 'Doves & olive', motifs: ['dove', 'oliveBranch', 'sparkle', 'dot'], corners: ['dove', 'oliveBranch', 'oliveBranch', 'dove'], seed: 41, stroke: 7 },
  { id: 'doodle-dawn', label: 'Morning mercies', motifs: ['sunBurst', 'cloud', 'sparkle', 'dot'], corners: ['sunBurst', 'cloud', 'cloud', 'sunBurst'], seed: 53, stroke: 7 },
  { id: 'doodle-journey', label: 'Arrows & banners', motifs: ['arrow', 'banner', 'squiggle', 'dot'], corners: ['banner', 'arrow', 'arrow', 'banner'], seed: 67, stroke: 7 },
  { id: 'doodle-lamp', label: 'Lamps & scrolls', motifs: ['lamp', 'scroll', 'sparkle', 'dot'], corners: ['lamp', 'scroll', 'scroll', 'lamp'], seed: 71, stroke: 7 },
  { id: 'doodle-heights', label: 'Mountains', motifs: ['mountain', 'cloud', 'star', 'dot'], corners: ['mountain', 'cloud', 'mountain', 'star'], seed: 83, stroke: 7 },
  { id: 'doodle-table', label: 'Bread & cup', motifs: ['bread', 'cup', 'sparkle', 'dot'], corners: ['cup', 'bread', 'bread', 'cup'], seed: 89, stroke: 7 },
  { id: 'doodle-praise', label: 'Praise notes', motifs: ['note', 'sparkle', 'squiggle', 'star', 'dot'], corners: ['note', 'star', 'note', 'sparkle'], seed: 97, stroke: 7 },
];

/**
 * Positions hug the frame: two vertical rails, a top band and a bottom band.
 * The center stays empty — text lives there. Bands are sized so even the
 * caption rail region only meets small, low-density marks.
 */
function edgeSlots(rand: () => number): Array<{ x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right' }> {
  const slots: Array<{ x: number; y: number; edge: 'top' | 'bottom' | 'left' | 'right' }> = [];
  for (let i = 0; i < 5; i += 1) slots.push({ x: 150 + i * 195 + rand() * 40 - 20, y: 70 + rand() * 60, edge: 'top' });
  for (let i = 0; i < 5; i += 1) slots.push({ x: 150 + i * 195 + rand() * 40 - 20, y: H - 130 + rand() * 60, edge: 'bottom' });
  for (let i = 0; i < 7; i += 1) slots.push({ x: 52 + rand() * 40, y: 300 + i * 200 + rand() * 60 - 30, edge: 'left' });
  for (let i = 0; i < 7; i += 1) slots.push({ x: W - 92 + rand() * 40, y: 300 + i * 200 + rand() * 60 - 30, edge: 'right' });
  return slots;
}

function buildSvg(design: Design): string {
  const rand = mulberry32(design.seed);
  const parts: string[] = [];

  const stamp = (motif: string, x: number, y: number, scale: number, rotation: number, opacity = 1) => {
    parts.push(
      `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rotation.toFixed(1)}) scale(${scale.toFixed(2)})" opacity="${opacity}">` +
        `<path d="${MOTIFS[motif]}" />` +
        '</g>',
    );
  };

  // Corner anchors, larger and steadier.
  const c = design.corners;
  stamp(c[0], 110, 120, 1.35, -8 + rand() * 16);
  stamp(c[1], W - 110, 130, 1.35, -8 + rand() * 16);
  stamp(c[2], 110, H - 130, 1.35, -8 + rand() * 16);
  stamp(c[3], W - 110, H - 120, 1.35, -8 + rand() * 16);

  // Edge fill, smaller and jittered; skip a slot now and then so the frame
  // breathes instead of reading as a repeated border tile.
  for (const slot of edgeSlots(rand)) {
    if (rand() < 0.22) continue;
    const motif = design.motifs[Math.floor(rand() * design.motifs.length)];
    const scale = 0.5 + rand() * 0.45;
    const rotation = -22 + rand() * 44;
    stamp(motif, slot.x, slot.y, scale, rotation, 0.7 + rand() * 0.3);
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<g fill="none" stroke="#fff" stroke-width="${design.stroke}" stroke-linecap="round" stroke-linejoin="round">` +
    parts.join('') +
    '</g></svg>'
  );
}

const outDir = join('public', 'backgrounds', 'doodles');
mkdirSync(outDir, { recursive: true });
const dataUris: string[] = [];
for (const design of DESIGNS) {
  const svg = buildSvg(design);
  writeFileSync(join(outDir, `${design.id}.svg`), `${svg}\n`, 'utf8');
  // The bake step inlines the doodle as a data URI rather than a file path:
  // CSS mask-image loads are CORS-checked, and the offline renderer serves
  // the composition from file:// (a null origin), where an external mask
  // can never load. A data URI is scheme-exempt and works everywhere.
  const encoded = encodeURIComponent(svg).replace(/'/g, '%27');
  dataUris.push(`  '${design.id}': 'data:image/svg+xml,${encoded}',`);
  console.log(`${design.id}.svg  ${(svg.length / 1024).toFixed(1)} KB  (${design.label})`);
}

const moduleSource = `/**
 * GENERATED by scripts/make-doodles.ts — do not edit.
 *
 * Doodle backgrounds as data URIs, keyed by background id. Inlined instead
 * of referenced by path because mask-image is CORS-checked and the offline
 * renderer loads compositions from file://, where external masks are blocked.
 */

export const DOODLE_DATA: Record<string, string> = {
${dataUris.join('\n')}
};
`;
writeFileSync(join('src', 'lib', 'theme', 'doodles.generated.ts'), moduleSource, 'utf8');
console.log('src/lib/theme/doodles.generated.ts written');
