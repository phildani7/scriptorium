'use client';

/**
 * The creator screen.
 *
 *   1. say what the short is about        -> a passage, retrieved
 *   2. choose an opening                  -> devices, generated
 *   3. preview                            -> the real frame, seekable,
 *                                            narration fully editable
 *
 * There is no approval step: choosing an opening composes immediately. The
 * machine check — the verbatim gate — runs on every path, always. On the
 * preview screen the narration text stays editable, so the human can still
 * shape every authored word; only the verse is out of reach.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AgeGroup,
  DeviceItem,
  DeviceType,
  Passage,
  StyleId,
  Tone,
  VisualMode,
} from '@/lib/types';
import { resolveMusic, type ShortTheme } from '@/lib/theme/options';
import { PreviewFrame } from './PreviewFrame';
import { ThemePanel } from './ThemePanel';

type Step = 'compose' | 'passage' | 'teachings' | 'series' | 'devices' | 'preview';

/** Where the short starts: a topic/reference, or the creator's own text. */
type SourceMode = 'topic' | 'text';

interface ExtractedTeaching {
  title: string;
  summary: string;
  reference: string;
}

interface SeriesDay {
  day: number;
  focus: string;
  reference: string;
  lens: DeviceType;
}

interface VersionOption {
  id: number;
  abbreviation: string;
  title: string;
}

interface StatusPayload {
  ai: { active: string; glooConfigured: boolean; degradedReason?: string };
  scripture: { configured: boolean; note?: string };
  voice: { configured: boolean; note?: string };
  visuals?: { free: boolean; kie: boolean };
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
  { id: 'summary', label: 'Summary', blurb: 'The passage distilled into a few clear sentences.' },
];

const AGES: Array<{ id: AgeGroup; label: string }> = [
  { id: 'kids', label: 'Kids' },
  { id: 'youth', label: 'Youth' },
  { id: 'adult', label: 'Adult' },
];

const TONES: Array<{ id: Tone; label: string; blurb: string }> = [
  { id: 'conversational', label: 'Everyday', blurb: 'The way a trusted friend talks.' },
  { id: 'formal', label: 'Formal', blurb: 'Considered and measured, no slang.' },
  { id: 'liturgical', label: 'Liturgical', blurb: 'Reverent, at home in a service.' },
];

