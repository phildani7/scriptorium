'use client';

/**
 * Reviews, at the foot of the gallery: read what people said, say something
 * yourself.
 *
 * Plain text in, plain text out. Review bodies render as text nodes — never
 * as markup — so the only thing a review can do to the page is occupy it.
 * The section renders nothing at all when the deployment has no feedback
 * store (`reviews: null`), same contract as the heart.
 */

import { useEffect, useState } from 'react';

interface Review {
  name: string;
  body: string;
  createdAt: string;
}

export function Reviews() {
  const [reviews, setReviews] = useState<Review[] | null | 'unavailable'>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/reviews')
      .then((r) => r.json())
      .then((data: { reviews: Review[] | null }) =>
        setReviews(data.reviews === null ? 'unavailable' : data.reviews),
      )
      .catch(() => setReviews('unavailable'));
  }, []);

  if (reviews === 'unavailable') return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === 'sending') return;
    setState('sending');
    setError(null);
    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, body }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Could not save the review.');
        setState('idle');
        return;
      }
      // Shown immediately, at the top: the writer should see their words land.
      setReviews((current) =>
        Array.isArray(current)
          ? [{ name: name.trim(), body: body.trim(), createdAt: new Date().toISOString() }, ...current]
          : current,
      );
      setName('');
      setBody('');
      setState('sent');
    } catch {
      setError('Could not reach the review store.');
      setState('idle');
    }
  };

  return (
    <section id="reviews" className="mt-14 border-t border-rule pt-10">
      <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-display text-3xl tracking-tight">Reviews</h2>
        <span className="text-sm text-inksoft">
          {Array.isArray(reviews) && reviews.length > 0
            ? `${reviews.length} so far`
            : 'be the first'}
        </span>
      </div>

      {Array.isArray(reviews) && reviews.length > 0 && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {reviews.map((r, i) => (
            <blockquote
              key={`${r.createdAt}-${i}`}
              className="rounded-2xl border border-rule bg-panel p-5"
            >
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink">
                {r.body}
              </p>
              <footer className="mt-3 flex items-baseline justify-between gap-3 text-xs text-inksoft">
                <span className="font-semibold">{r.name}</span>
                <time dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </footer>
            </blockquote>
          ))}
        </div>
      )}

      {state === 'sent' ? (
        <p className="rounded-xl border border-verified/40 bg-verifiedsoft px-4 py-3 text-sm text-ink">
          Thank you — your review is up.
        </p>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="max-w-2xl space-y-3">
          <div className="text-xs font-semibold tracking-widest text-inksoft uppercase">
            Leave a review
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            maxLength={60}
            required
            aria-label="Your name"
            className="w-full max-w-xs rounded-xl border border-rule bg-white px-4 py-2 text-sm"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you make, and how did it go?"
            maxLength={1000}
            rows={4}
            required
            aria-label="Your review"
            className="w-full rounded-xl border border-rule bg-white px-4 py-3 text-sm"
          />
          {error && <p className="text-sm text-red-700">{error}</p>}
          <button
            type="submit"
            disabled={state === 'sending'}
            className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {state === 'sending' ? 'Posting…' : 'Post review'}
          </button>
        </form>
      )}
    </section>
  );
}
