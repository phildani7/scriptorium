/**
 * A creator's own source -> teachings, each anchored to a passage.
 *
 * Three shapes of source arrive here and converge immediately:
 *   - pasted text                    { text }
 *   - an article / blog / PDF link   { url }
 *   - an uploaded .txt / .pdf        multipart
 *
 * The model mines the SOURCE for teachings and returns references only;
 * picking one runs the same resolve -> generate path as any other input, so
 * the verse text still comes verbatim from YouVersion. Nothing from an upload
 * or a web page can become Scripture on screen.
 *
 * YouTube links are refused by `fetchLinkSource` — see `lib/source/youtube`.
 * The studio stops them in the browser, but this rule has to live here too:
 * the MCP tools and any direct caller never see that warning.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { getProvider } from '@/lib/ai';
import {
  buildTeachingExtractionPrompt,
  coerceTeachings,
  TEACHING_LIST_SCHEMA,
} from '@/lib/ai/provider';
import { getLanguage } from '@/lib/languages/registry';
import { fetchLinkSource, LinkError } from '@/lib/source/link';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Roughly a long sermon. Beyond this the tail is dropped, and we say so. */
const MAX_CHARS = 24_000;

export async function POST(request: Request) {
  const limited = guard(request, 'extract', 10);
  if (limited) return limited;

  let text = '';
  let languageCode = 'en';
  /** Where the words came from, echoed back so the creator can see it. */
  let sourceNote: string | undefined;

  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      languageCode = String(form.get('languageCode') ?? 'en');
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'Attach a .txt or .pdf file.' }, { status: 400 });
      }
      const isPdf =
        file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
      if (isPdf) {
        const { extractText, getDocumentProxy } = await import('unpdf');
        const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()));
        const result = await extractText(pdf, { mergePages: true });
        text = result.text;
      } else {
        text = await file.text();
      }
    } else {
      const body = (await request.json()) as {
        text?: string;
        url?: string;
        languageCode?: string;
      };
      languageCode = body.languageCode ?? 'en';

      if (body.url?.trim()) {
        const source = await fetchLinkSource(body.url);
        text = source.text;
        sourceNote = `Read from ${source.origin}. Scripture still comes from YouVersion, never from the page.`;
      } else {
        text = body.text ?? '';
      }
    }
  } catch (error) {
    // A link that cannot be read is a normal outcome the creator can act on
    // (captions off, JS-rendered page), not a server fault.
    if (error instanceof LinkError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Could not read the source: ${message}` },
      { status: 400 },
    );
  }

  text = text.replace(/\s+/g, ' ').trim();
  if (text.length < 120) {
    return NextResponse.json(
      { error: 'That source is too short to mine — give it at least a paragraph.' },
      { status: 400 },
    );
  }

  const truncated = text.length > MAX_CHARS;
  if (truncated) text = text.slice(0, MAX_CHARS);

  try {
    const languageName = getLanguage(languageCode)?.name ?? languageCode;
    const raw = await getProvider().completeJson({
      system: buildTeachingExtractionPrompt(languageName),
      user: `SOURCE TEXT:\n\n${text}`,
      maxTokens: 2000,
      schema: TEACHING_LIST_SCHEMA,
    });
    const result = coerceTeachings(raw);

    // Not an error: a document this tool is not for. Declined politely, and
    // the studio goes straight back to accepting a new source.
    if (result.decline) {
      return NextResponse.json({ teachings: [], declined: true, message: result.decline });
    }

    const truncationNote = truncated
      ? `The source was long; teachings were mined from the first ${MAX_CHARS.toLocaleString()} characters.`
      : undefined;

    return NextResponse.json({
      teachings: result.teachings,
      notice: [sourceNote, truncationNote].filter(Boolean).join(' ') || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
