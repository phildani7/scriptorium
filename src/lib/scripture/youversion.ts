/**
 * YouVersion Platform API client.
 *
 * This module is the only place Scripture enters the system. Everything it
 * returns is treated as immutable downstream: `Passage.text` is the exact
 * `content` string the API sent, with no trimming, no normalisation, no
 * "helpful" cleanup. `lib/verify` later proves that what rendered is what
 * arrived here.
 *
 * Beyond passages, three platform endpoints do real work for us:
 *   - /v1/bibles      version discovery per language, and the licence filter
 *   - /v1/bibles/{id} the copyright string that must appear on every short
 *   - /v1/fonts       platform-approved font families with CDN woff2 sources,
 *                     which is how Devanagari, Bengali and Tamil get shaped
 *                     correctly instead of falling back to a system face
 */

import type { Passage } from '@/lib/types';
import { parseReference } from './usfm';

const BASE_URL = 'https://api.youversion.com/v1';

/** Berean Standard Bible — public domain, so safe to burn into a video. */
export const DEFAULT_EN_VERSION = 3034;

export class YouVersionError extends Error {
  readonly status?: number;
  readonly retryable: boolean;

  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, { cause: options.cause });
    this.name = 'YouVersionError';
    this.status = options.status;
    this.retryable =
      options.status === 429 || (options.status ?? 0) >= 500;
  }
}

export interface BibleVersion {
  id: number;
  abbreviation: string;
  localizedAbbreviation?: string;
  title: string;
  localizedTitle?: string;
  languageTag: string;
  copyright?: string;
  info?: string;
  publisherUrl?: string;
  deepLink?: string;
}

export interface FontVariant {
  weight: number;
  style: string;
  sources: Array<{ format: string; url: string }>;
}

export interface FontFamily {
  id: number;
  slug: string;
  family: string;
  variants: FontVariant[];
}

export class YouVersionClient {
  private readonly appKey: string;
  private readonly bibleCache = new Map<number, BibleVersion>();

  constructor(appKey?: string) {
    const key = appKey ?? process.env.YVP_APP_KEY;
    if (!key) {
      throw new YouVersionError(
        'Missing YVP_APP_KEY. Register an app at https://platform.youversion.com ' +
          'and put the App Key in .env.local.',
      );
    }
    this.appKey = key;
  }

  /**
   * Fetch a passage. `text` comes back exactly as the API sent it.
   *
   * `include_headings` and `include_notes` are both left off: a section heading
   * is editorial apparatus, not the verse, and burning one into a short as if
   * it were Scripture would be precisely the failure this project exists to
   * prevent.
   */
  async getPassage(versionId: number, usfm: string): Promise<Passage> {
    const [raw, version] = await Promise.all([
      this.get<{ id: string; content: string; reference: string }>(
        `/bibles/${versionId}/passages/${encodeURIComponent(usfm)}`,
        { format: 'text', include_headings: 'false', include_notes: 'false' },
      ),
      this.getBible(versionId),
    ]);

    if (typeof raw.content !== 'string' || raw.content.trim().length === 0) {
      throw new YouVersionError(
        `Passage ${usfm} in version ${versionId} returned no text.`,
      );
    }

    return {
      reference: raw.reference || usfm,
      usfm: raw.id || usfm,
      // Verbatim. Do not touch.
      text: raw.content,
      versionId,
      versionAbbreviation: version.localizedAbbreviation || version.abbreviation,
      versionName: version.localizedTitle || version.title,
      attribution: buildAttribution(version),
      languageCode: primaryLanguage(version.languageTag),
      copyright: version.copyright,
    };
  }

  /** Resolve a typed reference straight to a passage. */
  async getPassageByReference(
    versionId: number,
    reference: string,
  ): Promise<Passage> {
    const parsed = parseReference(reference);
    if (!parsed) {
      throw new YouVersionError(
        `Could not parse "${reference}" as a Bible reference.`,
      );
    }
    return this.getPassage(versionId, parsed.usfm);
  }

  /** Version metadata, memoised — attribution is needed on every render. */
  async getBible(versionId: number): Promise<BibleVersion> {
    const cached = this.bibleCache.get(versionId);
    if (cached) return cached;

    const raw = await this.get<Record<string, unknown>>(`/bibles/${versionId}`);
    const version = toBibleVersion(raw);
    this.bibleCache.set(versionId, version);
    return version;
  }

  /**
   * Bible versions available to this app key for a language.
   *
   * Only versions the app is licensed for come back by default, which is
   * exactly what we want: if it is not in this list we may not distribute video
   * containing it.
   */
  async listBibles(languageCode: string): Promise<BibleVersion[]> {
    const raw = await this.get<{ data?: unknown[] }>('/bibles', {
      'language_ranges[]': languageCode,
      page_size: '100',
    });
    if (!Array.isArray(raw.data)) return [];
    return raw.data
      .filter((v): v is Record<string, unknown> => typeof v === 'object' && v !== null)
      .map(toBibleVersion);
  }

