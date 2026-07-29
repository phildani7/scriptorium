/**
 * Gloo AI Studio provider — the production path.
 *
 * Two things make Gloo more than a generic LLM endpoint here, and both are used
 * deliberately rather than incidentally:
 *
 *   - `tradition`  values-alignment. A short generated for a Catholic parish and
 *                  one for a Pentecostal youth group are asking for different
 *                  emphases from the same verse. We pass the user's tradition
 *                  through instead of flattening everyone to one voice.
 *   - `auto_routing`  Gloo picks the model per request and reports its tier and
 *                  confidence. We record both in the run manifest, so every
 *                  short in the gallery can say which model wrote its device
 *                  and how confident the router was.
 *
 * Auth is OAuth2 client credentials. Tokens last an hour; we cache in module
 * scope and refresh early rather than paying a token round trip per request.
 */

import type { DeviceItem } from '@/lib/types';
import {
  buildIllustrateSystemPrompt,
  buildIllustrateUserMessage,
} from '@/lib/prompts/panels/illustrate';
import {
  type AIProvider,
  type GenerateOptions,
  type GenerationResult,
  ProviderError,
  buildReferenceSuggestionPrompt,
  coerceDevices,
  coerceReferences,
  extractJson,
} from './provider';
import { getLanguage } from '@/lib/languages/registry';

const TOKEN_URL = 'https://platform.ai.gloo.com/oauth2/token';
const CHAT_URL = 'https://platform.ai.gloo.com/ai/v2/chat/completions';

/** Refresh this many ms before actual expiry, to avoid racing the boundary. */
const REFRESH_SKEW_MS = 60_000;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: CachedToken | null = null;
let inFlightToken: Promise<string> | null = null;

export interface GlooConfig {
  clientId: string;
  clientSecret: string;
  /** Omit to let Gloo's auto-router choose. */
  model?: string;
}

export class GlooProvider implements AIProvider {
  readonly id = 'gloo' as const;
  readonly label = 'Gloo AI Studio';

  constructor(private readonly config: GlooConfig) {}

  async generateDevices(options: GenerateOptions): Promise<GenerationResult> {
    const { context, filterType, tradition, signal } = options;
    const started = Date.now();

    const system = buildIllustrateSystemPrompt(context, filterType);
    const user = buildIllustrateUserMessage(context, filterType);

    const body = await this.chat(
      {
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        // Auto-routing on unless a model is pinned; Gloo then reports which
        // tier it chose and how confident it was.
        ...(this.config.model
          ? { model: this.config.model }
          : { auto_routing: true }),
        ...(tradition && tradition !== 'none' ? { tradition } : {}),
        stream: false,
        max_tokens: 4000,
      },
      signal,
    );

    const text = readContent(body);
    let devices: DeviceItem[];
    try {
      devices = coerceDevices(extractJson(text));
    } catch (cause) {
      throw new ProviderError(
        'gloo',
        `Gloo returned a response that was not a valid device array. ${(cause as Error).message}`,
        { cause },
      );
    }

    return {
      devices,
      meta: {
        provider: 'gloo',
        model: String(body.model ?? this.config.model ?? 'auto'),
        routingTier: optionalString(body.routing_tier),
        routingConfidence: optionalNumber(body.routing_confidence),
        tradition: optionalString(body.tradition),
        inputTokens: optionalNumber(asRecord(body.usage)?.prompt_tokens),
        outputTokens: optionalNumber(asRecord(body.usage)?.completion_tokens),
        latencyMs: Date.now() - started,
      },
    };
  }

  async suggestReferences(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const languageName = getLanguage(languageCode)?.name ?? languageCode;
    const body = await this.chat(
      {
        messages: [
          {
            role: 'system',
            content: buildReferenceSuggestionPrompt(languageName),
          },
          { role: 'user', content: query },
        ],
        ...(this.config.model
          ? { model: this.config.model }
          : { auto_routing: true }),
        stream: false,
        max_tokens: 500,
      },
      signal,
    );

    try {
      return coerceReferences(extractJson(readContent(body)));
    } catch (cause) {
      throw new ProviderError(
        'gloo',
        `Gloo returned a response that was not a valid reference list. ${(cause as Error).message}`,
        { cause },
      );
    }
  }

  async completeJson(
    args: {
      system: string;
      user: string;
      maxTokens: number;
      /** Described in the prompt upstream; Gloo has no documented JSON mode. */
      schema: Record<string, unknown>;
    },
    signal?: AbortSignal,
  ): Promise<unknown> {
    const body = await this.chat(
      {
        messages: [
          { role: 'system', content: args.system },
          { role: 'user', content: args.user },
        ],
        ...(this.config.model
          ? { model: this.config.model }
          : { auto_routing: true }),
        stream: false,
        max_tokens: args.maxTokens,
      },
      signal,
    );
    return extractJson(readContent(body));
  }

  private async chat(
    payload: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const token = await this.accessToken(signal);

    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // The system prompt is large and stable across a session; caching it
        // keeps repeat generations cheap.
        'X-Cache-TTL': '5m',
      },
      body: JSON.stringify(payload),
      signal,
    });

    if (!response.ok) {
      // A 401 almost always means the cached token went stale early; drop it so
      // the next attempt re-authenticates rather than replaying a dead token.
      if (response.status === 401) tokenCache = null;

      throw new ProviderError(
        'gloo',
        `Gloo chat completions failed: ${response.status} ${response.statusText}. ` +
          `${await safeBody(response)}`,
        {
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        },
      );
    }

    return (await response.json()) as Record<string, unknown>;
  }

  /** Cached OAuth2 client-credentials token, refreshed a minute before expiry. */
  private async accessToken(signal?: AbortSignal): Promise<string> {
    if (tokenCache && Date.now() < tokenCache.expiresAt - REFRESH_SKEW_MS) {
      return tokenCache.accessToken;
    }
    // Collapse concurrent refreshes into one request.
    inFlightToken ??= this.fetchToken(signal).finally(() => {
      inFlightToken = null;
    });
    return inFlightToken;
  }

  private async fetchToken(signal?: AbortSignal): Promise<string> {
    const basic = Buffer.from(
      `${this.config.clientId}:${this.config.clientSecret}`,
    ).toString('base64');

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'api/access',
      }),
      signal,
    });

    if (!response.ok) {
      throw new ProviderError(
        'gloo',
        `Gloo token request failed: ${response.status} ${response.statusText}. ` +
          'Check GLOO_CLIENT_ID and GLOO_CLIENT_SECRET, and that billing is ' +
          'configured on the Gloo AI Studio account.',
        { status: response.status, retryable: response.status >= 500 },
      );
    }

    const json = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!json.access_token) {
      throw new ProviderError('gloo', 'Gloo token response had no access_token.');
    }

    tokenCache = {
      accessToken: json.access_token,
      expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
    };
    return json.access_token;
  }
}

function readContent(body: Record<string, unknown>): string {
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new ProviderError('gloo', 'Gloo response contained no choices.');
  }
  const content = asRecord(asRecord(choices[0])?.message)?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new ProviderError('gloo', 'Gloo response contained no message content.');
  }
  return content;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

async function safeBody(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return '';
  }
}
