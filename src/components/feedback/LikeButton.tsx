'use client';

/**
 * The heart in the masthead.
 *
 * One like per browser, remembered in localStorage: a heart that can be
 * hammered is a number about enthusiasm for tapping, not about the tool. The
 * server rate-limits regardless, so clearing storage buys ten more likes a
 * minute, not a firehose.
 *
 * Renders nothing until the count arrives, and nothing at all when the
 * deployment has no feedback store — `count: null` is the API's way of saying
 * "this surface does not exist here", and a heart that cannot count should
 * not be drawn.
 */

import { useEffect, useState } from 'react';

const LIKED_KEY = 'scriptorium-liked';

export function LikeButton() {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLiked(localStorage.getItem(LIKED_KEY) === '1');
    fetch('/api/likes')
      .then((r) => r.json())
      .then((data: { count: number | null }) => setCount(data.count))
      .catch(() => setCount(null));
  }, []);

  if (count === null) return null;

  const like = async () => {
    if (liked || busy) return;
    setBusy(true);
    // Optimistic: the number moves when the thumb does. Reconciled below.
    setCount((c) => (c === null ? c : c + 1));
    setLiked(true);
    localStorage.setItem(LIKED_KEY, '1');
    try {
      const response = await fetch('/api/likes', { method: 'POST' });
      if (response.ok) {
        const data = (await response.json()) as { count: number };
        setCount(data.count);
      }
    } catch {
      // The optimistic count stands; the next visitor loads the truth.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void like()}
      disabled={liked}
      aria-label={liked ? `Liked — ${count} likes` : `Like Scriptorium — ${count} likes so far`}
      title={liked ? 'Thank you!' : 'Like Scriptorium'}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition ${
        liked
          ? 'border-accent/40 bg-accentsoft text-accent'
          : 'border-rule bg-white text-inksoft hover:border-accent/40 hover:text-accent'
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M12 21C7 16.6 3 13.3 3 9.3 3 6.4 5.2 4.5 7.7 4.5c1.7 0 3.3.9 4.3 2.4 1-1.5 2.6-2.4 4.3-2.4 2.5 0 4.7 1.9 4.7 4.8 0 4-4 7.3-9 11.7Z" />
      </svg>
      {count}
    </button>
  );
}
