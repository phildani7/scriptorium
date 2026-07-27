/**
 * AI images via the Kie.ai GPT-Image API — 1:1, 1024x1024, low quality tier,
 * exactly one image per short (the device's imagePrompt). Kept behind an env
 * gate: without KIE_API_KEY the studio disables the option and nothing here
 * runs. Endpoints and model are env-overridable because this API is young
 * and the key arrives after this infrastructure ships.
 *
 *   KIE_API_KEY       bearer token (required to enable the mode)
 *   KIE_API_BASE      default https://api.kie.ai
 *   KIE_IMAGE_MODEL   default gpt-image-1
 *
 * Task shape (Kie's 4o-image/GPT-image family):
 *   POST {base}/api/v1/gpt4o-image/generate      { prompt, size, ... } -> { data: { taskId } }
 *   GET  {base}/api/v1/gpt4o-image/record-info?taskId=...
 *        -> { data: { status/successFlag, response: { resultUrls } } }
 */

import type { VisualItem } from '@/lib/types';

const BASE = () => process.env.KIE_API_BASE ?? 'https://api.kie.ai';
const MODEL = () => process.env.KIE_IMAGE_MODEL ?? 'gpt-image-1';

export function kieConfigured(): boolean {
  return Boolean(process.env.KIE_API_KEY);
}

interface KieCreateResponse {
  code?: number;
  msg?: string;
  data?: { taskId?: string };
}

interface KieRecordResponse {
  code?: number;
  data?: {
    status?: string;
    successFlag?: number;
    response?: { resultUrls?: string[]; result_urls?: string[] };
    errorMessage?: string;
  };
}

/**
 * Generate one 1:1 image. Resolves to null on any failure or when the task
 * doesn't finish inside `budgetMs` — the caller degrades to icons-only, so a
 * slow or broken image API can never block a short.
 */
export async function generateKieImage(
  prompt: string,
  budgetMs = 45000,
): Promise<VisualItem | null> {
  const key = process.env.KIE_API_KEY;
  if (!key) return null;
  const started = Date.now();
  const headers = {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  try {
    const create = await fetch(`${BASE()}/api/v1/gpt4o-image/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: MODEL(),
        prompt,
        size: '1:1',
        quality: 'low',
        nVariants: 1,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!create.ok) return null;
    const created = (await create.json()) as KieCreateResponse;
    const taskId = created.data?.taskId;
    if (!taskId) return null;

    // Poll until done or out of budget.
    while (Date.now() - started < budgetMs) {
      await new Promise((r) => setTimeout(r, 3000));
      const record = await fetch(
        `${BASE()}/api/v1/gpt4o-image/record-info?taskId=${encodeURIComponent(taskId)}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!record.ok) continue;
      const info = (await record.json()) as KieRecordResponse;
      const data = info.data;
      if (!data) continue;
      const failed =
        data.successFlag === 2 ||
        data.successFlag === 3 ||
        data.status === 'GENERATE_FAILED';
      if (failed) return null;
      const urls = data.response?.resultUrls ?? data.response?.result_urls ?? [];
      if (urls.length > 0) {
        return {
          kind: 'ai-image',
          src: urls[0],
          term: 'ai',
          timeSec: 0, // anchored by the caller
          slot: 0,
          credit: `AI image (${MODEL()} via kie.ai)`,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}
