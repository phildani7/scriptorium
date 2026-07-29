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

  /** The share target: this gallery page anchored to the entry. */
  const linkFor = (entry: GalleryEntry) =>
    typeof window === 'undefined'
      ? ''
      : `${window.location.origin}/gallery#${encodeURIComponent(entry.id)}`;

  const copyLink = async (entry: GalleryEntry) => {
    try {
      await navigator.clipboard.writeText(linkFor(entry));
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
                {entry.musicCredit && (
                  <div className="text-[11px] leading-snug text-inkfaint">
                    ♪ {entry.musicCredit}
                  </div>
                )}
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
                      ['WhatsApp', `https://wa.me/?text=${encodeURIComponent(`${entry.reference} — ${linkFor(entry)}`)}`],
                      ['Telegram', `https://t.me/share/url?url=${encodeURIComponent(linkFor(entry))}&text=${encodeURIComponent(entry.reference)}`],
                      ['X', `https://twitter.com/intent/tweet?text=${encodeURIComponent(entry.reference)}&url=${encodeURIComponent(linkFor(entry))}`],
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
    </main>
  );
}
