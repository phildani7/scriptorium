'use client';

/**
 * The creator screen.
 *
 * Four steps, and the third one is the product's argument:
 *
 *   1. say what the short is about        -> a passage, retrieved
 *   2. choose an opening                  -> devices, generated
 *   3. review, or skip review (auto mode) -> the gate
 *   4. preview                            -> the real frame, seekable
 *
 * Auto mode exists because a volunteer publishing five shorts a week should not
 * have to approve five scripts. It skips the human check only. The machine
 * check — the verbatim gate — runs on both paths, always.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AgeGroup, DeviceItem, DeviceType, Passage, StyleId } from '@/lib/types';
import type { ShortTheme } from '@/lib/theme/options';
import { ReviewGate } from './ReviewGate';
import { PreviewFrame } from './PreviewFrame';
import { ThemePanel } from './ThemePanel';

type Step = 'compose' | 'passage' | 'devices' | 'review' | 'preview';

interface StatusPayload {
  ai: { active: string; glooConfigured: boolean; degradedReason?: string };
  scripture: { configured: boolean; note?: string };
  voice: { configured: boolean; note?: string };
  coverage: {
    total: number;
    full: number;
    withVoice: number;
    audited: {
      at: string;
      withBible: number;
      complete: number;
      totalVersions: number;
    };
  };
  languages: Array<{
    code: string;
    name: string;
    nativeName: string;
    script: string;
    dir: 'ltr' | 'rtl';
    tier: string;
  }>;
}

const LENSES: Array<{ id: DeviceType; label: string; blurb: string }> = [
  { id: 'hook', label: 'Hook', blurb: 'An opener that makes someone need this passage.' },
  { id: 'analogy', label: 'Analogy', blurb: 'A picture from ordinary life, with its limits named.' },
  { id: 'punch-line', label: 'Punch line', blurb: 'One sentence that compresses the tension.' },
  { id: 'illustration', label: 'Illustration', blurb: 'A short true-to-life scenario.' },
  { id: 'object-lesson', label: 'Object lesson', blurb: 'Something you can hold up and show.' },
];

const AGES: Array<{ id: AgeGroup; label: string }> = [
  { id: 'kids', label: 'Kids' },
  { id: 'youth', label: 'Youth' },
  { id: 'adult', label: 'Adult' },
];

export function Studio() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [step, setStep] = useState<Step>('compose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Set when the passage came from an offline fixture rather than the API. */
  const [notice, setNotice] = useState<string | null>(null);

  const [input, setInput] = useState('');
  const [languageCode, setLanguageCode] = useState('en');
  const [lens, setLens] = useState<DeviceType>('hook');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('adult');
  const [autoMode, setAutoMode] = useState(false);

  const [candidates, setCandidates] = useState<Passage[]>([]);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [device, setDevice] = useState<DeviceItem | null>(null);

  const [previewHtml, setPreviewHtml] = useState('');
  const [duration, setDuration] = useState(24);
  const [audioUrl, setAudioUrl] = useState<string | undefined>();

  /** The composed spec — presentation edits re-bake it without regenerating. */
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);
  const [styleId, setStyleId] = useState<StyleId>('warm-minimal');
  const [theme, setTheme] = useState<ShortTheme>({});
  const [rebaking, setRebaking] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const bakeSeq = useRef(0);

  useEffect(() => {
    fetch('/api/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => undefined);
  }, []);

  const language = useMemo(
    () => status?.languages.find((l) => l.code === languageCode),
    [status, languageCode],
  );

  const post = useCallback(
    async <T,>(url: string, body: unknown): Promise<T> => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.error || `${url} failed (${response.status})`);
      }
      return response.json() as Promise<T>;
    },
    [],
  );

  /** Bake a spec into its template and show it. Cheap; no generation. */
  const bake = useCallback(async (nextSpec: Record<string, unknown>) => {
    const seq = ++bakeSeq.current;
    setRebaking(true);
    try {
      const html = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: nextSpec }),
      }).then((r) => r.text());
      // A slower earlier bake must not overwrite a newer one.
      if (seq === bakeSeq.current) setPreviewHtml(html);
    } finally {
      if (seq === bakeSeq.current) setRebaking(false);
    }
  }, []);

  /** Turn a chosen device into a rendered preview. Shared by both paths. */
  const compose = useCallback(
    async (chosen: DeviceItem, deviceOverride?: string, forPassage?: Passage) => {
      const target = forPassage ?? passage;
      if (!target) return;
      setBusy(true);
      setError(null);
      try {
        const { spec: composed } = await post<{ spec: Record<string, unknown> }>(
          '/api/compose',
          {
            passage: target,
            device: chosen,
            deviceOverride,
            languageCode,
            style: styleId,
            theme,
          },
        );

        const narration = composed.narration as {
          durationSec: number;
          audioUrl: string;
        };
        setSpec(composed);
        setDuration(narration.durationSec);
        setAudioUrl(narration.audioUrl || undefined);
        await bake(composed);
        setStep('preview');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    },
    [languageCode, passage, post, styleId, theme, bake],
  );

  /** Presentation-only changes: mutate the spec and re-bake. */
  const applyStyle = useCallback(
    (next: StyleId) => {
      setStyleId(next);
      if (!spec) return;
      const updated = { ...spec, style: next };
      setSpec(updated);
      void bake(updated);
    },
    [spec, bake],
  );

  const applyTheme = useCallback(
    (next: ShortTheme) => {
      setTheme(next);
      if (!spec) return;
      const updated = { ...spec, theme: next };
      setSpec(updated);
      void bake(updated);
    },
    [spec, bake],
  );

  /** Queue an MP4 export; falls back to downloading the spec when offline. */
  const exportMp4 = useCallback(async () => {
    if (!spec) return;
    setExporting('Queuing export…');
    try {
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec }),
      });
      const data = (await response.json()) as {
        queued?: boolean;
        message?: string;
        runUrl?: string;
        spec?: Record<string, unknown>;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Export failed.');

      if (data.queued) {
        setExporting(data.message ?? 'Export queued. The MP4 lands in the gallery when the render finishes.');
      } else if (data.spec) {
        // Not configured for cloud rendering: hand the spec over so the MP4
        // can be produced locally with `npm run render`.
        const blob = new Blob([JSON.stringify(data.spec, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${String(spec.id ?? 'short')}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        setExporting(data.message ?? 'Spec downloaded — render locally with `npm run render`.');
      }
    } catch (e) {
      setExporting(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [spec]);

  const onResolve = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ candidates: Passage[]; notice?: string }>(
        '/api/resolve',
        { input, languageCode },
      );
      setNotice(data.notice ?? null);
      setCandidates(data.candidates);
      if (data.candidates.length === 1) {
        setPassage(data.candidates[0]);
        await generate(data.candidates[0]);
      } else {
        setStep('passage');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const generate = async (chosenPassage: Passage) => {
    setBusy(true);
    setError(null);
    setPassage(chosenPassage);
    try {
      const data = await post<{ devices: DeviceItem[] }>('/api/generate', {
        passage: chosenPassage,
        lens,
        ageGroup,
        languageCode,
      });
      setDevices(data.devices);

      if (autoMode && data.devices.length > 0) {
        // Auto mode: take the first option and go. The verbatim gate still runs.
        setDevice(data.devices[0]);
        await compose(data.devices[0], undefined, chosenPassage);
      } else {
        setStep('devices');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setStep('compose');
    setCandidates([]);
    setPassage(null);
    setDevices([]);
    setDevice(null);
    setPreviewHtml('');
    setError(null);
  };

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Header status={status} />

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {notice && step !== 'compose' && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {notice}
        </div>
      )}

      {/* ---------------- step 1: compose ---------------- */}
      {step === 'compose' && (
        <form
          onSubmit={onResolve}
          className="rounded-2xl border border-rule bg-panel p-8 shadow-sm"
        >
          <label
            htmlFor="input"
            className="mb-2 block font-display text-2xl"
          >
            What is this short about?
          </label>
          <p className="mb-4 text-sm text-inksoft">
            A reference, a word, or a situation. Anything from{' '}
            <em>Psalm 23</em> to <em>anxiety at work</em>.
          </p>

          <input
            id="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="John 3:16"
            className="mb-6 w-full rounded-xl border border-rule bg-white px-4 py-3 text-lg"
          />

          <div className="mb-6 grid gap-5 sm:grid-cols-3">
            <Field label="Language">
              <select
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full rounded-lg border border-rule bg-white px-3 py-2"
              >
                {status?.languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.nativeName} — {l.name}
                    {l.tier === 'full' ? '' : l.tier === 'voiced' ? ' (voiced)' : ' (captions)'}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Audience">
              <div className="flex gap-1">
                {AGES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAgeGroup(a.id)}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm transition ${
                      ageGroup === a.id
                        ? 'border-accent bg-accentsoft font-semibold text-accent'
                        : 'border-rule bg-white text-inksoft'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Mode">
              <button
                type="button"
                onClick={() => setAutoMode(!autoMode)}
                aria-pressed={autoMode}
                className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                  autoMode
                    ? 'border-accent bg-accentsoft font-semibold text-accent'
                    : 'border-rule bg-white text-inksoft'
                }`}
              >
                {autoMode ? 'Auto — skip review' : 'Review before generating'}
              </button>
            </Field>
          </div>

          <fieldset className="mb-7">
            <legend className="mb-2 text-xs font-semibold tracking-widest text-inksoft uppercase">
              Teaching lens
            </legend>
            <div className="grid gap-2 sm:grid-cols-5">
              {LENSES.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setLens(l.id)}
                  title={l.blurb}
                  className={`rounded-lg border px-3 py-2 text-sm transition ${
                    lens === l.id
                      ? 'border-accent bg-accentsoft font-semibold text-accent'
                      : 'border-rule bg-white text-inksoft hover:bg-ground'
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Finding the passage…' : 'Find the passage'}
          </button>
        </form>
      )}

      {/* ---------------- step 1b: choose a passage ---------------- */}
      {step === 'passage' && (
        <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
          <h2 className="mb-1 font-display text-3xl">Which passage?</h2>
          <p className="mb-6 text-sm text-inksoft">
            Suggested by AI, retrieved from YouVersion. The text below is exactly
            what the API returned.
          </p>
          <div className="grid gap-4">
            {candidates.map((c) => (
              <button
                key={c.usfm}
                type="button"
                onClick={() => generate(c)}
                disabled={busy}
                className="rounded-xl border border-rule bg-white p-5 text-left transition hover:border-accent disabled:opacity-50"
              >
                <div className="mb-2 text-xs font-semibold tracking-widest text-accent uppercase">
                  {c.reference} · {c.versionAbbreviation}
                </div>
                <p
                  dir={language?.dir}
                  data-script={language?.script}
                  className="font-display text-lg leading-snug"
                >
                  {c.text}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- step 2: choose an opening ---------------- */}
      {step === 'devices' && passage && (
        <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
          <VersePanel passage={passage} language={language} />

          <h2 className="mt-8 mb-1 font-display text-3xl">Choose an opening</h2>
          <p className="mb-6 text-sm text-inksoft">
            {devices.length} options, each anchored to a specific point in the
            passage.
          </p>

          <div className="grid gap-4">
            {devices.map((d, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setDevice(d);
                  setStep('review');
                }}
                className="rounded-xl border border-rule bg-white p-5 text-left transition hover:border-accent"
              >
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-accent uppercase">
                  <span aria-hidden="true">{d.emoji}</span>
                  {d.type}
                </div>
                <p
                  dir={language?.dir}
                  data-script={language?.script}
                  className="mb-3 font-display text-lg leading-snug"
                >
                  {d.content}
                </p>
                <p className="border-t border-rule pt-3 text-sm text-inksoft">
                  {d.point}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ---------------- step 3: the gate ---------------- */}
      {step === 'review' && passage && device && (
        <ReviewGate
          passage={passage}
          device={device}
          scriptDir={language?.dir ?? 'ltr'}
          scriptName={language?.script ?? 'latin'}
          busy={busy}
          onApprove={(override) => compose(device, override)}
          onBack={() => setStep('devices')}
        />
      )}

      {/* ---------------- step 4: preview + customize ---------------- */}
      {step === 'preview' && previewHtml && (
        <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <h2 className="font-display text-3xl">Make it yours</h2>
              <p className="mt-1 text-sm text-inksoft">
                Style, colors, fonts, size, background — one click each. The
                verse and the voice never change.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(autoMode ? 'devices' : 'review')}
                className="rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft hover:bg-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft hover:bg-white"
              >
                Make another
              </button>
              <button
                type="button"
                onClick={exportMp4}
                className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Export MP4
              </button>
            </div>
          </div>

          {exporting && (
            <div className="mb-6 rounded-lg border border-rule bg-white px-4 py-3 text-sm text-inksoft">
              {exporting}
            </div>
          )}

          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="relative">
              <PreviewFrame
                html={previewHtml}
                durationSec={duration}
                audioUrl={audioUrl}
              />
              {rebaking && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs font-medium text-white">
                  updating…
                </div>
              )}
            </div>

            <ThemePanel
              style={styleId}
              theme={theme}
              busy={rebaking}
              onStyle={applyStyle}
              onTheme={applyTheme}
            />
          </div>
        </section>
      )}
    </main>
  );
}

function VersePanel({
  passage,
  language,
}: {
  passage: Passage;
  language?: { dir: 'ltr' | 'rtl'; script: string };
}) {
  return (
    <div className="rounded-xl border border-rule bg-locked p-6">
      <div className="mb-3 text-xs font-semibold tracking-widest text-accent uppercase">
        {passage.reference} · {passage.versionAbbreviation}
      </div>
      <p
        dir={language?.dir}
        data-script={language?.script}
        className="font-display text-2xl leading-relaxed"
      >
        {passage.text}
      </p>
      <p className="mt-4 border-t border-rule pt-3 text-xs text-inksoft">
        {passage.attribution}
      </p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold tracking-widest text-inksoft uppercase">
        {label}
      </div>
      {children}
    </div>
  );
}

function Header({ status }: { status: StatusPayload | null }) {
  const notes = [
    status?.ai.degradedReason,
    status?.scripture.note,
    status?.voice.note,
  ].filter(Boolean) as string[];

  return (
    <header className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 className="font-display text-4xl tracking-tight">Scriptorium</h1>
        <p className="text-inksoft">
          Scripture shorts, in your own language.
        </p>
        <a
          href="/gallery"
          className="ml-auto rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft transition hover:bg-white"
        >
          Gallery →
        </a>
      </div>

      {status && (
        <p className="text-sm text-inksoft">
          <strong className="font-semibold text-ink">
            {status.coverage.audited.withBible} languages
          </strong>{' '}
          licensed to this app key · {status.coverage.audited.complete} with a
          voice and word timing measured from the audio ·{' '}
          {status.coverage.audited.totalVersions} Bible versions · Scripture
          retrieved from YouVersion, never generated.
        </p>
      )}

      {notes.length > 0 && (
        <ul className="mt-4 space-y-2">
          {notes.map((note) => (
            <li
              key={note}
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900"
            >
              {note}
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
