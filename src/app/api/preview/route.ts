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
import type { StyleId } from '@/lib/types';

export const dynamic = 'force-dynamic';

const STYLES: readonly StyleId[] = [
  'warm-minimal',
  'kinetic-type',
  'paper-cutout',
  'neon-night',
  'manuscript',
];

export async function POST(request: Request) {
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

  // Escaping `</` prevents a passage or device string from closing the script
  // tag and injecting markup into the composition.
  const json = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');

  const html = template.replace(
    /(<script id="short-spec" type="application\/json">)[\s\S]*?(<\/script>)/,
    `$1\n${json}\n$2`,
  );

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