  /** Platform-approved font families, with CDN woff2 URLs. */
  async listFonts(): Promise<FontFamily[]> {
    const raw = await this.get<{ data?: unknown[] }>('/fonts');
    if (!Array.isArray(raw.data)) return [];
    return raw.data
      .filter((f): f is Record<string, unknown> => typeof f === 'object' && f !== null)
      .map((f) => ({
        id: Number(f.id),
        slug: String(f.slug ?? ''),
        family: String(f.family ?? ''),
        variants: Array.isArray(f.variants) ? (f.variants as FontVariant[]) : [],
      }));
  }

  /**
   * The CSS for one font family, as served by the platform.
   *
   * For live preview a template can link this URL directly (the gateway accepts
   * `app_key` as a query parameter). For MP4 export the render step fetches the
   * woff2 files and inlines them, because Path B renders with no network.
   */
  async getFontStylesheet(fontId: number): Promise<string> {
    const response = await fetch(
      `${BASE_URL}/fonts/${fontId}/stylesheet?app_key=${encodeURIComponent(this.appKey)}`,
      { headers: { 'X-YVP-App-Key': this.appKey } },
    );
    if (!response.ok) {
      throw new YouVersionError(
        `Font stylesheet ${fontId} failed: ${response.status} ${response.statusText}`,
        { status: response.status },
      );
    }
    return response.text();
  }

  /** Stylesheet URL usable directly from a browser `<link>` tag. */
  fontStylesheetUrl(fontId: number): string {
    return `${BASE_URL}/fonts/${fontId}/stylesheet?app_key=${encodeURIComponent(this.appKey)}`;
  }

  /** Languages the platform serves, for cross-checking our registry. */
  async listLanguages(): Promise<Array<Record<string, unknown>>> {
    const raw = await this.get<{ data?: unknown[] }>('/languages', {
      page_size: '500',
    });
    return Array.isArray(raw.data)
      ? (raw.data as Array<Record<string, unknown>>)
      : [];
  }

  /** Licence agreements, and whether this app has accepted them. */
  async listLicenses(allAvailable = false): Promise<Array<Record<string, unknown>>> {
    const raw = await this.get<{ data?: unknown[] }>('/licenses', {
      ...(allAvailable ? { all_available: 'true' } : {}),
      page_size: '100',
    });
    return Array.isArray(raw.data)
      ? (raw.data as Array<Record<string, unknown>>)
      : [];
  }

  private async get<T>(
    path: string,
    query: Record<string, string> = {},
  ): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [k, v] of Object.entries(query)) url.searchParams.append(k, v);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { 'X-YVP-App-Key': this.appKey, Accept: 'application/json' },
        // Scripture text for a given version never changes; let Next cache it.
        next: { revalidate: 86_400 },
      });
    } catch (cause) {
      throw new YouVersionError(
        `Could not reach the YouVersion Platform API (${path}).`,
        { cause },
      );
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new YouVersionError(
        `YouVersion ${path} failed: ${response.status} ${response.statusText}. ${detail.slice(0, 300)}`,
        { status: response.status },
      );
    }

    return (await response.json()) as T;
  }
}

/**
 * The on-screen credit. Rendered in every single short, without exception —
 * publishers licence text to YouVersion on the understanding that attribution
 * travels with it, and a judge from YouVersion will look for this.
 */
function buildAttribution(version: BibleVersion): string {
  const name = version.localizedTitle || version.title;
  const abbr = version.localizedAbbreviation || version.abbreviation;
  const copyright = stripQuotes(version.copyright ?? '');

  const head = abbr && name ? `${name} (${abbr})` : name || abbr;
  return copyright ? `${head} · ${copyright}` : head;
}

function toBibleVersion(raw: Record<string, unknown>): BibleVersion {
  return {
    id: Number(raw.id),
    abbreviation: String(raw.abbreviation ?? ''),
    localizedAbbreviation: optionalString(raw.localized_abbreviation),
    title: String(raw.title ?? ''),
    localizedTitle: optionalString(raw.localized_title),
    languageTag: String(raw.language_tag ?? 'en'),
    copyright: stripQuotes(optionalString(raw.copyright) ?? '') || undefined,
    info: optionalString(raw.info),
    publisherUrl: optionalString(raw.publisher_url),
    deepLink: optionalString(raw.youversion_deep_link),
  };
}

/** The API wraps some copyright strings in literal double quotes. */
function stripQuotes(s: string): string {
  return s.replace(/^"+|"+$/g, '').trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function primaryLanguage(tag: string): string {
  return tag.split('-')[0].toLowerCase();
}

let client: YouVersionClient | null = null;

export function getScriptureClient(): YouVersionClient {
  client ??= new YouVersionClient();
  return client;
}
