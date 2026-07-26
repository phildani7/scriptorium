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
   * back here and the text is then fetched from YouVersion.
   */
  suggestReferences(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<string[]>;
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
          reference: { type: 'string' },
          emoji: { type: 'string' },
        },
        required: ['type', 'content', 'point', 'reference', 'emoji'],
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
  },
  required: ['references'],
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

export function coerceReferences(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.references)
      ? value.references
      : null;

  if (!list) throw new Error('Expected a JSON array of reference strings.');

  return list
    .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    .map((r) => r.trim());
}

function isDeviceItem(value: unknown): value is DeviceItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.type === 'string' &&
    (DEVICE_TYPES as readonly string[]).includes(value.type) &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    typeof value.point === 'string' &&
    typeof value.reference === 'string' &&
    typeof value.emoji === 'string'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
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
    '',
    'Return ONLY a JSON array of strings. No markdown, no commentary.',
    'Example: ["Philippians 4:6-7", "Matthew 6:25-34", "1 Peter 5:6-7"]',
  ].join('\n');
}
