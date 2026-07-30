/**
 * The AI provider seam.
 *
 * Gloo AI Studio is the production provider: it adds values-alignment,
 * tradition-aware generation, and safety infrastructure built for ministry
 * contexts, and its catalogue includes `gloo-anthropic-claude-haiku-4.5`.
 * The Claude provider calls that same underlying model directly, which makes it
 * a genuine like-for-like fallback for local development rather than a stub.
 *
 * Everything downstream depends on this interface, never on a concrete
 * provider. Switching is one environment variable.
 *
 * Whatever the provider, one rule holds: the model writes the teaching device
 * and NEVER the verse. `lib/verify` enforces it at render time.
 */

import type { DeviceItem, DeviceType, PromptContext } from '@/lib/types';

export type ProviderId = 'gloo' | 'claude';

/**
 * Theological tradition, passed to Gloo's values-alignment layer. Gloo accepts
 * this natively; the Claude provider folds it into the system prompt so both
 * paths honour the same request.
 */
export type Tradition =
  | 'evangelical'
  | 'catholic'
  | 'orthodox'
  | 'mainline'
  | 'pentecostal'
  | 'none';

export interface GenerateOptions {
  context: PromptContext;
  /** Restrict output to a single teaching-device lens. */
  filterType?: DeviceType;
  tradition?: Tradition;
  signal?: AbortSignal;
}

/** Provider telemetry surfaced in the UI and written into the run manifest. */
export interface GenerationMeta {
  provider: ProviderId;
  /** Model that actually served the request, as reported by the provider. */
  model: string;
  /** Gloo only: which routing tier its auto-router selected. */
  routingTier?: string;
  /** Gloo only: the router's confidence in that choice, 0-1. */
  routingConfidence?: number;
  /** Gloo only: the values-alignment tradition applied. */
  tradition?: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
}

export interface GenerationResult {
  devices: DeviceItem[];
  meta: GenerationMeta;
}

export interface AIProvider {
  readonly id: ProviderId;
  readonly label: string;

  /**
   * Generate teaching devices for a passage. Returns 3-7 items; the UI shows
   * them all as selectable cards so the quality of the generation is visible.
   */
  generateDevices(options: GenerateOptions): Promise<GenerationResult>;

  /**
   * Turn a topic or feeling ("anxiety at work") into candidate passage
   * REFERENCES only. The model never supplies verse text — the references come
   * back here and the text is then fetched from YouVersion. Topics with no
   * spiritual dimension come back as a polite decline instead of proof-texts.
   */
  suggestReferences(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<ReferenceSuggestion>;

  /**
   * Generic JSON completion for the smaller structured tasks (teaching
   * extraction from a source text, series planning). Callers own the prompt
   * and the validation; the provider owns transport, auth, and JSON mode.
   */
  completeJson(
    args: {
      system: string;
      user: string;
      maxTokens: number;
      schema: Record<string, unknown>;
    },
    signal?: AbortSignal,
  ): Promise<unknown>;
}

export class ProviderError extends Error {
  readonly provider: ProviderId;
  readonly status?: number;
  readonly retryable: boolean;

  constructor(
    provider: ProviderId,
    message: string,
    options: { status?: number; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'ProviderError';
    this.provider = provider;
    this.status = options.status;
    this.retryable = options.retryable ?? false;
  }
}

const DEVICE_TYPES: readonly DeviceType[] = [
  'analogy',
  'illustration',
  'punch-line',
  'hook',
  'object-lesson',
  'summary',
];

/**
 * JSON Schema for a device array. Claude enforces this natively via structured
 * outputs; Gloo's Completions V2 does not document a JSON mode, so there the
 * schema is described in the prompt and validated here on the way back. Same
 * validator either way, so a malformed response fails identically on both paths.
 */
export const DEVICE_ARRAY_SCHEMA = {
  type: 'object',
  properties: {
    devices: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: DEVICE_TYPES },
          content: { type: 'string' },
          point: { type: 'string' },
          explanation: { type: 'string' },
          // No minItems/maxItems: the Claude structured-output validator
          // rejects array bounds other than 0/1. The prompt asks for 3-5 and
          // the matcher caps consumption, so hard bounds add nothing here.
          visualTerms: {
            type: 'array',
            items: { type: 'string' },
          },
          imagePrompt: { type: 'string' },
          reference: { type: 'string' },
          emoji: { type: 'string' },
        },
        required: [
          'type',
          'content',
          'point',
          'explanation',
          'visualTerms',
          'imagePrompt',
          'reference',
          'emoji',
        ],
        additionalProperties: false,
      },
    },
  },
  required: ['devices'],
  additionalProperties: false,
} as const;

