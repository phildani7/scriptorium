/**
 * Provider selection.
 *
 * Gloo is the intended provider and the one the competition requires; Claude
 * stands behind it. Selection is explicit rather than clever: if AI_PROVIDER is
 * unset we prefer Gloo when its credentials exist, and fall back to Claude with
 * a warning rather than failing silently.
 *
 * When BOTH are configured the returned provider is wrapped so the fallback is
 * live rather than merely chosen at boot — see `resilient.ts` for why a
 * startup-time fallback covers the wrong failure.
 */

import type { AIProvider, ProviderId } from './provider';
import { cleanEnv } from '@/lib/env';
import { GlooProvider } from './gloo';
import { ClaudeProvider } from './claude';
import { clearFallbackEvent, lastFallbackEvent, ResilientProvider } from './resilient';

export * from './provider';
export { GlooProvider } from './gloo';
export { ClaudeProvider } from './claude';
export { lastFallbackEvent } from './resilient';

let cached: AIProvider | null = null;

export interface ProviderStatus {
  active: ProviderId;
  glooConfigured: boolean;
  claudeConfigured: boolean;
  /** The model Gloo is pinned to, or undefined when auto-routing. */
  glooModel?: string;
  /** True when a live Claude fallback stands behind Gloo. */
  fallbackReady: boolean;
  /** Set when we are NOT on Gloo, for honest display in the UI. */
  degradedReason?: string;
  /**
   * Set when Gloo answered but a recent request had to be served by Claude
   * anyway — credit exhausted, rate limit, outage. Distinct from
   * `degradedReason`, which is about configuration.
   */
  fallbackNotice?: string;
}

export function providerStatus(): ProviderStatus {
  const glooConfigured = Boolean(
    cleanEnv('GLOO_CLIENT_ID') && cleanEnv('GLOO_CLIENT_SECRET'),
  );
  const claudeConfigured = Boolean(cleanEnv('ANTHROPIC_API_KEY'));
  const requested = cleanEnv('AI_PROVIDER') as ProviderId | undefined;

  const active: ProviderId =
    requested === 'gloo' || (!requested && glooConfigured) ? 'gloo' : 'claude';

  const fell = lastFallbackEvent();

  return {
    active,
    glooConfigured,
    claudeConfigured,
    glooModel: cleanEnv('GLOO_MODEL'),
    fallbackReady: active === 'gloo' && claudeConfigured,
    degradedReason:
      active === 'claude'
        ? glooConfigured
          ? 'AI_PROVIDER is pinned to claude. Set AI_PROVIDER=gloo to use Gloo AI Studio.'
          : 'Gloo credentials are not configured, so generation is running on the Claude fallback. Values alignment, tradition steering, and routing telemetry are unavailable on this path.'
        : undefined,
    fallbackNotice:
      active === 'gloo' && fell
        ? `Gloo could not serve a recent request (${fell.operation}), so it was answered by the Claude fallback. Check the Gloo balance if this repeats. Gloo said: ${fell.reason}`
        : undefined,
  };
}

export function getProvider(): AIProvider {
  if (cached) return cached;

  const status = providerStatus();

  if (status.active === 'gloo') {
    const gloo = new GlooProvider({
      clientId: requireEnv('GLOO_CLIENT_ID'),
      clientSecret: requireEnv('GLOO_CLIENT_SECRET'),
      model: cleanEnv('GLOO_MODEL'),
    });

    // A live fallback, not just a chosen one: Gloo runs on a prepaid balance,
    // and the request that empties it is the one that fails.
    cached = status.claudeConfigured
      ? new ResilientProvider(
          gloo,
          new ClaudeProvider({
            apiKey: requireEnv('ANTHROPIC_API_KEY'),
            model: cleanEnv('ANTHROPIC_MODEL'),
          }),
        )
      : gloo;
    return cached;
  }

  if (!status.claudeConfigured) {
    throw new Error(
      'No AI provider is configured. Set GLOO_CLIENT_ID and GLOO_CLIENT_SECRET ' +
        '(preferred), or ANTHROPIC_API_KEY for the development fallback.',
    );
  }

  cached = new ClaudeProvider({
    apiKey: requireEnv('ANTHROPIC_API_KEY'),
    model: cleanEnv('ANTHROPIC_MODEL'),
  });
  return cached;
}

/** Test seam: drop the memoised provider so env changes take effect. */
export function resetProvider(): void {
  cached = null;
  clearFallbackEvent();
}

function requireEnv(name: string): string {
  const value = cleanEnv(name);
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}
