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

import { DOODLE_DATA } from './doodles.generated';

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
   * Which treatment the template applies. Most are CSS-generated; `photo`
   * layers a shipped public-domain image with a slow Ken Burns drift and a
   * palette-tinted scrim so text stays legible on any theme.
   */
  kind:
    | 'plain'
    | 'grain'
    | 'mesh'
    | 'rays'
    | 'particles'
    | 'paper'
    | 'halftone'
    | 'linen'
    | 'photo'
    | 'doodle';
  /** For kind 'photo' or 'doodle': root-relative asset path. */
  src?: string;
}

export const BACKGROUNDS: readonly BackgroundOption[] = [
  { id: 'plain', label: 'Plain', kind: 'plain' },
  { id: 'grain', label: 'Soft grain', kind: 'grain' },
  { id: 'mesh', label: 'Gradient mesh', kind: 'mesh' },
  { id: 'rays', label: 'Light rays', kind: 'rays' },
  { id: 'particles', label: 'Particles', kind: 'particles' },
  { id: 'paper', label: 'Paper texture', kind: 'paper' },
  { id: 'halftone', label: 'Halftone dots', kind: 'halftone' },
  { id: 'linen', label: 'Linen weave', kind: 'linen' },
  // NASA imagery — public domain. Normalized to 1080x1920 at import.
  { id: 'photo-starfield', label: 'Deep field ✶', kind: 'photo', src: '/backgrounds/starfield.jpg' },
  { id: 'photo-pillars', label: 'Pillars ✶', kind: 'photo', src: '/backgrounds/pillars.jpg' },
  { id: 'photo-earth', label: 'Earth ✶', kind: 'photo', src: '/backgrounds/earth.jpg' },
  // Hand-drawn doodle frames, authored in scripts/make-doodles.ts. Applied as
  // an alpha mask over a palette-ink layer, so they recolor with the theme.
  { id: 'doodle-faith', label: 'Faith margins ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-faith.svg' },
  { id: 'doodle-garden', label: 'Garden frame ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-garden.svg' },
  { id: 'doodle-shore', label: 'Sea of Galilee ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-shore.svg' },
  { id: 'doodle-dove', label: 'Doves & olive ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-dove.svg' },
  { id: 'doodle-dawn', label: 'Morning mercies ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-dawn.svg' },
  { id: 'doodle-journey', label: 'Arrows & banners ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-journey.svg' },
  { id: 'doodle-lamp', label: 'Lamps & scrolls ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-lamp.svg' },
  { id: 'doodle-heights', label: 'Mountains ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-heights.svg' },
  { id: 'doodle-table', label: 'Bread & cup ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-table.svg' },
  { id: 'doodle-praise', label: 'Praise notes ✎', kind: 'doodle', src: '/backgrounds/doodles/doodle-praise.svg' },
] as const;

export interface MusicOption {
  id: string;
  label: string;
  /** Empty for silence. */
  file: string;
  credit: string;
}

/**
 * Music beds, pre-attenuated and faded at import time with ffmpeg, so the
 * mix is right no matter what a player does with volume attributes.
 * Kevin MacLeod tracks are CC-BY 4.0 — credited here, in CREDITS.md, and in
 * the gallery manifest.
 */
export const MUSIC: readonly MusicOption[] = [
  { id: 'none', label: 'No music', file: '', credit: '' },
  { id: 'meditation', label: 'Meditation', file: '/music/meditation.mp3', credit: '"Meditation Impromptu 01" Kevin MacLeod (incompetech.com), CC BY 4.0' },
  { id: 'at-rest', label: 'At Rest', file: '/music/at-rest.mp3', credit: '"At Rest" Kevin MacLeod (incompetech.com), CC BY 4.0' },
  { id: 'heartbreaking', label: 'Tender', file: '/music/heartbreaking.mp3', credit: '"Heartbreaking" Kevin MacLeod (incompetech.com), CC BY 4.0' },
  { id: 'wounded', label: 'Reflective', file: '/music/wounded.mp3', credit: '"Wounded" Kevin MacLeod (incompetech.com), CC BY 4.0' },
] as const;

/** The theme a spec carries. Every field optional; templates have defaults. */
export interface ShortTheme {
  paletteId?: string;
  fontId?: string;
  sizeId?: string;
  backgroundId?: string;
  /** 'off' hides the caption rail; the verse and reference always render. */
  captions?: 'on' | 'off';
  musicId?: string;
}

export function resolveMusic(theme: ShortTheme | undefined): MusicOption {
  return MUSIC.find((m) => m.id === theme?.musicId) ?? MUSIC[0];
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
  /** Root-relative photo path, when the background is a photo. */
  photoSrc?: string;
  /**
   * Doodle SVG as a data URI, when the background is a doodle frame. A data
   * URI, not a path: mask-image loads are CORS-checked, and the offline
   * renderer serves compositions from file:// where external masks are
   * blocked. Data URIs are scheme-exempt, so preview and render agree.
   */
  doodleData?: string;
  captionsOff: boolean;
} {
  const { palette, background } = resolveTheme(theme);
  return {
    bg: background.kind,
    dark: palette.dark ? '1' : '0',
    photoSrc: background.kind === 'photo' ? background.src : undefined,
    doodleData:
      background.kind === 'doodle' ? DOODLE_DATA[background.id] : undefined,
    captionsOff: theme?.captions === 'off',
  };
}
