'use client';

/**
 * The gallery.
 *
 * Every entry is a pre-rendered MP4 committed to /public/gallery by the render
 * pipeline — a judge on hotel wifi clicks play on a static file; nothing here
 * depends on a warm API.
 *
 * Two sources, tried in order:
 *   1. the repository itself (raw.githubusercontent) — exports committed by
 *      the render workflow appear here the moment the job pushes, with no
 *      redeploy in between
 *   2. the copy bundled into this deployment, as the offline fallback
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Reviews } from '@/components/feedback/Reviews';

const GALLERY_REPO = process.env.NEXT_PUBLIC_GALLERY_REPO; // "owner/name"

function rawUrl(path: string): string {
  return `https://raw.githubusercontent.com/${GALLERY_REPO}/master/public${path}`;
}

interface GalleryEntry {
  id: string;
  video: string;
  poster: string | null;
  reference: string;
  version: string;
  attribution?: string;
  musicCredit?: string;
  language: string;
  style: string;
  lens: string;
  durationSec: number;
  timingSource: string;
}

/** Distinct values of one entry field, for a filter dropdown. */
function distinct(entries: GalleryEntry[], key: 'language' | 'lens' | 'style') {
  return [...new Set(entries.map((e) => e[key]).filter(Boolean))].sort();
}

