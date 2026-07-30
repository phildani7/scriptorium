/**
 * Turn a link into plain source text.
 *
 * The third way into the studio, beside a topic and a pasted document: give it
 * a YouTube video or an article URL and it reads the words out of that page.
 * What comes back is treated exactly like a pasted sermon — it is mined for
 * teachings, and those teachings carry REFERENCES only. Nothing fetched here
 * can become Scripture on screen; the verse is still retrieved from YouVersion
 * afterwards. That rule has no exception for where the text came from.
 *
 * No API keys and no paid service. YouTube captions come from the same
 * timedtext endpoint the player itself uses; articles are fetched and stripped
 * with a small readability pass. Both are best-effort by nature: a video with
 * captions disabled, or a site that renders its body in client-side
 * JavaScript, cannot be read this way. Those cases return a clear, actionable
 * message rather than a stack trace or, worse, a page of navigation chrome
 * passed off as a sermon.
 */

/** Pretend to be a browser: several sites serve an interstitial otherwise. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 20000;

export interface LinkSource {
  text: string;
  /** Page or video title, when the page offered one. */
  title?: string;
  kind: 'youtube' | 'article';
  /** Human-readable origin, shown back to the creator. */
  origin: string;
}

export class LinkError extends Error {}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/** The video id, for any of the shapes YouTube hands out. */
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
  if (host !== 'youtube.com' && host !== 'm.youtube.com' && host !== 'music.youtube.com') {
    return null;
  }
  const v = url.searchParams.get('v');
  if (v && /^[\w-]{11}$/.test(v)) return v;

  const path = url.pathname.match(/^\/(shorts|embed|live|v)\/([\w-]{11})/);
  return path ? path[2] : null;
}

export async function fetchLinkSource(raw: string): Promise<LinkSource> {
  const input = raw.trim();
  if (!isHttpUrl(input)) {
    throw new LinkError('That does not look like a link. Paste a full http:// or https:// address.');
  }

  const videoId = youTubeId(input);
  return videoId ? fetchYouTube(videoId) : fetchArticle(input);
}

async function get(url: string, headers: Record<string, string> = {}) {
  const response = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'en;q=0.9,*;q=0.5', ...headers },
    redirect: 'follow',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new LinkError(`That link returned HTTP ${response.status}.`);
  }
  return response;
}

/* ---------------------------------------------------------------------- */
/* YouTube                                                                 */
/* ---------------------------------------------------------------------- */

/**
 * Captions come from InnerTube — the API the YouTube apps themselves call —
 * not from scraping `ytInitialPlayerResponse` out of the watch page.
 *
 * The watch page still CONTAINS caption tracks, which is what makes the
 * scraping approach so convincing: the JSON parses, the track list looks
 * right, `baseUrl` is there. Fetching that `baseUrl` server-side then returns
 * **HTTP 200 with a zero-byte body**. The URLs are bound to the browser
 * session that was served the page, and the failure is silent — no error
 * status, no message, just nothing. Anything built on the watch page is
 * therefore not merely fragile, it is already broken.
 *
 * The mobile-app clients are not session-bound and hand back caption URLs
 * that work from anywhere. iOS is tried first because its tracks serve
 * `json3`, a stable documented shape; Android is the fallback and serves the
 * older `<timedtext>` XML, which `captionText` also reads. No key of ours,
 * no quota, no account.
 */
const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

const CLIENTS: ReadonlyArray<Record<string, unknown>> = [
  { clientName: 'IOS', clientVersion: '20.10.4', deviceModel: 'iPhone16,2', hl: 'en' },
  { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 30, hl: 'en' },
];

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

interface PlayerResponse {
  videoDetails?: { title?: string; shortDescription?: string };
  playabilityStatus?: { status?: string; reason?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
}

/**
 * Prefer a human-written track over an automatic one, and English over the
 * rest — ASR captions arrive without punctuation, and the teaching extractor
 * reads sentences.
 */
function pickTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const score = (t: CaptionTrack) =>
    (t.kind === 'asr' ? 0 : 2) + (t.languageCode?.startsWith('en') ? 1 : 0);
  return [...tracks].filter((t) => t.baseUrl).sort((a, b) => score(b) - score(a))[0];
}

interface PlayerAttempt {
  response: PlayerResponse | null;
  /** Why each client refused, in order. Empty when one succeeded. */
  refusals: string[];
}

