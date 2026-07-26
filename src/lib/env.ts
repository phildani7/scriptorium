/**
 * Environment variable access that survives how the variable got there.
 *
 * Real failure this guards against: env vars piped into `vercel env add` from
 * PowerShell arrive with a UTF-8 BOM (U+FEFF) prepended. A BOM in a header
 * value makes undici throw "Cannot convert argument to a ByteString", which
 * surfaced as every YouVersion call failing in production while the exact
 * same key worked locally. Invisible character, invisible diff, hard 502.
 *
 * So every secret is read through this: strip BOM and zero-width characters,
 * trim whitespace, return undefined for effectively-empty values.
 */

export function cleanEnv(name: string): string | undefined {
  const raw = process.env[name];
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/[﻿​‌‍]/g, '').trim();
  return cleaned.length > 0 ? cleaned : undefined;
}
