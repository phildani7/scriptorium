/**
 * MP4 export.
 *
 * Vercel functions cannot render video — no Chromium, no FFmpeg, a 60-second
 * ceiling — so export is a hand-off, not a job. Three paths, first available
 * wins (the preferred one is chosen by `body.backend` or RENDER_BACKEND):
 *
 *   actions     GITHUB_DISPATCH_TOKEN + GITHUB_REPO are set: fire a
 *               repository_dispatch carrying a COMPACT render request. The
 *               Actions runner re-synthesizes narration from its own secrets,
 *               re-fetches the passage (the render gate does that regardless),
 *               renders, and commits the MP4 + poster into the gallery.
 *
 *   sandbox     a Vercel Sandbox microVM clones the repo and runs the SAME
 *               scripts/render-request.ts, detached, then pushes the gallery
 *               entry with the same bot identity. Kept alongside Actions as a
 *               deliberate second cloud path — neither replaces the other.
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
import { cleanEnv } from '@/lib/env';
import { guard } from '@/lib/rate-limit';
import { addQueued } from '@/lib/feedback/store';
import { launchSandboxRender, sandboxConfigured } from '@/lib/render/sandbox';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type RenderBackend = 'actions' | 'sandbox';

export async function POST(request: Request) {
  const limited = guard(request, 'export', 10);
  if (limited) return limited;

  let body: { spec?: Record<string, unknown>; backend?: RenderBackend };
  try {
    body = (await request.json()) as { spec?: Record<string, unknown>; backend?: RenderBackend };
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const spec = body.spec;
  if (!spec || typeof spec !== 'object' || !spec.passage) {
    return NextResponse.json({ error: 'A composed spec is required.' }, { status: 400 });
  }

  const token = cleanEnv('GITHUB_DISPATCH_TOKEN');
  const repo = cleanEnv('GITHUB_REPO'); // "owner/name"
  const actionsAvailable = Boolean(token && repo);
  const sandboxAvailable = sandboxConfigured();

  const preferred: RenderBackend =
    body.backend ?? (cleanEnv('RENDER_BACKEND') as RenderBackend | undefined) ?? 'actions';
  // Preferred backend first, the other as fallback, local spec last.
  const backend: RenderBackend | null =
    preferred === 'sandbox'
      ? sandboxAvailable
        ? 'sandbox'
        : actionsAvailable
          ? 'actions'
          : null
      : actionsAvailable
        ? 'actions'
        : sandboxAvailable
          ? 'sandbox'
          : null;

  if (!backend) {
    return NextResponse.json({
      queued: false,
      spec,
      message:
        'Cloud rendering is not configured on this deployment, so here is the ' +
        'spec instead — render it locally with `npm run render -- --spec <file>`.',
    });
  }

  // Compact request: everything the runner needs, nothing it can rebuild.
  // Icons re-derive deterministically from the device on the runner; only the
  // hero image (a paid AI generation or a fetched CC0 photo) must travel.
  const visuals = spec.visuals as
    | { mode?: string; items?: Array<{ kind?: string; src?: string }> }
    | undefined;
  // Doc-sourced shorts quote the verse; the runner rebuilds narration from
  // the script, so the shape flag must travel with the request.
  const specSegments = (spec.narration as { segments?: Array<{ kind?: string }> } | undefined)
    ?.segments;
  const speakVerse =
    Array.isArray(specSegments) &&
    specSegments.some((s) => s.kind === 'verse') &&
    Boolean((spec.device as { explanation?: string } | undefined)?.explanation);

  const renderRequest = {
    id: spec.id,
    style: spec.style,
    speakVerse,
    theme: spec.theme ?? {},
    languageCode: spec.languageCode,
    voice: spec.voice,
    passage: spec.passage,
    device: spec.device,
    script: spec.script,
    dir: spec.dir,
    visuals: visuals?.mode
      ? {
          mode: visuals.mode,
          items: (visuals.items ?? []).filter(
            (i) => i.kind !== 'icon' && i.src,
          ),
        }
      : undefined,
  };

  if (backend === 'sandbox') {
    try {
      const { sandboxId } = await launchSandboxRender(renderRequest);
      void addQueued({
        id: String(spec.id ?? ''),
        reference: String((spec.passage as { reference?: string })?.reference ?? ''),
        language: String(spec.languageCode ?? ''),
        style: String(spec.style ?? ''),
      });
      return NextResponse.json({
        queued: true,
        message:
          'Export queued in a Vercel Sandbox microVM. It is verifying the verse ' +
          'against YouVersion, synthesizing narration, and producing the MP4 — ' +
          'it lands in the gallery in a few minutes.',
        sandboxId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // The sandbox failing to launch must not kill the export while the
      // Actions path still exists.
      if (!actionsAvailable) {
        return NextResponse.json(
          { error: `Sandbox render failed to launch: ${message}` },
          { status: 502 },
        );
      }
    }
  }

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

      void addQueued({
        id: String(spec.id ?? ''),
        reference: String((spec.passage as { reference?: string })?.reference ?? ''),
        language: String(spec.languageCode ?? ''),
        style: String(spec.style ?? ''),
      });
  return NextResponse.json({
    queued: true,
    message:
      'Export queued. A render job is verifying the verse against YouVersion, ' +
      'synthesizing narration, and producing the MP4 — it lands in the gallery ' +
      'in a few minutes.',
    runUrl: `https://github.com/${repo}/actions`,
  });
}