async function playerResponse(videoId: string): Promise<PlayerAttempt> {
  const refusals: string[] = [];

  for (const client of CLIENTS) {
    const name = String(client.clientName);
    try {
      const response = await fetch(
        `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
          body: JSON.stringify({ videoId, context: { client } }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        refusals.push(`${name}:HTTP ${response.status}`);
        continue;
      }
      const json = (await response.json()) as PlayerResponse;
      // A client that cannot play the video reports no captions either, so
      // move on rather than concluding the video has none.
      if (json.playabilityStatus?.status === 'OK') return { response: json, refusals: [] };
      refusals.push(
        `${name}:${json.playabilityStatus?.status ?? 'no status'}` +
          (json.playabilityStatus?.reason ? ` (${json.playabilityStatus.reason})` : ''),
      );
    } catch (error) {
      refusals.push(`${name}:${error instanceof Error ? error.name : 'failed'}`);
    }
  }
  return { response: null, refusals };
}

/**
 * YouTube refuses InnerTube player requests from datacenter IP ranges, which
 * is where this code runs in production. The refusal arrives as a normal
 * playability status — LOGIN_REQUIRED, or a bot-check reason — and looks
 * exactly like a private or removed video, so the two have to be told apart
 * before the creator is told anything.
 */
function isBotWall(refusals: string[]): boolean {
  return refusals.some((r) =>
    /LOGIN_REQUIRED|not a bot|Sign in|bot|CONTENT_CHECK|AGE_VERIFICATION/i.test(r),
  );
}

/** Caption bodies arrive as json3 or as the older timedtext XML. Read both. */
function captionText(body: string): string {
  const trimmed = body.trim();

  if (trimmed.startsWith('{')) {
    try {
      const json = JSON.parse(trimmed) as {
        events?: Array<{ segs?: Array<{ utf8?: string }> }>;
      };
      return (json.events ?? [])
        .flatMap((e) => e.segs ?? [])
        .map((s) => s.utf8 ?? '')
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    } catch {
      return '';
    }
  }

  if (trimmed.startsWith('<')) {
    // <p t="…" d="…">text</p>, sometimes with nested <s> segment spans.
    const parts = [...trimmed.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)].map((m) =>
      decodeEntities(m[1].replace(/<[^>]+>/g, '')),
    );
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  return '';
}

async function fetchYouTube(videoId: string): Promise<LinkSource> {
  const { response: player, refusals } = await playerResponse(videoId);
  if (!player) {
    // Telling a creator their video is "private or removed" when the truth is
    // "this server is blocked" sends them to check a video that is fine. The
    // two failures need different sentences.
    if (isBotWall(refusals)) {
      throw new LinkError(
        'YouTube is refusing to serve captions to this server — it blocks ' +
          'requests from cloud hosting, which is where this app runs. Open ' +
          "the video's transcript on YouTube (⋯ → Show transcript), copy it, " +
          'and paste it into “From your text”. Article links are unaffected.',
      );
    }
    throw new LinkError(
      'That video could not be opened — it may be private, age-restricted, ' +
        `region-locked, or removed. (${refusals.join('; ') || 'no response'})`,
    );
  }

  const title = player.videoDetails?.title?.trim() || undefined;
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = pickTrack(tracks);

  if (!track?.baseUrl) {
    throw new LinkError(
      'That video has no captions available, so there is no text to read. ' +
        'Try a video with captions turned on, or paste the transcript into ' +
        '“From your text”.',
    );
  }

  // Ask for json3; a track that ignores the hint answers in XML, which
  // `captionText` also reads.
  const url = new URL(track.baseUrl);
  url.searchParams.set('fmt', 'json3');

  let body: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    body = await response.text();
  } catch {
    throw new LinkError('The caption track for that video could not be downloaded.');
  }

  const text = captionText(body);
  if (text.length < 120) {
    throw new LinkError(
      "That video's captions are too short to mine for teachings — " +
        'give it something with a few paragraphs of speech.',
    );
  }

  return {
    text: title ? `${title}\n\n${text}` : text,
    title,
    kind: 'youtube',
    origin: `youtube.com/watch?v=${videoId}`,
  };
}

/* ---------------------------------------------------------------------- */
/* Articles                                                                */
/* ---------------------------------------------------------------------- */

/** Elements whose contents are never body copy. */
const DROP =
  /<(script|style|noscript|template|svg|nav|header|footer|aside|form|iframe|figure)\b[^>]*>[\s\S]*?<\/\1>/gi;

async function fetchArticle(url: string): Promise<LinkSource> {
  const response = await get(url);
  const type = response.headers.get('content-type') ?? '';

  if (type.includes('application/pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(await response.arrayBuffer()));
    const result = await extractText(pdf, { mergePages: true });
    const text = String(result.text).replace(/\s+/g, ' ').trim();
    if (text.length < 120) throw new LinkError('That PDF had almost no extractable text.');
    return { text, kind: 'article', origin: new URL(url).hostname };
  }

  if (!type.includes('html') && !type.includes('text/plain') && type !== '') {
    throw new LinkError(`That link is a ${type.split(';')[0]}, which has no readable text.`);
  }

  const html = await response.text();
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const text = readable(html);

  if (text.length < 120) {
    throw new LinkError(
      'There was almost no readable text at that link — some sites build the ' +
        'article in the browser, where a plain fetch cannot see it. Paste the ' +
        'text into “From your text” instead.',
    );
  }

  return {
    text: title ? `${title}\n\n${text}` : text,
    title: title || undefined,
    kind: 'article',
    origin: new URL(url).hostname,
  };
}

/**
 * Strip a page down to its prose.
 *
 * Deliberately small. A real readability port is a dependency and a licence
 * question, and this only has to be good enough to hand a language model
 * something to mine. The one thing it must not do is return a page of
 * navigation labels that look like teaching material, so the <article>/<main>
 * subtree wins when present, and short link-dense lines are dropped after.
 */
export function readable(html: string): string {
  let body = html.replace(DROP, ' ');

  const main =
    body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    body.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    body;
  body = main;

  const text = body
    // Block edges become newlines so paragraphs survive as separate lines.
    .replace(/<\/(p|div|section|h[1-6]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    // Menu items, bylines and cookie notices are short; sentences are not.
    .filter((line) => line.length >= 40)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    mdash: ', ', ndash: '-', hellip: '.', rsquo: '’', lsquo: '‘',
    ldquo: '“', rdquo: '”', middot: '·', bull: '•',
  };
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole);
}

function safeCodePoint(code: number): string {
  return Number.isFinite(code) && code > 0 && code <= 0x10ffff
    ? String.fromCodePoint(code)
    : '';
}
