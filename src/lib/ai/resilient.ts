/**
 * Gloo first, Claude if Gloo cannot answer.
 *
 * The fallback used to happen at STARTUP: if Gloo credentials were absent the
 * app booted on Claude and stayed there. That covers the wrong failure. Gloo
 * is now configured and paid for, so the realistic way it stops working is not
 * "no credentials" but "credit exhausted", "rate limited", or "having a bad
 * afternoon" — and every one of those arrives mid-request, long after the
 * decision was made.
 *
 * On a prepaid balance that matters concretely: the run that empties the
 * account is the one that fails, and without this wrapper it fails in front of
 * whoever is watching. So each call tries Gloo and, if Gloo refuses, runs the
 * same call on Claude rather than surfacing an error.
 *
 * Two things it deliberately does NOT do:
 *
 *   - It never falls back on an abort. A cancelled request is the caller
 *     changing their mind, and re-running it on the other provider would spend
 *     money on an answer nobody is waiting for.
 *   - It never hides the substitution. The reason is recorded and surfaced by
 *     /api/status, because a short generated on the fallback carries none of
 *     Gloo's values alignment and the creator is entitled to know which engine
 *     wrote their teaching.
 */

import type {
  AIProvider,
  GenerateOptions,
  GenerationResult,
  ReferenceSuggestion,
} from './provider';

export interface FallbackEvent {
  /** ISO timestamp of the most recent substitution. */
  at: string;
  /** Which call fell through. */
  operation: string;
  /** What Gloo said, trimmed for display. */
  reason: string;
}

let lastFallback: FallbackEvent | null = null;

/**
 * How long a substitution stays worth mentioning.
 *
 * The notice is a live signal — "Gloo is struggling right now" — not a log.
 * Held forever in module scope, one transient blip would pin a warning to the
 * header until the serverless instance recycled, which teaches a creator to
 * ignore the banner. Expiring it means a notice that IS showing means
 * something is wrong now.
 */
const NOTICE_TTL_MS = 15 * 60 * 1000;

/** The most recent substitution, if it is recent enough to still matter. */
export function lastFallbackEvent(): FallbackEvent | null {
  if (!lastFallback) return null;
  if (Date.now() - Date.parse(lastFallback.at) > NOTICE_TTL_MS) {
    lastFallback = null;
  }
  return lastFallback;
}

/** Test seam. */
export function clearFallbackEvent(): void {
  lastFallback = null;
}

function isAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}

export class ResilientProvider implements AIProvider {
  readonly id: AIProvider['id'];
  readonly label: string;

  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {
    this.id = primary.id;
    this.label = `${primary.label} (falls back to ${fallback.label})`;
  }

  private async attempt<T>(operation: string, run: (p: AIProvider) => Promise<T>): Promise<T> {
    try {
      return await run(this.primary);
    } catch (error) {
      if (isAbort(error)) throw error;

      const reason = error instanceof Error ? error.message : String(error);
      lastFallback = {
        at: new Date().toISOString(),
        operation,
        reason: reason.slice(0, 300),
      };
      // Logged, not swallowed: the fallback keeps the creator moving, but a
      // silent one turns "Gloo is out of credit" into "the shorts changed
      // character and nobody knows why".
      console.warn(
        `[ai] ${this.primary.label} failed on ${operation}; ` +
          `retrying on ${this.fallback.label}. Reason: ${reason}`,
      );
      return run(this.fallback);
    }
  }

  generateDevices(options: GenerateOptions): Promise<GenerationResult> {
    return this.attempt('generateDevices', (p) => p.generateDevices(options));
  }

  suggestReferences(
    query: string,
    languageCode: string,
    signal?: AbortSignal,
  ): Promise<ReferenceSuggestion> {
    return this.attempt('suggestReferences', (p) =>
      p.suggestReferences(query, languageCode, signal),
    );
  }

  completeJson(
    args: { system: string; user: string; maxTokens: number; schema: Record<string, unknown> },
    signal?: AbortSignal,
  ): Promise<unknown> {
    return this.attempt('completeJson', (p) => p.completeJson(args, signal));
  }
}
