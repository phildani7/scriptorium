/**
 * Claude provider — the development fallback behind the Gloo seam.
 *
 * This is a like-for-like stand-in rather than a stub: Gloo's own catalogue
 * includes `gloo-anthropic-claude-haiku-4.5`, so when Gloo's auto-router picks
 * that tier, both paths are running the same underlying model. What Gloo adds
 * on top — values alignment, tradition steering, routing telemetry, ministry
 * safety infrastructure — is exactly what this provider cannot reproduce, and
 * the difference is reported honestly in the UI and the run manifest.
 *
 * Tradition is folded into the system prompt here because Claude has no native
 * equivalent of Gloo's `tradition` parameter. Same request, weaker guarantee.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { DeviceItem } from '@/lib/types';
import {
  buildIllustrateSystemPrompt,
  buildIllustrateUserMessage,
} from '@/lib/prompts/panels/illustrate';
import {
  type AIProvider,
  type GenerateOptions,
  type GenerationResult,
  DEVICE_ARRAY_SCHEMA,
  ProviderError,
  REFERENCE_LIST_SCHEMA,
  type ReferenceSuggestion,
  type Tradition,
  buildReferenceSuggestionPrompt,
  coerceDevices,
  extractJson,
  readReferenceResponse,
} from './provider';
import { getLanguage } from '@/lib/languages/registry';

export interface ClaudeConfig {
  apiKey: string;
  model?: string;
}

const DEFAULT_MODEL = 'claude-haiku-4-5';

export class ClaudeProvider implements AIProvider {
  readonly id = 'claude' as const;
  readonly label = 'Claude (development fallback)';

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(config: ClaudeConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model ?? DEFAULT_MODEL;
  }

  async generateDevices(options: GenerateOptions): Promise<GenerationResult> {
    const { context, filterType, tradition, signal } = options;
    const started = Date.now();

    const system = [
      buildIllustrateSystemPrompt(context, filterType),
      traditionClause(tradition),
    ]
      .filter(Boolean)
      .join('\n\n');

    const response = await this.send(
      {
        system,
        user: buildIllustrateUserMessage(context, filterType),
        maxTokens: 8000,
        schema: DEVICE_ARRAY_SCHEMA,
      },
      signal,
    );

    let devices: DeviceItem[];
    try {
      devices = coerceDevices(extractJson(response.text));
    } catch (cause) {
      throw new ProviderError(
        'claude',
        `Claude returned a response that was not a valid device array. ${(cause as Error).message}`,
        { cause },
      );
    }

    return {
      devices,
      meta: {
        provider: 'claude',
        model: response.model,
        tradition: tradition && tradition !== 'none' ? tradition : undefined,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: Date.now() - started,
      },
    };
  }

  async suggestReferences(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<ReferenceSuggestion> {
    const languageName = getLanguage(languageCode)?.name ?? languageCode;
    const response = await this.send(
      {
        system: buildReferenceSuggestionPrompt(languageName),
        user: query,
        maxTokens: 500,
        schema: REFERENCE_LIST_SCHEMA,
      },
      signal,
    );

    try {
      // Handles the prose decline as well as the JSON shape — see
      // readReferenceResponse for why that is not leniency but correctness.
      return readReferenceResponse(response.text);
    } catch (cause) {
      throw new ProviderError(
        'claude',
        `Claude returned a response that was not a valid reference list. ${(cause as Error).message}`,
        { cause },
      );
    }
  }

  async completeJson(
    args: {
      system: string;
      user: string;
      maxTokens: number;
      schema: Record<string, unknown>;
    },
    signal?: AbortSignal,
  ): Promise<unknown> {
    const response = await this.send(args, signal);
    return extractJson(response.text);
  }

  private async send(
    args: {
      system: string;
      user: string;
      maxTokens: number;
      schema: Record<string, unknown>;
    },
    signal?: AbortSignal,
  ): Promise<{
    text: string;
    model: string;
    inputTokens?: number;
    outputTokens?: number;
  }> {
    try {
      const message = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: args.maxTokens,
          system: args.system,
          messages: [{ role: 'user', content: args.user }],
          // Structured outputs constrain the response to the schema, so the
          // parse below is a validation step rather than a hope.
          output_config: {
            format: { type: 'json_schema', schema: args.schema },
          },
        },
        { signal },
      );

      if (message.stop_reason === 'max_tokens') {
        throw new ProviderError(
          'claude',
          'Claude hit the output token limit before finishing the JSON. ' +
            'Raise max_tokens or reduce the requested item count.',
          { retryable: true },
        );
      }

      const text = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('');

      if (text.trim().length === 0) {
        throw new ProviderError('claude', 'Claude returned no text content.');
      }

      return {
        text,
        model: message.model,
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw toProviderError(error);
    }
  }
}

function toProviderError(error: unknown): ProviderError {
  if (error instanceof Anthropic.RateLimitError) {
    return new ProviderError('claude', 'Claude rate limit reached.', {
      status: error.status,
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof Anthropic.AuthenticationError) {
    return new ProviderError(
      'claude',
      'Claude rejected the API key. Check ANTHROPIC_API_KEY in .env.local.',
      { status: error.status, cause: error },
    );
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new ProviderError('claude', 'Could not reach the Claude API.', {
      retryable: true,
      cause: error,
    });
  }
  if (error instanceof Anthropic.APIError) {
    return new ProviderError('claude', `Claude API error: ${error.message}`, {
      status: error.status,
      retryable: typeof error.status === 'number' && error.status >= 500,
      cause: error,
    });
  }
  return new ProviderError('claude', `Unexpected Claude failure: ${String(error)}`, {
    cause: error,
  });
}

/**
 * Gloo takes `tradition` as a first-class parameter and aligns generation to it.
 * Claude has no equivalent, so we approximate it in the prompt and are explicit
 * in the UI that this path offers guidance, not alignment.
 */
function traditionClause(tradition?: Tradition): string {
  if (!tradition || tradition === 'none') return '';
  const emphasis: Record<Exclude<Tradition, 'none'>, string> = {
    evangelical:
      'personal faith, the authority of Scripture, and the call to respond',
    catholic:
      'sacramental life, the continuity of the Church, and the communion of saints',
    orthodox:
      'the liturgical and patristic tradition, mystery, and transformation in Christ',
    mainline:
      'thoughtful engagement, social witness, and the historic creeds',
    pentecostal:
      'the present work of the Holy Spirit, expectancy, and testimony',
  };
  return [
    '<tradition_alignment>',
    `This reader belongs to the ${tradition} tradition. Where the passage supports it,`,
    `let the emphasis fall naturally on ${emphasis[tradition]}.`,
    'Do not distort the text to serve the tradition, and do not editorialise about',
    'other traditions. Fidelity to the passage still outranks everything here.',
    '</tradition_alignment>',
  ].join('\n');
}
