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
   * layers a shipped licensed image with a slow Ken Burns drift and a
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
    | 'video'
    | 'doodle';
  /** For kind 'photo', 'video' or 'doodle': root-relative asset path. */
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
  // Licensed animated loops (creator-licensed stock; no attribution required).
  // 1080x1920 muted 60s loops, normalized at import with ffmpeg.
  { id: 'video-still-waters', label: 'Still waters ▶', kind: 'video', src: '/backgrounds/video/still-waters.mp4' },
  { id: 'video-forest-path', label: 'Forest path ▶', kind: 'video', src: '/backgrounds/video/forest-path.mp4' },
  // Licensed full-bleed image backgrounds, cropped to 1080x1920 at import.
  // They ride the same photo pipeline: Ken Burns drift + palette-tinted scrim.
  { id: 'img-fluffy-sky', label: 'Fluffy sky', kind: 'photo', src: '/backgrounds/img/fluffy-sky.jpg' },
  { id: 'img-tropical-sunset', label: 'Tropical sunset', kind: 'photo', src: '/backgrounds/img/tropical-sunset.jpg' },
  { id: 'img-nebula', label: 'Nebula', kind: 'photo', src: '/backgrounds/img/nebula.jpg' },
  { id: 'img-sun-rays', label: 'Sun rays', kind: 'photo', src: '/backgrounds/img/sun-rays.jpg' },
  { id: 'img-stained-glass', label: 'Stained glass', kind: 'photo', src: '/backgrounds/img/stained-glass.jpg' },
  { id: 'img-gold-leaf', label: 'Gold leaf', kind: 'photo', src: '/backgrounds/img/gold-leaf.jpg' },
  { id: 'img-golden-silk', label: 'Golden silk', kind: 'photo', src: '/backgrounds/img/golden-silk.jpg' },
  { id: 'img-blue-marble', label: 'Blue marble', kind: 'photo', src: '/backgrounds/img/blue-marble.jpg' },
  { id: 'img-wood-grain', label: 'Wood grain', kind: 'photo', src: '/backgrounds/img/wood-grain.jpg' },
  { id: 'img-paint-splash', label: 'Paint splash', kind: 'photo', src: '/backgrounds/img/paint-splash.jpg' },
  { id: 'img-grunge-color', label: 'Color grunge', kind: 'photo', src: '/backgrounds/img/grunge-color.jpg' },
  { id: 'img-halftone-pop', label: 'Halftone pop', kind: 'photo', src: '/backgrounds/img/halftone-pop.jpg' },
  { id: 'img-groovy-liquid', label: 'Groovy liquid', kind: 'photo', src: '/backgrounds/img/groovy-liquid.jpg' },
  { id: 'img-rainbow-glitter', label: 'Rainbow glitter', kind: 'photo', src: '/backgrounds/img/rainbow-glitter.jpg' },
  { id: 'img-confetti', label: 'Confetti', kind: 'photo', src: '/backgrounds/img/confetti.jpg' },
  { id: 'img-geo-pattern', label: 'Geometric', kind: 'photo', src: '/backgrounds/img/geo-pattern.jpg' },
  { id: 'img-floral-pattern', label: 'Floral', kind: 'photo', src: '/backgrounds/img/floral-pattern.jpg' },
  { id: 'img-harvest', label: 'Harvest', kind: 'photo', src: '/backgrounds/img/harvest.jpg' },
] as const;

export interface TextStyleOption {
  id: string;
  label: string;
  blurb: string;
}

/**
 * How stage text ENTERS — the device line, the teaching words, the
 * verse/citation panel. A style is a motion recipe, never a clock: each
 * template keeps its own timing (kinetic words still land on the voice) and
 * its seam transitions. `signature` is the template's designed move, so
 * existing specs render unchanged. Captions are deliberately not covered —
 * their hard cuts are a legibility decision, not a style.
 *
 * The id travels as `data-anim` on the composition root; templates hold the
 * matching GSAP recipe inline (transform/opacity/filter only, seek-safe).
 */
