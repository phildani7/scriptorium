'use client';

/**
 * Live preview.
 *
 * The composition runs in an iframe at its true 1080x1920 and is scaled down
 * with a transform, so what is on screen is the real frame rather than a
 * responsive approximation of it. The transport controls seek the composition's
 * paused timeline — the same seek the renderer performs per frame, which is why
 * a preview that looks right is evidence the export will be right.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface PreviewFrameProps {
  html: string;
  durationSec: number;
  /** Data URI of the narration, when a server voice produced one. */
  audioUrl?: string;
  /** Music bed URL; pre-attenuated files, so played at full element volume. */
  musicUrl?: string;
}

const FRAME_W = 1080;
const FRAME_H = 1920;

export function PreviewFrame({
  html,
  durationSec,
  audioUrl,
  musicUrl,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const rafRef = useRef<number | null>(null);
  const startedAt = useRef<number>(0);

  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [verified, setVerified] = useState<boolean | null>(null);

  const seek = useCallback((t: number) => {
    const win = iframeRef.current?.contentWindow as
      | (Window & { __timelines?: Record<string, { seek(v: number): void }> })
      | null;
    win?.__timelines?.['scripture-short']?.seek(t);
  }, []);

  // Ask the composition to run its own integrity check once it has loaded.
  const onLoad = useCallback(() => {
    const win = iframeRef.current?.contentWindow as
      | (Window & { __verifyVerse?: () => boolean })
      | null;
    setVerified(win?.__verifyVerse ? win.__verifyVerse() : null);
    seek(0);
    setTime(0);
  }, [seek]);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    startedAt.current = performance.now() - time * 1000;

    const tick = () => {
      const t = (performance.now() - startedAt.current) / 1000;
      if (t >= durationSec) {
        setTime(durationSec);
        seek(durationSec);
        setPlaying(false);
        return;
      }
      setTime(t);
      seek(t);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // `time` is intentionally excluded: including it would restart the loop on
    // every frame. It is read once at play to resume from the scrub position.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, durationSec, seek]);

  const toggle = () => {
    const next = !playing;
    setPlaying(next);
    for (const ref of [audioRef, musicRef]) {
      const audio = ref.current;
      if (!audio) continue;
      if (next) {
        audio.currentTime = time;
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
      }
    }
  };

  const onScrub = (value: number) => {
    setPlaying(false);
    setTime(value);
    seek(value);
    for (const ref of [audioRef, musicRef]) {
      if (ref.current) {
        ref.current.pause();
        ref.current.currentTime = value;
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative overflow-hidden rounded-2xl border border-rule shadow-lg"
        style={{ width: 320, height: (320 / FRAME_W) * FRAME_H }}
      >
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={onLoad}
          title="Short preview"
          sandbox="allow-scripts allow-same-origin"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            border: 0,
            transform: `scale(${320 / FRAME_W})`,
            transformOrigin: 'top left',
          }}
        />
      </div>

      {audioUrl && <audio ref={audioRef} src={audioUrl} preload="auto" />}
      {musicUrl && <audio ref={musicRef} src={musicUrl} preload="auto" />}

      <div className="flex w-full max-w-80 flex-col gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <input
            type="range"
            min={0}
            max={durationSec}
            step={0.05}
            value={time}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="flex-1 accent-accent"
            aria-label="Scrub preview"
          />
          <span className="w-14 text-right font-mono text-xs text-inksoft">
            {time.toFixed(1)}s
          </span>
        </div>

        {verified !== null && (
          <p
            className={`text-center text-xs font-semibold ${
              verified ? 'text-accent' : 'text-red-700'
            }`}
          >
            {verified
              ? 'verse verified against YouVersion in this frame'
              : 'VERSE MISMATCH — this short would fail the render gate'}
          </p>
        )}
      </div>
    </div>
  );
}
