/**
 * Provider selection.
 *
 * Gloo is the intended provider and the one the competition requires; Claude is
 * the development fallback so the pipeline can be built and tested before Gloo
 * credentials land. Selection is explicit rather than clever: if AI_PROVIDER is
 * unset we prefer Gloo when its credentials exist, and fall back to Claude with
 * a warning rather than failing silently.
 */

import type { AIProvider, ProviderId } from './provider';
import { GlooProvider } from './gloo';
import { ClaudeProvider } from './claude';

export * from './provider';
export { GlooProvider } from './gloo';
export { ClaudeProvider } from './claude';

let cached: AIProvider | null = null;

export interface ProviderStatus {
  active: ProviderId;
  glooConfigured: boolean;
  claudeConfigured: boolean;
  /** Set when we are NOT on Gloo, for honest display in the UI. */
  degradedReason?: string;
}

export function providerStatus(): ProviderStatus {
  const glooConfigured = Boolean(
    process.env.GLOO_CLIENT_ID && process.env.GLOO_CLIENT_SECRET,
  );
  const claudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const requested = process.env.AI_PROVIDER as ProviderId | undefined;

  const active: ProviderId =
    requested === 'gloo' || (!requested && glooConfigured) ? 'gloo' : 'claude';

  return {
    active,
    glooConfigured,
    claudeConfigured,
    degradedReason:
      active === 'claude'
        ? glooConfigured
          ? 'AI_PROVIDER is pinned to claude. Set AI_PROVIDER=gloo to use Gloo AI Studio.'
          : 'Gloo credentials are not configured, so generation is running on the Claude fallback. Values alignment, tradition steering, and routing telemetry are unavailable on this path.'
        : undefined,
  };
}

export function getProvider(): AIProvider {
  if (cached) return cached;

  const status = providerStatus();

  if (status.active === 'gloo') {
    cached = new GlooProvider({
      clientId: requireEnv('GLOO_CLIENT_ID'),
      clientSecret: requireEnv('GLOO_CLIENT_SECRET'),
      model: process.env.GLOO_MODEL || undefined,
    });
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
    model: process.env.ANTHROPIC_MODEL || undefined,
  });
  return cached;
}

/** Test seam: drop the memoised provider so env changes take effect. */
export function resetProvider(): void {
  cached = null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}.`);
  return value;
}