export default function GalleryPage() {
  const [entries, setEntries] = useState<GalleryEntry[] | null>(null);
  const [live, setLive] = useState(false);
  const [queue, setQueue] = useState<Array<{
    id: string; reference: string; language: string; style: string; createdAt: string;
  }>>([]);

  const [query, setQuery] = useState('');
  const [language, setLanguage] = useState('');
  const [lens, setLens] = useState('');
  const [style, setStyle] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!entries) return null;
    const q = query.trim().toLowerCase();
    return entries.filter(
      (e) =>
        (!language || e.language === language) &&
        (!lens || e.lens === lens) &&
        (!style || e.style === style) &&
        (!q ||
          [e.reference, e.version, e.lens, e.style, e.language]
            .join(' ')
            .toLowerCase()
            .includes(q)),
    );
  }, [entries, query, language, lens, style]);

  /**
   * The share target: the MP4 itself.
   *
   * This used to be the gallery page anchored to the entry, which meant every
   * share — WhatsApp, Telegram, X — sent a link to a page of many shorts with
   * an anchor, and the recipient had to find the one they were sent. Sharing a
   * short ought to share the short.
   *
   * The file URL also unfurls: messaging apps render an .mp4 link as a
   * playable video rather than a page card, so the thing arrives ready to
   * watch. The page link stays available as "Copy page link" for anyone who
   * wants the surrounding provenance instead.
   */
  const videoLinkFor = (entry: GalleryEntry) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}${entry.video}`;

  /** The gallery page anchored to this entry — provenance, not the file. */
  const linkFor = (entry: GalleryEntry) =>
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/gallery#${encodeURIComponent(entry.id)}`;

  const copyLink = async (entry: GalleryEntry) => {
    try {
      await navigator.clipboard.writeText(videoLinkFor(entry));
      setCopied(entry.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Clipboard can be unavailable (http, permissions); the share links
      // beside the button still work.
    }
  };

  useEffect(() => {
    async function load() {
      // Freshest first: the repo the render workflow commits into.
      if (GALLERY_REPO) {
        try {
          const response = await fetch(rawUrl('/gallery/manifest.json'), {
            cache: 'no-store',
          });
          if (response.ok) {
            const data = (await response.json()) as GalleryEntry[];
            setEntries(
              data.map((e) => ({
                ...e,
                video: rawUrl(e.video),
                poster: e.poster ? rawUrl(e.poster) : null,
              })),
            );
            setLive(true);
            return;
          }
        } catch {
          // fall through to the bundled copy
        }
      }
      try {
        const response = await fetch('/gallery/manifest.json');
        setEntries(response.ok ? await response.json() : []);
      } catch {
        setEntries([]);
      }
    }
    void load();
  }, []);

  // What is rendering right now. Polled while the tab is open, because the
  // whole point of the strip is watching your export make its way over.
  useEffect(() => {
    let stopped = false;
    async function poll() {
      try {
        const r = await fetch('/api/queue');
        const data = (await r.json()) as { queue: typeof queue | null };
        if (!stopped && Array.isArray(data.queue)) setQueue(data.queue);
      } catch {
        // Next poll gets another chance.
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 45_000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Queued minus landed: a row disappears the moment its id is in the shelf.
  const pending = useMemo(() => {
    if (!queue.length) return [];
    const landed = new Set((entries ?? []).map((e) => e.id));
    return queue.filter((q) => !landed.has(q.id));
  }, [queue, entries]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Gallery</h1>
          <p className="mt-1 text-sm text-inksoft">
            Pre-rendered shorts. Every verse passed the integrity gate against
            a live YouVersion response before a single frame was captured.
            {live && ' Showing the live gallery — new exports appear as their render jobs finish.'}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Make your own
        </Link>
      </header>

      {pending.length > 0 && (
        <div className="mb-6 rounded-2xl border border-accent/25 bg-accentsoft/40 px-5 py-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            <span className="font-label text-[11px] font-bold tracking-[0.16em] text-accent uppercase">
              Rendering now
            </span>
            <span className="text-xs text-inksoft">
              — each one appears below when its job finishes
            </span>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {pending.map((q) => (
                <tr key={q.id} className="border-t border-accent/10 first:border-t-0">
                  <td className="py-1.5 pr-4 font-semibold text-ink">{q.reference}</td>
                  <td className="py-1.5 pr-4 text-inksoft uppercase">{q.language}</td>
                  <td className="py-1.5 pr-4 text-inksoft">{q.style}</td>
                  <td className="py-1.5 text-right text-xs text-inkfaint">
                    queued{' '}
                    {new Date(q.createdAt).toLocaleTimeString(undefined, {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {entries !== null && entries.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reference, version, style…"
            aria-label="Search the gallery"
            className="w-full max-w-xs rounded-xl border border-rule bg-white px-4 py-2 text-sm"
          />
          {(
            [
              ['Language', language, setLanguage, distinct(entries, 'language')],
              ['Lens', lens, setLens, distinct(entries, 'lens')],
              ['Style', style, setStyle, distinct(entries, 'style')],
            ] as Array<[string, string, (v: string) => void, string[]]>
          ).map(([label, value, set, values]) => (
            <select
              key={label}
              value={value}
              onChange={(e) => set(e.target.value)}
              aria-label={`Filter by ${label.toLowerCase()}`}
              className="rounded-xl border border-rule bg-white px-3 py-2 text-sm text-inksoft"
            >
              <option value="">All {label.toLowerCase()}s</option>
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          ))}
          {(query || language || lens || style) && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setLanguage('');
                setLens('');
                setStyle('');
              }}
              className="text-sm text-inkfaint underline"
            >
              clear
            </button>
          )}
        </div>
      )}

      {entries === null && (
        <p className="text-sm text-inksoft">Loading…</p>
      )}

      {entries !== null && entries.length === 0 && (
        <div className="rounded-2xl border border-rule bg-panel p-10 text-center text-inksoft">
          Nothing here yet — export a short from the studio and it will appear
          in this gallery once the render job finishes.
        </div>
      )}

      {filtered !== null && entries !== null && entries.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-rule bg-panel p-10 text-center text-inksoft">
          No shorts match those filters.
        </div>
      )}

      {filtered !== null && filtered.length > 0 && (
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((entry) => (
            <figure
              key={entry.id}
              id={entry.id}
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
                {/*
                  The music credit is deliberately NOT shown.

                  Every bed in the library is licensed through Audiio and needs
                  no attribution — that was the whole reason the four CC-BY
                  tracks were dropped rather than kept with an obligation
                  attached. Printing a credit anyway was meant as a courtesy,
                  but it reads as a requirement, and a creator who sees one
                  attribution beside another cannot tell which one they are
                  obliged to carry when they repost.

                  The Bible attribution above stays, because that one IS
                  required: Biblica's licence asks for the copyright notice by
                  name. Showing only the obligation makes the obligation legible.

                  The credit is still recorded in the gallery manifest as
                  provenance, where it belongs.
                */}
                <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-rule pt-2 text-xs">
                  <button
                    type="button"
                    onClick={() => void copyLink(entry)}
                    className="font-medium text-accent hover:underline"
                  >
                    {copied === entry.id ? 'Copied ✓' : 'Copy link'}
                  </button>
                  {(
                    [
                      ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${entry.reference} — ${videoLinkFor(entry)}`)}`],
                      ['Telegram', `https://t.me/share/url?url=${encodeURIComponent(videoLinkFor(entry))}&text=${encodeURIComponent(entry.reference)}`],
                      ['X', `https://twitter.com/intent/tweet?text=${encodeURIComponent(entry.reference)}&url=${encodeURIComponent(videoLinkFor(entry))}`],
                    ] as Array<[string, string]>
                  ).map(([name, href]) => (
                    <a
                      key={name}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-inksoft hover:text-accent hover:underline"
                    >
                      {name}
                    </a>
                  ))}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <Reviews />
    </main>
  );
}