const SERIES_LENGTHS = [3, 5, 7, 14];

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
  const [tone, setTone] = useState<Tone>('conversational');
  /** V2: text only, or pictures — free graphics / AI images. */
  const [withPictures, setWithPictures] = useState(false);
  const [pictureSource, setPictureSource] = useState<'free' | 'ai'>('free');

  /** Bible versions licensed for the chosen language; empty hides the picker. */
  const [versions, setVersions] = useState<VersionOption[]>([]);
  const [versionId, setVersionId] = useState<number | undefined>();

  /** Start from the creator's own text instead of a topic or reference. */
  const [sourceMode, setSourceMode] = useState<SourceMode>('topic');
  const [sourceText, setSourceText] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [teachings, setTeachings] = useState<ExtractedTeaching[]>([]);

  const [seriesLen, setSeriesLen] = useState(5);
  const [seriesDays, setSeriesDays] = useState<SeriesDay[]>([]);

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

  // Versions licensed for the language. The picker only appears when the API
  // offers a real choice; the default stays "first licensed version".
  useEffect(() => {
    setVersions([]);
    setVersionId(undefined);
    fetch(`/api/versions?lang=${encodeURIComponent(languageCode)}`)
      .then((r) => r.json())
      .then((data: { versions?: VersionOption[] }) =>
        setVersions(data.versions ?? []),
      )
      .catch(() => undefined);
  }, [languageCode]);

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

  const visualMode: VisualMode = withPictures ? pictureSource : 'text';

  /** Turn a chosen device into a rendered preview. Shared by both paths. */
  const compose = useCallback(
    async (
      chosen: DeviceItem,
      deviceOverride?: string,
      forPassage?: Passage,
      explanationOverride?: string,
    ) => {
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
            explanationOverride,
            visualMode,
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
    [languageCode, passage, post, styleId, theme, bake, visualMode],
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
        { input, languageCode, versionId },
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

  const generate = async (chosenPassage: Passage, lensOverride?: DeviceType) => {
    setBusy(true);
    setError(null);
    setPassage(chosenPassage);
    try {
      const data = await post<{ devices: DeviceItem[] }>('/api/generate', {
        passage: chosenPassage,
        lens: lensOverride ?? lens,
        ageGroup,
        tone,
        languageCode,
      });
      setDevices(data.devices);
      setStep('devices');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** A known reference (teaching card, series day) straight into devices. */
  const resolveAndGenerate = async (
    reference: string,
    lensOverride?: DeviceType,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ candidates: Passage[]; notice?: string }>(
        '/api/resolve',
        { input: reference, languageCode, versionId },
      );
      setNotice(data.notice ?? null);
      const chosen = data.candidates[0];
      if (!chosen) throw new Error(`Could not retrieve ${reference}.`);
      if (lensOverride) setLens(lensOverride);
      await generate(chosen, lensOverride);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  /** Mine the creator's own text (pasted or uploaded) for teachings. */
  const onExtract = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let response: Response;
      if (sourceFile) {
        const form = new FormData();
        form.append('file', sourceFile);
        form.append('languageCode', languageCode);
        response = await fetch('/api/extract', { method: 'POST', body: form });
      } else {
        response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: sourceText, languageCode }),
        });
      }
      const data = (await response.json()) as {
        teachings?: ExtractedTeaching[];
        notice?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Extraction failed.');
      setNotice(data.notice ?? null);
      setTeachings(data.teachings ?? []);
      setStep('teachings');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /** Plan a multi-day series on the typed theme. */
  const onPlanSeries = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ days: SeriesDay[] }>('/api/series', {
        theme: input,
        days: seriesLen,
        languageCode,
      });
      setSeriesDays(data.days);
      setStep('series');
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
    setTeachings([]);
    setSeriesDays([]);
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
          onSubmit={sourceMode === 'topic' ? onResolve : onExtract}
          className="rounded-2xl border border-rule bg-panel p-8 shadow-sm"
        >
          <div className="mb-4 flex gap-1 rounded-xl border border-rule bg-white p-1 sm:max-w-md">
            {(
              [
                { id: 'topic', label: 'Topic or verse' },
                { id: 'text', label: 'From your text' },
              ] as Array<{ id: SourceMode; label: string }>
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSourceMode(m.id)}
                aria-pressed={sourceMode === m.id}
                className={`flex-1 rounded-lg px-3 py-2 text-sm transition ${
                  sourceMode === m.id
                    ? 'bg-accentsoft font-semibold text-accent'
                    : 'text-inksoft hover:bg-ground'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {sourceMode === 'topic' ? (
            <>
              <label htmlFor="input" className="mb-2 block font-display text-2xl">
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
            </>
          ) : (
            <>
              <label htmlFor="source-text" className="mb-2 block font-display text-2xl">
                Start from your own words
              </label>
              <p className="mb-4 text-sm text-inksoft">
                Paste a sermon, notes, or an article — or upload a .txt / .pdf.
                Its teachings are mined and each is anchored to a passage; the
                verse itself still comes from YouVersion, never from the upload.
              </p>

              <textarea
                id="source-text"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                rows={6}
                placeholder="Paste your source text here…"
                disabled={sourceFile !== null}
                className="mb-3 w-full rounded-xl border border-rule bg-white px-4 py-3 text-base leading-relaxed disabled:opacity-50"
              />
              <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
                <label className="cursor-pointer rounded-lg border border-rule bg-white px-3 py-2 text-inksoft transition hover:border-accent">
                  {sourceFile ? sourceFile.name : 'Upload .txt or .pdf'}
                  <input
                    type="file"
                    accept=".txt,.pdf,text/plain,application/pdf"
                    className="hidden"
                    onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
                  />
                </label>
                {sourceFile && (
                  <button
                    type="button"
                    onClick={() => setSourceFile(null)}
                    className="text-inkfaint underline"
                  >
                    remove file
                  </button>
                )}
              </div>
            </>
          )}

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

            {versions.length > 1 && (
              <Field label="Bible version">
                <select
                  value={versionId ?? versions[0]?.id}
                  onChange={(e) => setVersionId(Number(e.target.value))}
                  className="w-full rounded-lg border border-rule bg-white px-3 py-2"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.abbreviation} — {v.title}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Tone">
              <div className="flex gap-1">
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTone(t.id)}
                    title={t.blurb}
                    className={`flex-1 rounded-lg border px-2 py-2 text-sm transition ${
                      tone === t.id
                        ? 'border-accent bg-accentsoft font-semibold text-accent'
                        : 'border-rule bg-white text-inksoft'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
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

            <Field label="Visuals">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setWithPictures(false)}
                  aria-pressed={!withPictures}
                  className={`flex-1 rounded-lg border px-2 py-2 text-sm transition ${
                    !withPictures
                      ? 'border-accent bg-accentsoft font-semibold text-accent'
                      : 'border-rule bg-white text-inksoft'
                  }`}
                >
                  Text only
                </button>
                <button
                  type="button"
                  onClick={() => setWithPictures(true)}
                  aria-pressed={withPictures}
                  className={`flex-1 rounded-lg border px-2 py-2 text-sm transition ${
                    withPictures
                      ? 'border-accent bg-accentsoft font-semibold text-accent'
                      : 'border-rule bg-white text-inksoft'
                  }`}
                >
                  With pictures
                </button>
              </div>
            </Field>
          </div>

          {withPictures && (
            <div className="mb-6 -mt-2">
              <Field label="Picture source">
                <div className="flex gap-1 sm:max-w-md">
                  <button
                    type="button"
                    onClick={() => setPictureSource('free')}
                    aria-pressed={pictureSource === 'free'}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                      pictureSource === 'free'
                        ? 'border-accent bg-accentsoft font-semibold text-accent'
                        : 'border-rule bg-white text-inksoft'
                    }`}
                  >
                    Free graphics
                  </button>
                  <button
                    type="button"
                    onClick={() => status?.visuals?.kie && setPictureSource('ai')}
                    disabled={!status?.visuals?.kie}
                    aria-pressed={pictureSource === 'ai'}
                    title={
                      status?.visuals?.kie
                        ? 'One AI-generated 1:1 image per short'
                        : 'Needs KIE_API_KEY — not configured on this deployment yet'
                    }
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-40 ${
                      pictureSource === 'ai'
                        ? 'border-accent bg-accentsoft font-semibold text-accent'
                        : 'border-rule bg-white text-inksoft'
                    }`}
                  >
                    AI images{status?.visuals?.kie ? '' : ' (soon)'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-inkfaint">
                  Free graphics: hand-picked icons and CC0 photos — nothing
                  needs attribution. Each teaching lens brings its own
                  dramatic style.
                </p>
              </Field>
            </div>
          )}

          <fieldset className="mb-7">
            <legend className="mb-2 text-xs font-semibold tracking-widest text-inksoft uppercase">
              Teaching lens
            </legend>
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
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

          {sourceMode === 'topic' ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Finding the passage…' : 'Find the passage'}
              </button>

              <div className="flex items-center gap-2 text-sm text-inksoft">
                <span>or plan a series:</span>
                <select
                  value={seriesLen}
                  onChange={(e) => setSeriesLen(Number(e.target.value))}
                  aria-label="Series length"
                  className="rounded-lg border border-rule bg-white px-2 py-2"
                >
                  {SERIES_LENGTHS.map((n) => (
                    <option key={n} value={n}>
                      {n} days
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={busy || !input.trim()}
                  onClick={onPlanSeries}
                  className="rounded-xl border border-rule bg-white px-4 py-2 font-medium text-inksoft transition hover:border-accent disabled:opacity-50"
                >
                  {busy ? 'Planning…' : 'Plan it'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="submit"
              disabled={busy || (!sourceFile && sourceText.trim().length < 120)}
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Mining the teachings…' : 'Find the teachings'}
            </button>
          )}
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

      {/* ---------------- step 1c: teachings mined from the source -------- */}
      {step === 'teachings' && (
        <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
          <h2 className="mb-1 font-display text-3xl">Which teaching?</h2>
          <p className="mb-6 text-sm text-inksoft">
            Mined from your source, each anchored to a passage. Choosing one
            retrieves that passage from YouVersion and builds the short from it.
          </p>
          <div className="grid gap-4">
            {teachings.map((t, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => void resolveAndGenerate(t.reference)}
                className="rounded-xl border border-rule bg-white p-5 text-left transition hover:border-accent disabled:opacity-50"
              >
                <div className="mb-2 text-xs font-semibold tracking-widest text-accent uppercase">
                  {t.reference}
                </div>
                <p className="mb-2 font-display text-lg leading-snug">{t.title}</p>
                <p className="text-sm text-inksoft">{t.summary}</p>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft hover:bg-white"
          >
            Back
          </button>
        </section>
      )}

      {/* ---------------- step 1d: a planned series ----------------------- */}
      {step === 'series' && (
        <section className="rounded-2xl border border-rule bg-panel p-8 shadow-sm">
          <h2 className="mb-1 font-display text-3xl">Your series</h2>
          <p className="mb-6 text-sm text-inksoft">
            {seriesDays.length} days on “{input}”. Each day is one short; make
            them in any order — every passage is retrieved from YouVersion when
            you pick its day.
          </p>
          <div className="grid gap-3">
            {seriesDays.map((d) => (
              <button
                key={d.day}
                type="button"
                disabled={busy}
                onClick={() => void resolveAndGenerate(d.reference, d.lens)}
                className="flex items-baseline gap-4 rounded-xl border border-rule bg-white p-4 text-left transition hover:border-accent disabled:opacity-50"
              >
                <span className="font-display text-2xl text-accent">
                  {d.day}
                </span>
                <span className="flex-1">
                  <span className="mb-1 block text-xs font-semibold tracking-widest text-accent uppercase">
                    {d.reference} · {d.lens}
                  </span>
                  <span className="block text-sm text-inksoft">{d.focus}</span>
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={reset}
            className="mt-6 rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft hover:bg-white"
          >
            Back
          </button>
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
                disabled={busy}
                onClick={() => {
                  setDevice(d);
                  void compose(d);
                }}
                className="rounded-xl border border-rule bg-white p-5 text-left transition hover:border-accent disabled:opacity-50"
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

      {/* ---------------- step 3: preview + customize ---------------- */}
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
                onClick={() => setStep('devices')}
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
                musicUrl={resolveMusic(theme).file || undefined}
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

          {device && (
            <NarrationEditor
              device={device}
              passage={passage}
              busy={busy}
              dir={language?.dir ?? 'ltr'}
              onApply={(content, explanation) =>
                compose(device, content, undefined, explanation)
              }
            />
          )}
        </section>
      )}
    </main>
  );
}

/**
 * The final word belongs to the human. Every authored sentence of the
 * narration is editable right up to export; applying edits re-voices the
 * short. The citation is derived and the verse is retrieved — neither has an
 * input here, which is the whole point.
 */
function NarrationEditor({
  device,
  passage,
  busy,
  dir,
  onApply,
}: {
  device: DeviceItem;
  passage: Passage | null;
  busy: boolean;
  dir: 'ltr' | 'rtl';
  onApply: (content: string, explanation?: string) => void;
}) {
  const [content, setContent] = useState(device.content);
  const [explanation, setExplanation] = useState(device.explanation ?? '');

  // A different device (new short, re-generation) resets the drafts.
  useEffect(() => {
    setContent(device.content);
    setExplanation(device.explanation ?? '');
  }, [device]);

  const dirty =
    content.trim() !== device.content.trim() ||
    explanation.trim() !== (device.explanation ?? '').trim();

  return (
    <div className="mt-10 rounded-xl border border-rule bg-white p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-display text-xl">Narration</h3>
        <span className="text-xs text-inkfaint">
          Everything authored is yours to edit. The verse is not authored.
        </span>
      </div>
      <p className="mb-4 text-sm text-inksoft">
        Applying changes re-voices the narration and re-times the captions.
      </p>

      <label className="mb-1 block text-xs font-semibold tracking-widest text-inksoft uppercase">
        Opening line
      </label>
      <textarea
        dir={dir}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="mb-4 w-full rounded-lg border border-rule bg-white px-3 py-2 font-display text-lg leading-snug"
      />

      {(device.explanation ?? '') !== '' && (
        <>
          <label className="mb-1 block text-xs font-semibold tracking-widest text-inksoft uppercase">
            Teaching
          </label>
          <textarea
            dir={dir}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={4}
            className="mb-4 w-full rounded-lg border border-rule bg-white px-3 py-2 text-base leading-relaxed"
          />
        </>
      )}

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={busy || !dirty || !content.trim()}
          onClick={() => onApply(content, explanation || undefined)}
          className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? 'Re-voicing…' : 'Apply & re-voice'}
        </button>
        <span className="text-sm text-inkfaint">
          Closes with: “This is based on {passage?.reference ?? 'the passage'}.”
        </span>
      </div>
    </div>
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
