/**
 * Turn a link into plain source text.
 *
 * The third way into the studio, beside a topic and a pasted document: give it
 * an article, blog post or PDF URL and it reads the words out of that page.
 * What comes back is treated exactly like a pasted sermon — it is mined for
 * teachings, and those teachings carry REFERENCES only. Nothing fetched here
 * can become Scripture on screen; the verse is still retrieved from YouVersion
 * afterwards. That rule has no exception for where the text came from.
 *
 * No API keys and no paid service; pages are fetched and stripped with a small
 * readability pass. It is best-effort by nature — a site that renders its body
 * in client-side JavaScript cannot be read this way — and those cases return a
 * clear, actionable message rather than a stack trace or, worse, a page of
 * navigation chrome passed off as a sermon.
 *
 * YouTube is declined at the door; `lib/source/youtube` explains why at
 * length. Short version: captions cannot be fetched from a datacenter IP, the
 * failure is indistinguishable from a private video, and the honest response
 * is to say so immediately rather than after a twenty-second wait.
 */

import { isYouTubeUrl, YOUTUBE_NOT_SUPPORTED } from './youtube';

/** Pretend to be a browser: several sites serve an interstitial otherwise. */
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FETCH_TIMEOUT_MS = 20000;

export interface LinkSource {
  text: string;
  /** Page title, when the page offered one. */
  title?: string;
  kind: 'article';
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

export async function fetchLinkSource(raw: string): Promise<LinkSource> {
  const input = raw.trim();
  if (!isHttpUrl(input)) {
    throw new LinkError('That does not look like a link. Paste a full http:// or https:// address.');
  }

  // The browser stops this first, so reaching here means a caller that is not
  // the studio — an MCP client, a script. Same answer either way.
  if (isYouTubeUrl(input)) throw new LinkError(YOUTUBE_NOT_SUPPORTED);

  return fetchArticle(input);
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
