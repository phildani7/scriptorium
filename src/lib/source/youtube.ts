/**
 * Recognising a YouTube link, and the one sentence we say about it.
 *
 * Its own module, deliberately tiny and dependency-free, because both sides
 * need it: the browser, to stop a creator before they wait on a request that
 * cannot succeed, and the API route, so the same rule holds for the MCP tools
 * and anything else calling `/api/extract` directly. Importing `link.ts` into
 * a client component to get this would drag the PDF reader into the browser
 * bundle for one regex.
 *
 * WHY YOUTUBE IS NOT SUPPORTED
 * ----------------------------
 * It is not a missing feature. It was built, it works, and it cannot ship.
 *
 * Captions were read through InnerTube — the API the YouTube apps themselves
 * call — which returns caption tracks with no key and no quota. From a laptop
 * it pulls a full transcript. From this app in production it returns nothing
 * at all: YouTube refuses player requests from datacenter IP ranges, which is
 * exactly where Vercel runs. Every video, not some. The refusal arrives as an
 * ordinary playability status, so it reads identically to a private or
 * deleted video — which is how the first version came to tell creators their
 * perfectly public video was unavailable.
 *
 * Two things would change this, neither of them cheap and neither of them
 * free: routing the fetch through a residential proxy, or moving it into the
 * browser, where it is blocked by CORS instead. Until one of those is worth
 * paying for, the honest thing is to say so up front and point at the
 * transcript, which takes a creator about fifteen seconds.
 *
 * The working implementation is in the history of `src/lib/source/link.ts` if
 * a proxy ever makes it viable.
 */

/** The video id, for any of the shapes YouTube hands out; null if not YouTube. */
export function youTubeId(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (!['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
    return null;
  }

  const v = url.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;

  const path = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
  return path ? path[2] : null;
}

/**
 * True for any YouTube address, including ones with no readable video id —
 * a channel page, a playlist, a bare `youtube.com`. The point is to answer
 * the creator's actual question ("can I use YouTube?"), which does not depend
 * on whether the link they happened to paste was well formed.
 */
export function isYouTubeUrl(raw: string): boolean {
  if (youTubeId(raw)) return true;
  try {
    const host = new URL(raw.trim()).hostname.replace(/^www\./, '').toLowerCase();
    return ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(host);
  } catch {
    return false;
  }
}

/**
 * Said in the browser the moment a YouTube link is pasted, and again by the
 * API for callers that are not the browser. It names the cause, because
 * "unsupported" invites a retry, and gives the workaround, because the
 * transcript is genuinely two clicks away.
 */
export const YOUTUBE_NOT_SUPPORTED =
  'YouTube links are not supported: YouTube blocks caption requests from ' +
  'cloud servers, which is where this app runs, so there is no way to read ' +
  'the video from here. Open the video on YouTube, use ⋯ → Show transcript, ' +
  'copy it, and paste it into “From your text” — that works well. Article, ' +
  'blog and PDF links work here as normal.';