export const TEXT_STYLES: readonly TextStyleOption[] = [
  { id: 'signature', label: 'Signature', blurb: "Each style's designed move" },
  { id: 'floating', label: 'Floating', blurb: 'Rises softly with a touch of blur' },
  { id: 'dropping', label: 'Dropping', blurb: 'Falls in and settles with a bounce' },
  { id: 'sliding', label: 'Sliding', blurb: 'Enters from the side' },
  { id: 'pop', label: 'Pop', blurb: 'Scales up with a snap' },
  { id: 'typewriter', label: 'Typewriter', blurb: 'Appears in place, no motion' },
  { id: 'flip', label: 'Flip', blurb: 'Flap-board rotation' },
  { id: 'blur-focus', label: 'Blur focus', blurb: 'Racks into focus from a blur' },
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
 *
 * Every track here is licensed to the project creator through Audiio and
 * requires NO attribution. The four CC-BY tracks this set opened with were
 * removed deliberately: a short is made to be reposted, and a licence whose
 * terms depend on a credit line surviving that repost is a licence the
 * creator will breach without ever knowing. The credit still travels with the
 * gallery entry, as a courtesy rather than an obligation.
 */
export const MUSIC: readonly MusicOption[] = [
  { id: 'none', label: 'No music', file: '', credit: '' },
  { id: 'right-here', label: 'Right Here', file: '/music/right-here.mp3', credit: '"Right Here" Su — Audiio license' },
  { id: 'deeper-still', label: 'Deeper Still', file: '/music/deeper-still.mp3', credit: '"Deeper Still" Jacob Montague — Audiio license' },
  { id: 'beyond-the-pull', label: 'Ambient Drift', file: '/music/beyond-the-pull.mp3', credit: '"Beyond the Pull of Things (Ambient)" Dmitriy Redko — Audiio license' },
  { id: 'eternal-strings', label: 'Eternal Strings', file: '/music/eternal-strings.mp3', credit: '"Eternal (Hanging Solo with Strings)" Pendelton — Audiio license' },
  { id: 'sleep-habits', label: 'Gentle Sleep', file: '/music/sleep-habits.mp3', credit: '"Sleep Habits" Allen Bright — Audiio license' },
  { id: 'elevate', label: 'Elevate', file: '/music/elevate.mp3', credit: '"Elevate (Instrumental)" JinSei — Audiio license' },
  { id: 'snow-fall', label: 'Snow Fall', file: '/music/snow-fall.mp3', credit: '"Snow Fall (Instrumental)" Nylon & Cedar — Audiio license' },
  { id: 'o-holy-night', label: 'O Holy Night', file: '/music/o-holy-night.mp3', credit: '"O Holy Night (Instrumental)" Allen & Bright — Audiio license' },
  { id: 'christmas-cassette', label: 'Christmas Cassette', file: '/music/christmas-cassette.mp3', credit: '"Christmas on Cassette (Instrumental)" Alex Velte — Audiio license' },
] as const;

/** The theme a spec carries. Every field optional; templates have defaults. */
export interface ShortTheme {
  paletteId?: string;
  fontId?: string;
  sizeId?: string;
  backgroundId?: string;
  /** How stage text enters; 'signature' keeps the template's designed move. */
  textStyleId?: string;
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
  // The background is deliberately absent: it resolves to an ATTRIBUTE
  // (`data-bg`) plus an asset URL, both written by the bake step, not to a
  // custom property. See `themeAttributes`.
  const { palette, font, size } = resolveTheme(theme);
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
  /** Root-relative video path, when the background is an animated loop. */
  videoSrc?: string;
  /**
   * Doodle SVG as a data URI, when the background is a doodle frame. A data
   * URI, not a path: mask-image loads are CORS-checked, and the offline
   * renderer serves compositions from file:// where external masks are
   * blocked. Data URIs are scheme-exempt, so preview and render agree.
   */
  doodleData?: string;
  /** Resolved text-motion id; unknown ids fall back to 'signature'. */
  textStyle: string;
  captionsOff: boolean;
} {
  const { palette, background } = resolveTheme(theme);
  return {
    bg: background.kind,
    dark: palette.dark ? '1' : '0',
    photoSrc: background.kind === 'photo' ? background.src : undefined,
    videoSrc: background.kind === 'video' ? background.src : undefined,
    doodleData:
      background.kind === 'doodle' ? DOODLE_DATA[background.id] : undefined,
    textStyle:
      TEXT_STYLES.find((t) => t.id === theme?.textStyleId)?.id ?? 'signature',
    captionsOff: theme?.captions === 'off',
  };
}
