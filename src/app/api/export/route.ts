/**
 * MP4 export.
 *
 * Vercel functions cannot render video — no Chromium, no FFmpeg, a 60-second
 * ceiling — so export is a hand-off, not a job. Two paths:
 *
 *   configured  GITHUB_DISPATCH_TOKEN + GITHUB_REPO are set: fire a
 *               repository_dispatch carrying a COMPACT render request. The
 *               Actions runner re-synthesizes narration from its own secrets,
 *               re-fetches the passage (the render gate does that regardless),
 *               renders, and commits the MP4 + poster into the gallery.
 *
 *   fallback    return the full spec so the creator can render locally with
 *               `npm run render`. Degraded, but never dead.
 *
 * The dispatch payload deliberately excludes narration audio and timings:
 * repository_dispatch caps client_payload well below a base64 WAV, and the
 * runner re-creating narration from the script keeps the payload a few KB
 * while producing an identical result (same script, same voice, same aligner).
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { spec?: Record<string, unknown> };
  try {
    body = (await request.json()) as { spec?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const spec = body.spec;
  if (!spec || typeof spec !== 'object' || !spec.passage) {
    return NextResponse.json({ error: 'A composed spec is required.' }, { status: 400 });
  }

  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO; // "owner/name"

  if (!token || !repo) {
    return NextResponse.json({
      queued: false,
      spec,
      message:
        'Cloud rendering is not configured on this deployment, so here is the ' +
        'spec instead — render it locally with `npm run render -- --spec <file>`.',
    });
  }

  // Compact request: everything the runner needs, nothing it can rebuild.
  const renderRequest = {
    id: spec.id,
    style: spec.style,
    theme: spec.theme ?? {},
    languageCode: spec.languageCode,
    voice: spec.voice,
    passage: spec.passage,
    device: spec.device,
    script: spec.script,
    dir: spec.dir,
  };

  const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      event_type: 'render-short',
      client_payload: { request: renderRequest },
    }),
  });

  if (response.status !== 204) {
    const detail = await response.text().catch(() => '');
    return NextResponse.json(
      { error: `GitHub dispatch failed: ${response.status}. ${detail.slice(0, 200)}` },
      { status: 502 },
    );
  }

  return NextResponse.json({
    queued: true,
    message:
      'Export queued. A render job is verifying the verse against YouVersion, ' +
      'synthesizing narration, and producing the MP4 — it lands in the gallery ' +
      'in a few minutes.',
    runUrl: `https://github.com/${repo}/actions`,
  });
}
