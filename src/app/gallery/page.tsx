'use client';

/**
 * The gallery.
 *
 * Every entry is a pre-rendered MP4 committed to /public/gallery by the render
 * pipeline — a judge on hotel wifi clicks play on a static file; nothing here
 * depends on a warm API. Exports queued from the studio land in this same
 * manifest via the render workflow.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface GalleryEntry {
  id: string;
  video: string;
  poster: string | null;
  reference: string;
  version: string;
  attribution?: string;
  language: string;
  style: string;
  lens: string;
  durationSec: number;
  timingSource: string;
}

export default function GalleryPage() {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);

  useEffect(() => {
    fetch('/gallery/manifest.json')
      .then((r) => (r.ok ? r.json() : []))
      .then(setEntries)
      .catch(() => setEntries([]));
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Gallery</h1>
          <p className="mt-1 text-sm text-inksoft">
            Pre-rendered shorts. Every verse passed the integrity gate against
            a live YouVersion response before a single frame was captured.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Make your own
        </Link>
      </header>

      {entries === null && (
        <p className="text-sm text-inksoft">Loading…</p>
      )}

      {entries !== null && entries.length === 0 && (
        <div className="rounded-2xl border border-rule bg-panel p-10 text-center text-inksoft">
          Nothing here yet — export a short from the studio and it will appear
          in this gallery once the render job finishes.
        </div>
      )}

      {entries !== null && entries.length > 0 && (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry) => (
            <figure
              key={entry.id}
              className="overflow-hidden rounded-2xl border border-rule bg-panel shadow-sm"
            >
              <video
                src={entry.video}
                poster={entry.poster ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="aspect-9/16 w-full bg-ink object-cover"
              />
              <figcaption className="flex flex-col gap-1 px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-display text-lg">{entry.reference}</span>
                  <span className="text-xs font-semibold tracking-widest text-accent uppercase">
                    {entry.language}
                  </span>
                </div>
                <div className="text-xs text-inksoft">
                  {entry.version} · {entry.lens} · {entry.style} ·{' '}
                  {entry.durationSec}s ·{' '}
                  {entry.timingSource === 'speechmatics'
                    ? 'word timing measured from audio'
                    : 'timing estimated'}
                </div>
                {entry.attribution && (
                  <div className="text-[11px] leading-snug text-inkfaint">
                    {entry.attribution}
                  </div>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </main>
  );
}