export const REFERENCE_LIST_SCHEMA = {
  type: 'object',
  properties: {
    references: { type: 'array', items: { type: 'string' } },
    decline: { type: 'string' },
  },
  required: ['references'],
  additionalProperties: false,
} as const;

/** Suggested references, or a polite decline for a non-spiritual topic. */
export interface ReferenceSuggestion {
  references: string[];
  decline?: string;
}

/** A teaching mined from a creator's own source text (sermon, notes, article). */
export interface ExtractedTeaching {
  title: string;
  summary: string;
  reference: string;
  /**
   * Concrete English nouns for the icon/photo libraries — same contract as
   * DeviceItem.visualTerms. Without these, a doc-sourced short in a
   * non-English language can never earn a picture: the libraries are keyed in
   * English and the narration is not.
   */
  visualTerms?: string[];
  /** One-sentence square-image description, for the AI-image mode. */
  imagePrompt?: string;
}

export const TEACHING_LIST_SCHEMA = {
  type: 'object',
  properties: {
    teachings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          reference: { type: 'string' },
          visualTerms: {
            type: 'array',
            items: { type: 'string' },
          },
          imagePrompt: { type: 'string' },
        },
        required: ['title', 'summary', 'reference', 'visualTerms', 'imagePrompt'],
        additionalProperties: false,
      },
    },
    decline: { type: 'string' },
  },
  required: ['teachings'],
  additionalProperties: false,
} as const;

/** One planned day of a multi-day shorts series. */
export interface SeriesDay {
  day: number;
  focus: string;
  reference: string;
  lens: DeviceType;
}

export const SERIES_PLAN_SCHEMA = {
  type: 'object',
  properties: {
    days: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          day: { type: 'number' },
          focus: { type: 'string' },
          reference: { type: 'string' },
          lens: { type: 'string', enum: DEVICE_TYPES },
        },
        required: ['day', 'focus', 'reference', 'lens'],
        additionalProperties: false,
      },
    },
    decline: { type: 'string' },
  },
  required: ['days'],
  additionalProperties: false,
} as const;

/**
 * Pull a JSON value out of a model response that may be wrapped in prose or a
 * markdown fence. Providers without a strict JSON mode do this often enough
 * that tolerating it is worth more than failing purely.
 */
export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();

  const direct = tryParse(trimmed);
  if (direct !== undefined) return direct;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed !== undefined) return parsed;
  }

  // Fall back to the outermost balanced array or object in the string.
  for (const [open, close] of [
    ['[', ']'],
    ['{', '}'],
  ] as const) {
    const start = trimmed.indexOf(open);
    const end = trimmed.lastIndexOf(close);
    if (start !== -1 && end > start) {
      const parsed = tryParse(trimmed.slice(start, end + 1));
      if (parsed !== undefined) return parsed;
    }
  }

  throw new Error(
    `Response contained no parseable JSON. First 200 chars: ${trimmed.slice(0, 200)}`,
  );
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

/**
 * Validate and normalise a device payload. Accepts either a bare array (what
 * the illustrate prompt asks for) or `{ devices: [...] }` (what a JSON-schema
 * provider returns), because both shapes occur in practice.
 */
export function coerceDevices(value: unknown): DeviceItem[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.devices)
      ? value.devices
      : null;

  if (!list) {
    throw new Error('Expected a JSON array of devices, or { devices: [...] }.');
  }

  const devices = list.filter(isDeviceItem);

  if (devices.length === 0) {
    throw new Error(
      `Parsed ${list.length} item(s) but none had the required shape ` +
        `{ type, content, point, reference, emoji }.`,
    );
  }

  return devices;
}

