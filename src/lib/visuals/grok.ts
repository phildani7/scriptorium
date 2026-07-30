/**
 * AI images via xAI's Grok Imagine.
 *
 * STRICT BOUNDARY — READ BEFORE EDITING
 * -------------------------------------
 * Grok is wired into this project for PICTURES AND NOTHING ELSE. This module
 * calls exactly one endpoint, `/v1/images/generations`, and there is no code
 * path anywhere in the repo that sends a chat/completions request to xAI. That
 * is deliberate and it is a product rule, not an accident of what got built:
 *
 *   - Verse text comes from YouVersion. Always. No model writes Scripture.
 *   - Teaching prose comes from the configured AI provider (Gloo in
 *     production, Claude in development) — see `lib/ai`. Gloo's values
 *     alignment is a competition requirement and Grok must never displace it.
 *   - Grok draws. That is the whole job.
 *
 * If you find yourself adding a text call here, the answer is `lib/ai`.
 *
 * Config:
 *   XAI_API_KEY     bearer token (required to enable AI-visual mode)
 *   XAI_API_BASE    default https://api.x.ai
 *   XAI_IMAGE_MODEL default grok-imagine-image
 *
 * Resolution is deliberately the floor the API offers: `grok-imagine-image`
 * (not the `-quality` tier) at aspect_ratio 9:16 returns 720x1280. That is
 * exactly 2/3 of the 1080x1920 frame, so it upscales on clean thirds, and it
 * is the cheapest generation xAI sells.
 */

import type { VisualItem } from '@/lib/types';

const BASE = () => process.env.XAI_API_BASE ?? 'https://api.x.ai';
const MODEL = () => process.env.XAI_IMAGE_MODEL ?? 'grok-imagine-image';

/** The lowest tier the API offers for this model family. */
const ASPECT_RATIO = '9:16';

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

/**
 * The house style, appended to every prompt.
 *
 * Two halves. The first is the look — lifted from the BibleBuddies doodle
 * series in `lib/visuals/doodles`, so a generated frame sits beside a reused
 * panel without a visible seam. The second is the LAYOUT contract, which is
 * the part that actually matters: the short prints one sentence over the top
 * of this image and a caption rail across the bottom, so both zones have to
 * come back quiet. Asking for them costs nothing; repairing a busy frame
 * costs a regeneration.
 *
 * "No lettering" is not a style note either. Words drawn into the art would
 * appear under the sentence in whatever language the model felt like, in a
 * short whose entire claim is that on-screen text is accounted for.
 */
const STYLE = [
  'Hand-drawn children\'s Bible sketchbook doodle illustration.',
  'Bold black marker outlines, vibrant crayon and coloured-pencil shading,',
  'warm cream textured paper ground, small doodled stars, hearts and swirls',
  'scattered around the outer margins. Cheerful, reverent, wholesome.',
  'VERTICAL 9:16 composition with a strict layout:',
  'the TOP QUARTER of the frame must be clean empty cream paper with nothing',
  'drawn in it; the main illustration sits in the MIDDLE of the frame;',
  'the BOTTOM FIFTH must be simple and uncluttered.',
  'ABSOLUTELY NO text, no letters, no words, no numbers, no speech bubbles,',
  'no captions, no signs and no labels anywhere in the image.',
  'Do not depict the face of God. Keep any peril gentle and non-graphic.',
].join(' ');

interface GrokImageResponse {
  data?: Array<{ url?: string; b64_json?: string; mime_type?: string }>;
  error?: unknown;
}

/**
 * Generate one vertical doodle image for a teaching.
 *
 * Resolves to null on any failure — a missing key, a refusal, a timeout, a
 * bad payload. The caller degrades to the plain themed background, so a slow
 * or unhappy image API can never block a short from being made. That is the
 * same contract every other visual provider here honours.
 */
export async function generateGrokImage(
  prompt: string,
  budgetMs = 60000,
): Promise<VisualItem | null> {
  const key = process.env.XAI_API_KEY;
  if (!key || !prompt.trim()) return null;

  try {
    const response = await fetch(`${BASE()}/v1/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL(),
        prompt: `${prompt.trim()} ${STYLE}`,
        n: 1,
        aspect_ratio: ASPECT_RATIO,
        response_format: 'url',
      }),
      signal: AbortSignal.timeout(budgetMs),
    });

    if (!response.ok) return null;
    const json = (await response.json()) as GrokImageResponse;
    const first = json.data?.[0];
    const src = first?.url
      ? first.url
      : first?.b64_json
        ? `data:${first.mime_type ?? 'image/jpeg'};base64,${first.b64_json}`
        : '';
    if (!src) return null;

    return {
      kind: 'ai-image',
      src,
      term: 'ai',
      timeSec: 0, // anchored by the caller
      slot: 0,
      // A generated frame cannot be measured the way a shipped panel is —
      // it does not exist until the request returns — so it takes the floor
      // the template applies to full-bleed panels. The prompt asks for a
      // clean top quarter and the model obliges in the centre, but it still
      // scatters margin doodles up there; the scrim covers them.
      band: 26,
      // Sampled from real output rather than guessed: grok-imagine-image
      // draws this style on a slightly warmer stock than the shipped panels
      // (#faeed2 vs #fdf8e4), and an 18/255 mismatch in blue is visible as a
      // seam where the scrim ends. Measured with scripts/smoke-grok.ts.
      paper: '#faeed2',
      credit: `AI image (${MODEL()} via xAI)`,
    };
  } catch {
    return null;
  }
}
