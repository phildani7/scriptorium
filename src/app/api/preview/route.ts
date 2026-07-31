/**
 * Bake a ShortSpec into a template and return the composition HTML.
 *
 * The creator screen drops this straight into an iframe. It is the same
 * operation the MP4 export performs, so what a creator approves in the browser
 * is byte-for-byte what the renderer will capture — the preview cannot flatter
 * the export.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { bakeComposition } from '@/lib/render/bake';
import type { StyleId } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * The styles that actually have a template on disk.
 *
 * `StyleId` still names two more, `paper-cutout` and `manuscript`, which were
 * planned and never built. Listing them here allowed them past the guard and
 * into `readFile`, which then answered "Template is not built yet" with a 404
 * — an accurate message for a request that should never have been let through.
 * The allowlist's job is to decide what is renderable, so it names what exists.
 */
const STYLES: readonly StyleId[] = ['warm-minimal', 'kinetic-type', 'neon-night'];

export async function POST(request: Request) {
  const limited = guard(request, 'preview', 60);
  if (limited) return limited;

  let body: { spec?: Record<string, unknown> };
  try {
    body = (await request.json()) as { spec?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const spec = body.spec;
  if (!spec || typeof spec !== 'object') {
    return NextResponse.json({ error: 'A spec is required.' }, { status: 400 });
  }

  const requested = String(spec.style ?? 'warm-minimal') as StyleId;
  // Never interpolate a caller-supplied value into a filesystem path.
  const style = STYLES.includes(requested) ? requested : 'warm-minimal';

  let template: string;
  try {
    template = await readFile(
      join(process.cwd(), 'templates', style, 'index.html'),
      'utf8',
    );
  } catch {
    return NextResponse.json(
      { error: `Template "${style}" is not built yet.` },
      { status: 404 },
    );
  }

  // The preview drives its own <audio> element in PreviewFrame, so the
  // composition's narration element is dropped here; everything else is baked
  // exactly as the renderer bakes it.
  const html = bakeComposition({ template, spec, audioSrc: '' });

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
