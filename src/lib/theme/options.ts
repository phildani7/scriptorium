/**
 * The customization surface: everything a creator can change with one click.
 *
 * Each option resolves to a small set of CSS custom properties that the bake
 * step writes onto the composition root as an inline style. Templates consume
 * `var(--t-*)` with their own defaults as fallback, so an un-themed spec still
 * renders exactly as the style was designed.
 *
 * Options are frozen sets, deliberately. Free-form colour pickers produce
 * unreadable shorts in unpracticed hands; a curated palette cannot be made
 * illegible, which is the same reasoning as the frozen templates themselves.
 */

export interface PaletteOption {
  id: string;
  label: string;
  /** Page ground. */
  bg: string;
  /** Primary text. */
  ink: string;
  /** Secondary text (captions at rest). */
  soft: string;
  /** The single accent (rules, active caption word, reference bar). */
  accent: string;
  /** True when the ground is dark, so templates can flip grain/shadow logic. */
  dark: boolean;
}

export const PALETTES: readonly PaletteOption[] = [
  { id: 'parchment', label: 'Parchment', bg: '#f6f1e7', ink: '#221e19', soft: '#6b6157', accent: '#b4552e', dark: false },
  { id: 'ivory-navy', label: 'Ivory & Navy', bg: '#f4f2ec', ink: '#1b2440', soft: '#5a6178', accent: '#c2452e', dark: false },
  { id: 'sage', label: 'Sage', bg: '#eef0e4', ink: '#22301f', soft: '#5f6d59', accent: '#8a5a2e', dark: false },
  { id: 'midnight', label: 'Midnight', bg: '#101322', ink: '#f2ecdd', soft: '#9aa0b8', accent: '#e8b04b', dark: true },
  { id: 'deep-forest', label: 'Deep Forest', bg: '#0e1a14', ink: '#eef3e4', soft: '#8fa393', accent: '#d98f4e', dark: true },
  { id: 'plum-neon', label: 'Plum Neon', bg: '#160b1f', ink: '#fff4fa', soft: '#a58fb8', accent: '#ff4d9d', dark: true },
  { id: 'ocean-glow', label: 'Ocean Glow', bg: '#071620', ink: '#e9f6ff', soft: '#7fa3b8', accent: '#4dd4ff', dark: true },
  { id: 'crimson-gold', label: 'Crimson & Gold', bg: '#1c0d10', ink: '#f7ecdc', soft: '#a88f85', accent: '#e0a83c', dark: true },
] as const;

export interface FontOption {
  id: string;
  label: string;
  /** Headline and verse face. */
  display: string;
  /** Caption and UI face. */
  body: string;
  /** Small compensation so different faces sit at similar optical size. */
  scaleAdjust: number;
}

/**
 * Every family here is OFL and self-hosted in /public/fonts — Path B renders
 * offline, so a CDN reference would silently fall back to a system face.
 *
 * Complex scripts override the display face per-script inside the template
 * (there is no Devanagari Archivo Black, and faking one breaks conjuncts), so
 * a font choice never sacrifices correct shaping.
 */
export const FONTS: readonly FontOption[] = [
  { id: 'fraunces', label: 'Serif', display: "'Fraunces', Georgia, serif", body: "'Inter', system-ui, sans-serif", scaleAdjust: 1 },
  { id: 'archivo', label: 'Poster', display: "'Archivo Black', 'Inter', sans-serif", body: "'Inter', system-ui, sans-serif", scaleAdjust: 0.86 },
  { id: 'grotesk', label: 'Modern', display: "'Space Grotesk', 'Inter', sans-serif", body: "'Space Grotesk', system-ui, sans-serif", scaleAdjust: 0.95 },
  { id: 'inter', label: 'Clean', display: "'Inter', system-ui, sans-serif", body: "'Inter', system-ui, sans-serif", scaleAdjust: 0.94 },
] as const;

export interface SizeOption {
  id: string;
  label: string;
  /** Multiplier applied to the template's type scale. */
  scale: number;
}

export const SIZES: readonly SizeOption[] = [
  { id: 'compact', label: 'Compact', scale: 0.88 },
  { id: 'regular', label: 'Regular', scale: 1 },
  { id: 'bold', label: 'Large', scale: 1.14 },
] as const;

export interface BackgroundOption {
  id: string;
  label: string;
  /**
   * Which treatment the template applies. All are CSS-generated — no image
   * files to ship, nothing to fetch offline.
   */
  kind: 'plain' | 'grain' | 'mesh' | 'rays' | 'particles';
}

export const BACKGROUNDS: readonly BackgroundOption[] = [
  { id: 'plain', label: 'Plain', kind: 'plain' },
  { id: 'grain', label: 'Soft grain', kind: 'grain' },
  { id: 'mesh', label: 'Gradient mesh', kind: 'mesh' },
  { id: 'rays', label: 'Light rays', kind: 'rays' },
  { id: 'particles', label: 'Particles', kind: 'particles' },
] as const;

/** The theme a spec carries. Every field optional; templates have defaults. */
export interface ShortTheme {
  paletteId?: string;
  fontId?: string;
  sizeId?: string;
  backgroundId?: string;
}

export interface ResolvedTheme {
  palette: PaletteOption;
  font: FontOption;
  size: SizeOption;
  background: BackgroundOption;
}

export function resolveTheme(theme: ShortTheme | undefined): ResolvedTheme {
  return {
    palette: PALETTES.find((p) => p.id === theme?.paletteId) ?? PALETTES[0],
    font: FONTS.find((f) => f.id === theme?.fontId) ?? FONTS[0],
    size: SIZES.find((s) => s.id === theme?.sizeId) ?? SIZES[1],
    background:
      BACKGROUNDS.find((b) => b.id === theme?.backgroundId) ?? BACKGROUNDS[1],
  };
}

/**
 * The inline style written onto the composition root. Inline, not a <style>
 * block, so it survives any template's own CSS unchanged and wins the cascade
 * exactly where intended: custom properties only.
 */
export function themeStyle(theme: ShortTheme | undefined): string {
  const { palette, font, size, background } = resolveTheme(theme);
  return [
    `--t-bg: ${palette.bg}`,
    `--t-ink: ${palette.ink}`,
    `--t-soft: ${palette.soft}`,
    `--t-accent: ${palette.accent}`,
    `--t-dark: ${palette.dark ? 1 : 0}`,
    `--t-font-display: ${font.display}`,
    `--t-font-body: ${font.body}`,
    `--t-scale: ${(size.scale * font.scaleAdjust).toFixed(3)}`,
  ].join('; ');
}

export function themeAttributes(theme: ShortTheme | undefined): {
  bg: string;
  dark: '1' | '0';
} {
  const { palette, background } = resolveTheme(theme);
  return { bg: background.kind, dark: palette.dark ? '1' : '0' };
}
