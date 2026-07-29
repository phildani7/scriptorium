/**
 * Core data contracts. Everything in the pipeline conforms to these.
 *
 * The single most important invariant in this codebase:
 * `Passage.text` is retrieved verbatim from the YouVersion Platform API and is
 * NEVER mutated, paraphrased, regenerated, or edited by a human or a model.
 * `lib/verify` enforces this at render time.
 */

export type DeviceType =
  | 'analogy'
  | 'illustration'
  | 'punch-line'
  | 'hook'
  | 'object-lesson'
  | 'summary';

export type StyleId =
  | 'warm-minimal'
  | 'kinetic-type'
  | 'paper-cutout'
  | 'neon-night'
  | 'manuscript';

export type AgeGroup = 'kids' | 'youth' | 'adult';

/** How complete our production support is for a language. Shown honestly in the UI. */
export type LanguageTier =
  /** Verse text + a neural voice + word-level forced alignment. */
  | 'full'
  /** Verse text + a neural voice, timings estimated from syllable weight. */
  | 'voiced'
  /** Verse text + captions only; timings estimated. No voice model exists yet. */
  | 'text-first';

/**
 * Scripture retrieved from YouVersion. `text` is sacred: verbatim, untouched.
 */
export interface Passage {
  /** Human-readable reference, e.g. "Psalm 23:1-4" */
  reference: string;
  /** USFM reference used against the API, e.g. "PSA.23.1-PSA.23.4" */
  usfm: string;
  /** Verbatim verse text from the API. NEVER mutated. */
  text: string;
  /** YouVersion version id, e.g. 3034 (BSB) */
  versionId: number;
  versionAbbreviation: string;
  versionName: string;
  /** Required on-screen credit string. Rendered in every single short. */
  attribution: string;
  /** BCP-47 language code of the version, e.g. "hi" */
  languageCode: string;
  /** Copyright/permissions string from the API, when supplied. */
  copyright?: string;
}

/** Exactly the shape the illustrate prompt returns. Do not add fields. */
export interface DeviceItem {
  type: DeviceType;
  content: string;
  point: string;
  /**
   * 2-4 spoken sentences unpacking the device — the body of the short since
   * the format moved from "show the verse" to "teach the verse, cite it".
   * Optional because specs generated before that change don't carry it;
   * templates fall back to displaying the verse for those.
   */
  explanation?: string;
  /**
   * 3-5 concrete English nouns the short could illustrate (V2 visuals).
   * Always English regardless of the short's language — the icon library is
   * keyed in English. Optional; the matcher falls back to keyword extraction.
   */
  visualTerms?: string[];
  /** One-sentence 1:1 image prompt for AI-visual mode. Optional. */
  imagePrompt?: string;
  reference: string;
  emoji: string;
}

/* ---------------------------------------------------------------------- */
/* V2 visuals                                                              */
/* ---------------------------------------------------------------------- */

/** Text only, free graphics (vendored SVGs + CC0 photos), or AI images. */
export type VisualMode = 'text' | 'free' | 'ai';

export interface VisualItem {
  kind: 'icon' | 'clipart' | 'photo' | 'ai-image';
  /**
   * Icons carry their vendored SVG markup inline (stroke: currentColor, so
   * they recolor with the palette). Inline, not a file path: the offline
   * renderer loads from file:// where fetched assets hit CORS walls.
   */
  svg?: string;
  /** Photos/AI images: URL in preview; the render step localizes it. */
  src?: string;
  /** The concept this visual illustrates. */
  term: string;
  /** Seconds into the narration when it appears. Resolved at compose. */
  timeSec: number;
  /** Deterministic placement slot (0..3; hero uses 0). */
  slot: number;
  credit?: string;
}

export interface ShortVisuals {
  mode: VisualMode;
  items: VisualItem[];
}

export interface WordTiming {
  word: string;
  /** seconds from start of narration */
  start: number;
  /** seconds from start of narration */
  end: number;
}

export type TimingSource = 'speechmatics' | 'estimated';

/**
 * Which part of the narration a run of words belongs to.
 *
 * The template needs this to know when the verse is actually being spoken, so
 * the verse panel can appear on that beat rather than on a guessed offset. It
 * also marks exactly which words are Scripture, which is what the on-screen
 * verse element is built from and what the integrity gate checks.
 */
export type ScriptSegmentKind = 'device' | 'teaching' | 'verse' | 'reference';

export interface ScriptSegment {
  kind: ScriptSegmentKind;
  text: string;
  /** Index of this segment's first word in `Narration.timings`. */
  wordStart: number;
  /** Exclusive end index. */
  wordEnd: number;
}

export interface Narration {
  /** The full spoken script: device content, then the verse, then the reference. */
  script: string;
  audioUrl: string;
  durationSec: number;
  timings: WordTiming[];
  timingSource: TimingSource;
  /** Word ranges for each part of the script, in order. */
  segments: ScriptSegment[];
}

/** Identifies a voice across engines. Resolved by lib/voice. */
export interface VoiceId {
  engine: 'speechmatics' | 'piper' | 'browser';
  /** Engine-specific model name, e.g. "hi_IN-rohan-medium" or "en-US-1" */
  model: string;
  label: string;
}

/** One-click customization choices. Resolved against lib/theme/options. */
export interface ShortThemeChoice {
  paletteId?: string;
  fontId?: string;
  sizeId?: string;
  backgroundId?: string;
}

/** The single object a template consumes. A template is a pure function of this. */
export interface ShortSpec {
  id: string;
  passage: Passage;
  device: DeviceItem;
  style: StyleId;
  /** Creator's palette/font/size/background picks. Absent = style defaults. */
  theme?: ShortThemeChoice;
  languageCode: string;
  voice: VoiceId;
  narration: Narration;
  music: { file: string; credit: string } | null;
  /** V2: resolved visuals (mode + timed items). Absent = text only. */
  visuals?: ShortVisuals;
  /** 20-45 */
  durationSec: number;
  /** Set by lib/verify once the rendered verse has been diffed against `passage.text`. */
  verified: boolean;
}

/**
 * Cultural register of the generated teaching — not a translation switch but a
 * voice: how the device would be said out loud in that community.
 */
export type Tone = 'conversational' | 'formal' | 'liturgical';

/** Context handed to the prompt builders. */
export interface PromptContext {
  ageGroup: AgeGroup;
  proficiencyLevel: 'beginner' | 'intermediate' | 'advanced';
  preferredLanguage: string;
  passageReference: string;
  passageText: string;
  versionAbbreviation?: string;
  /** Cultural tone; absent means 'conversational'. */
  tone?: Tone;
}
