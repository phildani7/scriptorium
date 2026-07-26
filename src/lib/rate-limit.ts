/**
 * Best-effort per-IP rate limiting.
 *
 * In-memory sliding window, no external store. On serverless this resets
 * whenever an instance is recycled, which makes it a speed bump rather than a
 * wall — but the routes it protects front paid third-party APIs, and a speed
 * bump is what turns a runaway loop or a casual scraper from a bill into a
 * 429. Honest limitation, deliberately accepted: adding a datastore for a
 * demo-scale deployment would be complexity without a threat model to match.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Sweep expired windows occasionally so the map cannot grow unbounded. */
let lastSweep = 0;
function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const window = windows.get(key);
  if (!window || window.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  window.count += 1;
  if (window.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((window.resetAt - now) / 1000),
    };
  }
  return { ok: true, remaining: limit - window.count, retryAfterSec: 0 };
}

/** Client IP as Vercel reports it; 'anonymous' locally. */
export function clientKey(request: Request, route: string): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'anonymous';
  return `${route}:${ip}`;
}

/**
 * Guard a route handler. Returns a 429 Response when over the limit, null
 * when the request may proceed.
 */
export function guard(
  request: Request,
  route: string,
  limit = 20,
  windowMs = 60_000,
): Response | null {
  const result = rateLimit(clientKey(request, route), limit, windowMs);
  if (result.ok) return null;
  return Response.json(
    {
      error: `Too many requests. Try again in ${result.retryAfterSec}s.`,
    },
    { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } },
  );
}