/**
 * Read a reference suggestion out of a raw model response, JSON or not.
 *
 * The prompt asks for `{ references: [...] }`, or an empty list plus a
 * `decline` when the topic has no spiritual dimension. Models comply on the
 * first shape and improvise on the second: asked about "VLSI test pattern
 * generation" they frequently just *write the refusal*, in prose, because
 * that is what a refusal sounds like.
 *
 * Parsing that as a malformed response is wrong twice over. It turns the
 * model's correct behaviour into an error the creator sees, and — once a live
 * fallback existed — it made a perfect Gloo decline look like a Gloo outage
 * and spend a Claude call to get the same refusal in better punctuation.
 *
 * So unparseable prose is read as what it is. The discriminator is whether the
 * text names a passage: a refusal never cites one, so anything containing
 * chapter:verse is a reference list that failed to parse, and that IS an
 * error worth raising. The length cap is only a backstop against a runaway
 * response being filed as a polite sentence.
 *
 * The cap was 600 to begin with, on the reasoning that a decline is a
 * sentence or two. It is not — the same refusal came back at 262 characters
 * once and 525 the next time, and in production it ran longer still and
 * tripped the very fallback this was written to prevent. Refusal length is
 * not something to tune against; the citation test is the real signal.
 */
export function readReferenceResponse(raw: string): ReferenceSuggestion {
  try {
    return coerceReferences(extractJson(raw));
  } catch (cause) {
    const prose = raw.trim();
    const looksLikeDecline =
      prose.length > 0 &&
      prose.length <= 2000 &&
      !/\b\d{1,3}\s*:\s*\d{1,3}\b/.test(prose);

    if (looksLikeDecline) return { references: [], decline: prose };
    throw cause;
  }
}

export function coerceReferences(value: unknown): ReferenceSuggestion {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.references)
      ? value.references
      : null;

  if (!list) throw new Error('Expected a JSON array of reference strings.');

  const decline =
    isRecord(value) && typeof value.decline === 'string' && value.decline.trim()
      ? value.decline.trim()
      : undefined;

  const references = list
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim());

  if (references.length === 0 && !decline) {
    throw new Error('The response carried neither references nor a decline.');
  }
  return { references, decline: references.length === 0 ? decline : undefined };
}

function isDeviceItem(value: unknown): value is DeviceItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    (DEVICE_TYPES as readonly string[]).includes(value.type) &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    typeof value.point === 'string' &&
    typeof value.explanation === 'string' &&
    value.explanation.trim().length > 0 &&
    typeof value.reference === 'string' &&
    typeof value.emoji === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface TeachingExtraction {
  teachings: ExtractedTeaching[];
  /** The model's polite one-liner when the source has no Christian content. */
  decline?: string;
}

export function coerceTeachings(value: unknown): TeachingExtraction {
  const list =
    isRecord(value) && Array.isArray(value.teachings) ? value.teachings : null;
  if (!list) throw new Error('Expected { teachings: [...] }.');

  const decline =
    isRecord(value) && typeof value.decline === 'string' && value.decline.trim()
      ? value.decline.trim()
      : undefined;

  const teachings = list
    .filter(
      (t): t is ExtractedTeaching =>
        isRecord(t) &&
        typeof t.title === 'string' &&
        t.title.trim().length > 0 &&
        typeof t.summary === 'string' &&
        typeof t.reference === 'string' &&
        t.reference.trim().length > 0,
    )
    // The visual fields are best-effort: a malformed entry costs the pictures,
    // never the teaching.
    .map((t) => ({
      ...t,
      visualTerms: Array.isArray(t.visualTerms)
        ? t.visualTerms.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        : undefined,
      imagePrompt: typeof t.imagePrompt === 'string' && t.imagePrompt.trim() ? t.imagePrompt : undefined,
    }));
  if (teachings.length === 0 && !decline) {
    throw new Error('No teaching in the response had { title, summary, reference }.');
  }
  return { teachings, decline: teachings.length === 0 ? decline : undefined };
}

export interface SeriesPlan {
  days: SeriesDay[];
  /** The model's polite one-liner when the theme has no spiritual dimension. */
  decline?: string;
}

export function coerceSeriesPlan(value: unknown): SeriesPlan {
  const list = isRecord(value) && Array.isArray(value.days) ? value.days : null;
  if (!list) throw new Error('Expected { days: [...] }.');

  const decline =
    isRecord(value) && typeof value.decline === 'string' && value.decline.trim()
      ? value.decline.trim()
      : undefined;

  const days = list.filter(
    (d): d is SeriesDay =>
      isRecord(d) &&
      typeof d.day === 'number' &&
      typeof d.focus === 'string' &&
      typeof d.reference === 'string' &&
      d.reference.trim().length > 0 &&
      typeof d.lens === 'string' &&
      (DEVICE_TYPES as readonly string[]).includes(d.lens),
  );
  if (days.length === 0 && !decline) {
    throw new Error('No day in the response had { day, focus, reference, lens }.');
  }
  return {
    days: days.sort((a, b) => a.day - b.day),
    decline: days.length === 0 ? decline : undefined,
  };
}

/**
 * Teaching extraction from a creator's own source text. The same central rule
 * as everywhere else: the model returns REFERENCES and its own prose about the
 * source — verse text always comes from YouVersion afterwards.
 */
export function buildTeachingExtractionPrompt(languageName: string): string {
  return [
    'A creator has supplied their own source text — sermon notes, an article, a',
    'devotional, a transcript — and wants to turn its teachings into Scripture',
    'shorts. Mine the text for its distinct teachings.',
    '',
    'Each teaching becomes a short that OPENS on its title, then speaks the',
    'thought over five pages, then quotes the anchoring verse. So for each',
    'teaching:',
    `- "title": a short opening line (max ~8 words) in the source's own spirit —`,
    '  it is the first thing on screen, so make it land.',
    '- "summary": the THOUGHT, in EXACTLY FIVE SENTENCES of roughly 12-20 words',
    '  each, carrying what the SOURCE itself argues, in warm spoken prose a',
    '  narrator can read aloud. This is a hard format requirement: each',
    '  sentence becomes ONE PAGE shown alone on screen, so five sentences means',
    '  five pages. Build them — the situation, what the source claims, what',
    '  that rules out, what it looks like this week, and the line to keep.',
    '  Every sentence must stand alone on screen and still make sense, so do',
    '  not open one with "And", "But so", or a pronoun whose subject was two',
    '  sentences back. Keep each under about 20 words or it will not fit.',
    '',
    `CRITICAL LANGUAGE RULE: "title" and "summary" MUST be written in ${languageName},`,
    'even when the source document is in a different language — translate the',
    `teaching faithfully into natural ${languageName}. The narration and the verse`,
    `will both be in ${languageName}; an opening line in the source's language would`,
    'clash on screen. Only "reference" stays in English book-name form.',
    '- "reference": ONE canonical Bible passage (1-4 verses). STRONGLY prefer a',
    '  passage the source itself cites for this point; only if it cites none,',
    '  choose the most genuinely relevant passage. Use standard English book',
    '  names and numerals, e.g. "Romans 8:1-4". The verse text is retrieved from',
    '  an authoritative Bible API — never write verse text yourself.',
    '- "visualTerms": 3-5 concrete ENGLISH nouns naming things the teaching',
    '  literally mentions or evokes (e.g. "shepherd", "storm", "bread", "path") —',
    '  always English single words regardless of the response language, because',
    '  they key an icon library. Prefer physical, drawable things.',
    '- "imagePrompt": ONE English sentence describing a single VERTICAL',
    '  hand-drawn children\'s Bible doodle illustration for this teaching — one',
    '  clear concrete scene, warm and reverent, bold marker outline and bright',
    '  crayon colour on cream sketchbook paper. Describe only the scene and',
    '  leave the top quarter of the frame free of subject matter. Never ask for',
    '  text, letters, labels or speech bubbles in the image, and never depict',
    '  God\'s face.',
    '',
    'Rules:',
    '1. Teachings must come FROM the source, not from your general knowledge of the topic.',
    '2. Distinct teachings — no restatements of the same point. Return 3 to 5.',
    '3. Skip anything that has no honest scriptural anchor rather than proof-texting it.',
    '4. If the source contains no Christian or biblical teaching content at all',
    '   (a technical manual, a secular essay, marketing copy, another religion\'s',
    '   scripture), do NOT force teachings out of it. Return an empty "teachings"',
    `   array plus "decline": 1-2 warm, respectful sentences in ${languageName}`,
    '   in this voice: "This tool creates Scripture shorts related to Christian',
    '   teaching — sermons, devotionals, faith articles. I\'d love to help with a',
    '   document like that." Never mock or judge the source.',
    '',
    'Return ONLY JSON: { "teachings": [ { "title", "summary", "reference",',
    '"visualTerms", "imagePrompt" } ], "decline"? }.',
  ].join('\n');
}

/**
 * Series planning: a theme and a day count become a coherent sequence of
 * passages and lenses. References only, as always.
 */
export function buildSeriesPlanPrompt(languageName: string, days: number): string {
  return [
    `Plan a ${days}-day series of short vertical Scripture videos on the creator's theme.`,
    'Each day is one short built from one passage through one teaching lens.',
    '',
    'For each day return:',
    '- "day": 1-based position.',
    `- "focus": one sentence in ${languageName} — what this day contributes to the arc.`,
    '- "reference": ONE canonical passage (1-8 verses), standard English book names,',
    '  e.g. "Philippians 4:6-7". Verse text is retrieved from an authoritative Bible',
    '  API — never write verse text yourself.',
    '- "lens": one of "analogy", "illustration", "punch-line", "hook", "object-lesson", "summary".',
    '',
    'Rules:',
    `1. Exactly ${days} days, a real progression: open the need, deepen, turn, land.`,
    '2. No passage repeats. Vary the lenses; pick each day\'s lens for its content,',
    '   not for variety\'s own sake.',
    '3. Prefer passages that address the theme in context — no keyword proof-texts.',
    '4. Real human situations always qualify. But if the theme is a purely',
    '   technical, academic, or commercial subject with no honest spiritual',
    '   dimension, return an empty "days" array plus "decline": 1-2 warm',
    `   sentences in ${languageName} in this voice: "This tool creates Scripture`,
    '   short series related to faith, feelings, and life situations — things',
    '   like worry, doubt, work stress, or longing for guidance. If you\'re',
    '   facing a personal or spiritual question or feeling, I\'d love to plan a',
    '   series that speaks to it." Adapt naturally; never mock the theme.',
    '',
    'Return ONLY JSON: { "days": [ { "day", "focus", "reference", "lens" } ], "decline"? }.',
  ].join('\n');
}

/**
 * The reference-suggestion prompt. Deliberately narrow: the model returns
 * references and nothing else, so there is no path by which generated text can
 * be mistaken for Scripture.
 */
export function buildReferenceSuggestionPrompt(languageName: string): string {
  return [
    'You help a user find Bible passages that speak to a topic, feeling, or situation.',
    '',
    'Return ONLY canonical passage references, never verse text. The verse text',
    'will be retrieved from an authoritative Bible API; if you were to write it',
    'yourself it would be discarded and the request would fail.',
    '',
    'Rules:',
    '1. Return 3 to 5 references.',
    '2. Use standard English book names and numerals, e.g. "Psalm 23:1-4", "John 3:16",',
    `   even though the user is working in ${languageName}. The API resolves them.`,
    '3. Prefer passages that genuinely address the topic in context, not proof-texts',
    '   that merely share a keyword.',
    '4. Keep each reference to a single passage of 1-8 verses.',
    '5. Real human situations always qualify — grief, work stress, parenting,',
    '   doubt, money, illness. But if the input is a purely technical, academic,',
    '   or commercial subject with no honest spiritual dimension ("VLSI testing",',
    '   a product name, homework jargon), do NOT proof-text it. Return an empty',
    `   "references" array plus "decline": 1-2 warm sentences in ${languageName}`,
    '   in this voice: "This tool creates Scripture shorts related to faith,',
    '   feelings, and life situations — things like worry, doubt, work stress,',
    '   or longing for guidance. If you\'re facing a personal or spiritual',
    '   question or feeling, I\'d love to help you find passages that address',
    '   it." Adapt naturally; never mock the input.',
    '',
    'Return ONLY JSON: { "references": [ ... ], "decline"? }. No markdown, no commentary.',
    'Example: { "references": ["Philippians 4:6-7", "Matthew 6:25-34", "1 Peter 5:6-7"] }',
  ].join('\n');
}
