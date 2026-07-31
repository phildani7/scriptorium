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
import { isYouTubeUrl } from '@/lib/source/youtube';
import { LikeButton } from '@/components/feedback/LikeButton';
import { PreviewFrame } from './PreviewFrame';
import { ThemePanel } from './ThemePanel';

type Step = 'compose' | 'passage' | 'teachings' | 'series' | 'devices' | 'preview';

/**
 * Where the short starts: a topic/reference, the creator's own text, or a
 * link to an article. All three converge on the same pipeline, and in all
 * three the verse still comes from YouVersion.
 */
type SourceMode = 'topic' | 'text' | 'link';

interface ExtractedTeaching {
  title: string;
  summary: string;
  reference: string;
  /** English nouns for the icon/photo libraries; without them a doc-sourced
      short in a non-English language can never earn a picture. */
  visualTerms?: string[];
  imagePrompt?: string;
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
  ai: {
    active: string;
    glooConfigured: boolean;
    claudeConfigured: boolean;
    glooModel?: string;
    /** True when a live Claude fallback stands behind Gloo. */
    fallbackReady: boolean;
    degradedReason?: string;
    /** Gloo answered, but a recent request had to be served by Claude. */
    fallbackNotice?: string;
  };
  scripture: { configured: boolean; note?: string };
  voice: { configured: boolean; note?: string };
  visuals?: { free: boolean; ai: boolean; doodles: number; grok: boolean };
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

  /** Start from the creator's own text or a link instead of a topic. */
  const [sourceMode, setSourceMode] = useState<SourceMode>('topic');
  const [sourceText, setSourceText] = useState('');
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState('');
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

  /**
   * A pasted YouTube link is a certain failure, so it is caught here rather
   * than by the server twenty seconds later. `/api/extract` refuses it too —
   * this is the courtesy, that is the rule.
   */
  const youTubePasted = useMemo(() => isYouTubeUrl(sourceUrl), [sourceUrl]);

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
      // The narration audio STAYS ON THE CLIENT. The bake route sets
      // audioSrc '' regardless (PreviewFrame drives its own <audio> from
      // state), so the base64 WAV in the spec was megabytes of payload that
      // the server would ignore — and past ~4.5 MB Vercel refuses the request
      // outright with FUNCTION_PAYLOAD_TOO_LARGE, which is exactly how a
      // long English short broke the preview screen in production.
      const narration = nextSpec.narration as
        | Record<string, unknown>
        | undefined;
      const lean = narration?.audioUrl
        ? { ...nextSpec, narration: { ...narration, audioUrl: '' } }
        : nextSpec;
      const html = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: lean }),
      }).then((r) => r.text());
      // A slower earlier bake must not overwrite a newer one.
      if (seq === bakeSeq.current) setPreviewHtml(html);
    } finally {
      if (seq === bakeSeq.current) setRebaking(false);
    }
  }, []);

  const visualMode: VisualMode = withPictures ? pictureSource : 'text';

  /**
   * The sixth page: after the five teaching sentences the verse itself is
   * spoken and shown. On for every short — the teaching earns the verse, and
   * the verse is the point.
   */
  const [speakVerse, setSpeakVerse] = useState(true);

  /** Turn a chosen device into a rendered preview. Shared by both paths. */
  const compose = useCallback(
    async (
      chosen: DeviceItem,
      deviceOverride?: string,
      forPassage?: Passage,
      explanationOverride?: string,
      withVerse?: boolean,
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
            speakVerse: withVerse ?? speakVerse,
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
    [languageCode, passage, post, styleId, theme, bake, visualMode, speakVerse],
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
      // Same rule as the preview bake: the runner re-synthesizes narration
      // from the script with its own secrets, so the base64 WAV is dead
      // weight — and past ~4.5 MB it is a rejected request, not dead weight.
      const narration = spec.narration as Record<string, unknown> | undefined;
      const lean = narration?.audioUrl
        ? { ...spec, narration: { ...narration, audioUrl: '' } }
        : spec;
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spec: lean }),
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
      const data = await post<{
        candidates: Passage[];
        notice?: string;
        declined?: boolean;
        message?: string;
      }>('/api/resolve', { input, languageCode, versionId });

      // A topic this tool is not for: show the polite note, stay right here.
      if (data.declined || data.candidates.length === 0) {
        setNotice(
          data.message ??
            'No passages found — try a reference, a topic, or a life situation.',
        );
        return;
      }

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
    setSpeakVerse(true);
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

  /** Mine the creator's source (pasted, uploaded, or linked) for teachings. */
  const onExtract = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let response: Response;
      if (sourceMode === 'link') {
        response = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: sourceUrl.trim(), languageCode }),
        });
      } else if (sourceFile) {
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
        declined?: boolean;
        message?: string;
        notice?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Extraction failed.');

      // A document this tool is not for: show the polite note and stay right
      // here, ready for the next source.
      if (data.declined) {
        setNotice(data.message ?? 'This tool turns Christian teaching into Scripture shorts — try a different document.');
        setSourceFile(null);
        setSourceText('');
        return;
      }

      setNotice(data.notice ?? null);
      setTeachings(data.teachings ?? []);
      setStep('teachings');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  /**
   * A mined teaching becomes a short directly — no lens generation step.
   * Opening = the doc's title, teaching = its thought, then the retrieved
   * verse is spoken and displayed (and gate-checked).
   */
  const teachingToShort = async (t: ExtractedTeaching) => {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{ candidates: Passage[]; notice?: string }>(
        '/api/resolve',
        { input: t.reference, languageCode, versionId },
      );
      const chosen = data.candidates[0];
      if (!chosen) throw new Error(`Could not retrieve ${t.reference}.`);
      const device: DeviceItem = {
        type: 'summary',
        content: t.title,
        explanation: t.summary,
        point: t.summary,
        reference: chosen.reference,
        emoji: '📖',
        visualTerms: t.visualTerms,
        imagePrompt: t.imagePrompt,
      };
      setPassage(chosen);
      setDevice(device);
      setLens('summary');
      setSpeakVerse(true);
      await compose(device, undefined, chosen, undefined, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  /** Plan a multi-day series on the typed theme. */
  const onPlanSeries = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await post<{
        days: SeriesDay[];
        declined?: boolean;
        message?: string;
        notice?: string;
      }>('/api/series', {
        theme: input,
        days: seriesLen,
        languageCode,
      });
      if (data.declined || data.days.length === 0) {
        setNotice(
          data.message ??
            'Could not plan a series on that theme — try another topic or a faith theme.',
        );
        return;
      }
      setNotice(data.notice ?? null);
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
    setSpeakVerse(true);
    setSourceUrl('');
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

      {notice && (
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
          <div className="mb-4 flex gap-1 rounded-xl border border-rule bg-white p-1 sm:max-w-xl">
            {(
              [
                { id: 'topic', label: 'Topic or verse' },
                { id: 'text', label: 'From your text' },
                { id: 'link', label: 'From a link' },
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
          ) : sourceMode === 'link' ? (
            <>
              <label htmlFor="source-url" className="mb-2 block font-display text-2xl">
                Start from an article
              </label>
              <p className="mb-4 text-sm text-inksoft">
                Paste an article, blog post, devotional or PDF link and its
                text is read. The teachings are mined from those words, and
                each is anchored to a passage — the verse itself still comes
                from YouVersion, never from the page.
              </p>

              <input
                id="source-url"
                type="url"
                inputMode="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                placeholder="https://example.com/an-article"
                aria-invalid={youTubePasted}
                aria-describedby={youTubePasted ? 'source-url-youtube' : undefined}
                className={`mb-2 w-full rounded-xl border bg-white px-4 py-3 text-lg ${
                  youTubePasted ? 'border-amber-400' : 'border-rule'
                }`}
              />

              {/* Said the moment the link is pasted rather than after a
                  request that cannot succeed: the failure is certain, so
                  making the creator wait for it teaches them nothing. */}
              {youTubePasted ? (
                <div
                  id="source-url-youtube"
                  role="status"
                  className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                >
                  <strong className="font-semibold">
                    YouTube links are not supported.
                  </strong>{' '}
                  YouTube blocks caption requests from cloud servers, which is
                  where this app runs, so the video cannot be read from here.
                  Open it on YouTube, use <strong>⋯ → Show transcript</strong>,
                  copy it, and paste it into{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setSourceText('');
                      setSourceMode('text');
                    }}
                    className="font-semibold underline underline-offset-2"
                  >
                    From your text
                  </button>{' '}
                  — that works well.
                </div>
              ) : (
                <p className="mb-6 text-xs text-inkfaint">
                  Sites that build their article in the browser cannot be read
                  this way — paste the text instead. Video links are not
                  supported.
                </p>
              )}
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
                {/*
                  Grouped by what the creator actually gets, because the old
                  list said it backwards: the BEST tier carried no marker at
                  all while the middle one was labelled "(voiced)", so a
                  language that narrates and measures its captions looked less
                  capable than one that only narrates. Every option now states
                  its own capability, and the group headings count them.
                */}
                {(
                  [
                    ['full', 'Narrated · captions measured from the audio'],
                    ['voiced', 'Narrated · caption timing estimated'],
                    ['text-first', 'No narration yet · text on screen only'],
                  ] as const
                ).map(([tier, heading]) => {
                  const group = (status?.languages ?? []).filter((l) => l.tier === tier);
                  if (!group.length) return null;
                  return (
                    <optgroup key={tier} label={`${heading}  (${group.length})`}>
                      {group.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.nativeName} — {l.name}
                          {tier === 'full'
                            ? ' · narrated'
                            : tier === 'voiced'
                              ? ' · narrated, estimated captions'
                              : ' · no narration'}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </select>
              {language && language.tier === 'text-first' && (
                <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  No neural voice exists for {language.name} yet — the short
                  will show its words on screen with no narration audio.
                </p>
              )}
              {language && language.code !== 'en' && language.tier !== 'text-first' && (
                <p className="mt-2 text-xs text-inkfaint">
                  {language.name} narration is generated during export; the
                  studio preview plays silently.
                </p>
              )}
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
                    onClick={() => setPictureSource('ai')}
                    aria-pressed={pictureSource === 'ai'}
                    title="One full-frame hand-drawn doodle behind all five sentences"
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${
                      pictureSource === 'ai'
                        ? 'border-accent bg-accentsoft font-semibold text-accent'
                        : 'border-rule bg-white text-inksoft'
                    }`}
                  >
                    AI images
                  </button>
                </div>
                {pictureSource === 'ai' ? (
                  <p className="mt-2 text-xs text-inkfaint">
                    One hand-drawn doodle fills the frame behind all five
                    sentences. A matching panel from the{' '}
                    {status?.visuals?.doodles ?? 61}-panel library is reused
                    when one fits;{' '}
                    {status?.visuals?.grok
                      ? 'otherwise Grok draws a new one in the same style.'
                      : 'set XAI_API_KEY to have Grok draw a new one when none fits.'}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-inkfaint">
                    Free graphics: hand-picked icons and CC0 photos. Each
                    teaching lens brings its own dramatic style.
                  </p>
                )}
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
            <>
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Finding the passage…' : 'Find the passage'}
              </button>

              <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-rule bg-ground/60 px-4 py-3">
                <div className="min-w-48 flex-1">
                  <div className="text-sm font-semibold text-ink">
                    Make it a series instead
                  </div>
                  <div className="text-xs text-inksoft">
                    One short a day on this theme — a passage and a lens per
                    day, planned as an arc.
                  </div>
                </div>
                <select
                  value={seriesLen}
                  onChange={(e) => setSeriesLen(Number(e.target.value))}
                  aria-label="Series length"
                  className="rounded-lg border border-rule bg-white px-2 py-2 text-sm"
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
                  className="rounded-xl border border-accent px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accentsoft disabled:opacity-50"
                >
                  {busy ? 'Planning…' : 'Plan the series'}
                </button>
              </div>
            </>
          ) : sourceMode === 'link' ? (
            <button
              type="submit"
              disabled={
                busy ||
                youTubePasted ||
                !/^https?:\/\/\S+\.\S/i.test(sourceUrl.trim())
              }
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'Reading the link…' : 'Read the link'}
            </button>
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

      {step === 'compose' && <PossibilitiesPanel />}
      {step === 'compose' && <DeveloperPanel />}

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
            opens on its title, speaks the thought, then quotes the verse —
            retrieved from YouVersion, never from your document.
          </p>
          <div className="grid gap-4">
            {teachings.map((t, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => void teachingToShort(t)}
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
          <p className="mb-2 text-sm text-inksoft">
            {seriesDays.length} days on “{input}”. Pick a day to make its short
            now — every passage is retrieved from YouVersion when you choose it,
            and you can come back for the other days in any order.
          </p>
          <p className="mb-6 text-xs text-inkfaint">
            Generating the whole series in one click is coming in the
            production model.
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

          <AudioStatus
            audioUrl={audioUrl}
            languageName={language?.name ?? languageCode}
            tier={language?.tier}
          />

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
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
              section="side"
              style={styleId}
              theme={theme}
              busy={rebaking}
              onStyle={applyStyle}
              onTheme={applyTheme}
            />
          </div>

          <ThemePanel
            section="wide"
            style={styleId}
            theme={theme}
            busy={rebaking}
            onStyle={applyStyle}
            onTheme={applyTheme}
          />

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

  // Mirrors the split in lib/script/build: the same sentence-final marks,
  // including the Devanagari danda. Shown live so a creator editing the
  // teaching can see whether they still have five pages.
  const sentenceCount = explanation
    .trim()
    .split(/(?<=[.!?।॥。！？])\s+/u)
    .filter((s) => s.trim().length > 0).length;

  return (
    <div className="mt-10 rounded-xl border border-rule bg-white p-6">
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="font-display text-xl">Narration</h3>
        <span className="text-xs text-inkfaint">
          Everything authored is yours to edit. The verse is not authored.
        </span>
      </div>
      <p className="mb-4 text-sm text-inksoft">
        Applying changes re-voices the narration and re-times the captions. The
        teaching is shown five sentences to five pages, one at a time, so keep
        it to five sentences.
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
          <label className="mb-1 block flex items-baseline justify-between text-xs font-semibold tracking-widest text-inksoft uppercase">
            <span>Teaching — five sentences, five pages</span>
            <span
              className={
                sentenceCount === 5 ? 'text-inkfaint' : 'font-bold text-accent'
              }
            >
              {sentenceCount} sentence{sentenceCount === 1 ? '' : 's'}
            </span>
          </label>
          <textarea
            dir={dir}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={6}
            className="mb-2 w-full rounded-lg border border-rule bg-white px-3 py-2 text-base leading-relaxed"
          />
          {sentenceCount !== 5 && (
            <p className="mb-4 text-xs text-inksoft">
              {sentenceCount > 5
                ? 'The extra sentences will be merged onto the five pages.'
                : 'Short of five: a long sentence will be split at a comma to fill the pages.'}
            </p>
          )}
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
          Closes on {passage?.reference ?? 'the passage'} itself, retrieved and
          verified.
        </span>
      </div>
    </div>
  );
}

/**
 * The audio truth, stated where the creator is listening for it. English
 * narration is synthesized server-side and plays in the preview; every other
 * voiced language is synthesized inside the export job, so the preview is
 * silent by design; three languages have no free voice model at all yet.
 */
function AudioStatus({
  audioUrl,
  languageName,
  tier,
}: {
  audioUrl?: string;
  languageName: string;
  tier?: string;
}) {
  if (audioUrl) {
    return (
      <p className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <strong className="font-semibold">Audio ready</strong> — narration
        plays in this preview and in the exported MP4.
      </p>
    );
  }
  if (tier === 'text-first') {
    return (
      <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong className="font-semibold">No voice available</strong> — no free
        neural voice exists for {languageName} yet. The exported video shows
        every word on screen but has no narration audio.
      </p>
    );
  }
  return (
    <p className="mb-6 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
      <strong className="font-semibold">Silent preview</strong> — the{' '}
      {languageName} neural voice is generated during export, so this preview
      plays without sound. The exported MP4 is narrated.
    </p>
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

/**
 * What the same pipeline produces when you point it at different things.
 *
 * Grouped by who is doing the pointing, because the interesting claim is not
 * that one short can be made — it is that a volunteer, a church office and a
 * scheduled job all reach the same finished 1080x1920 file, and that the
 * languages with no short-form Scripture at all are reachable by the same
 * route as English.
 */
const POSSIBILITIES: Array<{ group: string; items: string[] }> = [
  {
    group: 'From whatever you already have',
    items: [
      'A verse or a topic — “Psalm 23”, or “anxiety at work”',
      'Sunday’s sermon, pasted or uploaded as .txt / .pdf, mined into five teachings',
      'A devotional article or blog post, read from its link',
      'A theme and 3, 5, 7 or 14 days, planned as an arc rather than a pile',
    ],
  },
  {
    group: 'For a congregation that is not one thing',
    items: [
      'The same passage in 40 languages, each written in that language rather than translated into it',
      'Scripts with no short-form Scripture at all — Telugu, Tamil, Malayalam, Bengali, Urdu, Georgian, Armenian',
      'Kids, youth or adult; everyday, formal or liturgical',
      'A Bible version picker where more than one translation is licensed',
      'Word-synced captions, which is also what makes a short watchable on mute',
    ],
  },
  {
    group: 'Made to look like you',
    items: [
      'Three motion styles × 8 palettes × 4 type pairs × 3 sizes',
      '69 backgrounds, including 34 animated loops and 10 hand-drawn frames',
      '8 text motions and 9 music beds, none of which require a credit to travel with the post',
      'Text only, curated graphics, or a full-frame hand-drawn panel behind the teaching',
    ],
  },
  {
    group: 'Running without you',
    items: [
      'A daily short from a cron job, through the MCP server',
      'A back catalogue: every psalm, or a whole book, batched',
      'An agent that drafts the week and hands you the review',
      'Shorts pushed to a public gallery, shareable to WhatsApp, Telegram or X',
    ],
  },
];

const REPO_URL = 'https://github.com/phildani7/scriptorium';
/** Committed, so the same file downloads from the site and from the tree. */
const SKILLS_ZIP = '/downloads/scriptorium-skills.zip';
const SKILLS_ON_GITHUB = `${REPO_URL}/raw/master/public/downloads/scriptorium-skills.zip`;

/**
 * What this is built on, named plainly.
 *
 * A judge, a reviewer or anyone deciding whether to reuse this needs the stack
 * before they need the API, and reading it out of package.json is work nobody
 * should have to do.
 */
const STACK: Array<[string, string]> = [
  ['HyperFrames', 'the render framework: frozen HTML compositions captured to MP4 by seeking a paused timeline'],
  ['GSAP', 'every animation, transform/opacity/filter only, seek-safe at any frame'],
  ['Next.js 16 · React 19', 'App Router, TypeScript, Tailwind v4'],
  ['YouVersion Platform API', 'every word of Scripture, retrieved and verified'],
  ['Gloo AI Studio', 'the teaching, on gloo-anthropic-claude-haiku-4.5, with Claude live behind it'],
  ['Speechmatics', 'narration, plus the word timings the captions ride'],
  ['Piper', 'MIT neural voices for ~50 languages, synthesized in the export job'],
  ['Grok Imagine', 'pictures, and nothing else — no text path reaches xAI'],
  ['Playwright · FFmpeg', 'frame capture and encode, on GitHub Actions or a Vercel Sandbox microVM'],
  ['MCP', 'the whole studio as eight stateless tools'],
];

/** The MCP tools, in the order `/api/mcp` registers them. */
const MCP_TOOLS: Array<[string, string]> = [
  ['resolve_passage', 'a reference or topic, to verbatim YouVersion passages'],
  ['list_versions', 'the Bible versions licensed for a language'],
  ['generate_devices', 'a passage, to 3-7 teaching devices through one lens'],
  ['extract_teachings', 'your own sermon or article, to teachings (references only)'],
  ['plan_series', 'a theme and a day count, to a planned arc'],
  ['create_short', 'the whole pipeline, ending in a queued MP4 export'],
  ['list_options', 'every palette, face, size, background, motion and music bed'],
  ['gallery', 'the shorts that have already rendered'],
];

/**
 * The consolidated answer to "what is this actually for".
 *
 * Sits between the form and the developer panel, which is where someone lands
 * after their first short and starts wondering what else the same machine
 * does. Listed rather than described: every line is a thing the shipped
 * pipeline does today, not a roadmap.
 */
function PossibilitiesPanel() {
  return (
    <section className="mt-8 rounded-2xl border border-rule bg-panel p-5">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-label text-[11px] font-bold tracking-[0.18em] text-inksoft uppercase">
          What you can make with it
        </h2>
        <span className="text-xs text-inkfaint">
          one pipeline, pointed at different things
        </span>
      </div>

      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {POSSIBILITIES.map((section) => (
          <div key={section.group}>
            <h3 className="mb-2 font-display text-lg leading-snug text-ink">
              {section.group}
            </h3>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-2 text-sm leading-relaxed text-inksoft"
                >
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * What a developer needs, on the page a developer actually lands on.
 *
 * The MCP server is the most interesting thing here after the integrity gate,
 * and until now it was documented only in the README — which is to say,
 * somewhere nobody looking at the running app would find it. Everything the
 * studio can do is reachable headlessly, and the rule that makes the studio
 * trustworthy holds there too: the tools are thin wrappers over the same API
 * routes, so an agent cannot reach a path where Scripture is generated rather
 * than retrieved, because no such path exists to reach.
 */
function DeveloperPanel() {
  const endpointRef = useRef<HTMLElement>(null);

  // The absolute URL is what an MCP client needs, and it is only knowable in
  // the browser: this app runs on a preview deployment, a production domain,
  // and localhost, and printing the wrong one is worse than printing none.
  //
  // Written to the DOM rather than held in state. The server has no origin to
  // render, so state would mean shipping one string in the HTML and swapping
  // it on hydration — a mismatch React is right to complain about, for a
  // value that is display-only and never read back.
  useEffect(() => {
    const node = endpointRef.current;
    if (node) node.textContent = `POST ${window.location.origin}/api/mcp`;
  }, []);

  const copyEndpoint = () => {
    navigator.clipboard?.writeText(
      `${window.location.origin}/api/mcp`,
    );
  };

  return (
    <section className="mt-8 rounded-2xl border border-rule bg-ground/40 p-5">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-label text-[11px] font-bold tracking-[0.18em] text-inksoft uppercase">
          For developers
        </h2>
        <span className="text-xs text-inkfaint">
          drive all of this without the screen
        </span>
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-lg border border-rule bg-white px-3 py-1.5 text-sm font-medium text-inksoft transition hover:bg-ground"
        >
          Source on GitHub ↗
        </a>
      </div>

      <p className="mb-4 max-w-3xl text-sm leading-relaxed text-inksoft">
        Scriptorium ships a{' '}
        <strong className="font-semibold text-ink">headless MCP server</strong>{' '}
        at the address below. It speaks streamable HTTP and is completely
        stateless: no sessions, no stored context, no SSE stream to hold open.
        Every request builds a server, answers in plain JSON, and discards it.
        Point any MCP client at it and you can run the whole pipeline from an
        agent, a script, or a cron job.
      </p>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-rule bg-white px-4 py-3">
        <code ref={endpointRef} className="font-mono text-sm break-all text-ink">
          POST /api/mcp
        </code>
        <button
          type="button"
          onClick={copyEndpoint}
          className="ml-auto rounded-lg border border-rule px-3 py-1 text-xs font-medium text-inksoft transition hover:bg-ground"
        >
          Copy
        </button>
      </div>

      <dl className="mb-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {MCP_TOOLS.map(([name, blurb]) => (
          <div key={name} className="flex flex-wrap items-baseline gap-x-2">
            <dt className="font-mono text-[13px] font-semibold text-accent">
              {name}
            </dt>
            <dd className="text-xs text-inksoft">{blurb}</dd>
          </div>
        ))}
      </dl>

      <p className="mb-5 text-xs leading-relaxed text-inkfaint">
        Each tool is a thin wrapper over the same API route the studio calls,
        so the architecture&rsquo;s one rule holds for agents exactly as it
        does for people: models return references, and verse text is always
        fetched from YouVersion afterwards. A{' '}
        <code className="font-mono">GET</code> on the same address returns the
        server descriptor and the tool list, which is a quick way to check a
        deployment is live before wiring a client to it.
      </p>

      {/* ---- the skill pack ---- */}
      <div className="mb-5 rounded-xl border border-accent/25 bg-accentsoft/40 p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2">
          <h3 className="font-label text-[11px] font-bold tracking-[0.16em] text-accent uppercase">
            Agent skills
          </h3>
          <span className="text-xs text-inksoft">
            teach your agent to drive all of the above
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <a
              href={SKILLS_ZIP}
              download
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Download .zip ↓
            </a>
            <a
              href={SKILLS_ON_GITHUB}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-rule bg-white px-3 py-1.5 text-sm font-medium text-inksoft transition hover:bg-ground"
            >
              On GitHub ↗
            </a>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-inksoft">
          An MCP server tells an agent what it <em>can</em> call. It does not
          tell it which lens suits a passage, that the five teaching sentences
          are five pages, or why it must never ask a model for a verse. That is
          what the skill pack carries:{' '}
          <code className="font-mono text-[13px] text-ink">SKILL.md</code>
          {' plus a pipeline reference and worked multi-call recipes. '}
          Unzip it into your
          agent&rsquo;s skills directory and point the client at the endpoint
          above. Packed from{' '}
          <code className="font-mono text-[13px] text-ink">skills/</code> by{' '}
          <code className="font-mono text-[13px] text-ink">
            npm run skills:pack
          </code>
          , so the download cannot drift from the repo.
        </p>
      </div>

      {/* ---- the stack ---- */}
      <div>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-label text-[11px] font-bold tracking-[0.16em] text-inksoft uppercase">
            Built on
          </h3>
          <span className="text-xs text-inkfaint">
            open frameworks, licensed APIs, nothing hand-waved
          </span>
        </div>
        <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          {STACK.map(([name, blurb]) => (
            <div key={name} className="flex flex-wrap items-baseline gap-x-2">
              <dt className="font-label text-[13px] font-semibold text-ink">
                {name}
              </dt>
              <dd className="text-xs text-inksoft">{blurb}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-inkfaint">
          The compositions are{' '}
          <strong className="font-semibold text-inksoft">HyperFrames</strong>{' '}
          pages: one paused GSAP timeline built synchronously, seeded randomness
          only, no network. That contract is what lets the renderer capture a
          frame by seeking to it — and it is why the browser preview and the
          exported MP4 consume byte-identical HTML, so the preview cannot
          flatter the export.
        </p>
      </div>
    </section>
  );
}

/**
 * The header states what the tool is for, then shows who supplies what.
 *
 * The two panels are the design's one deliberate move, and they are not
 * decoration: this app has exactly two sources, and the line between them IS
 * the architecture. The verse is RECEIVED — retrieved from YouVersion,
 * verbatim, locked. The teaching is WRITTEN — composed by Gloo around that
 * verse, and editable to the last word. So the panels are set in different
 * type and different colour, to read as two materials rather than two cards
 * from one set: Scripture quoted in the serif behind a rule, the teaching
 * drafted in the body face, warm against cool.
 *
 * Saying it this plainly is also the honest thing. "Scripture is retrieved,
 * never generated" is the promise the whole build rests on, and a promise is
 * worth more when a visitor can see who keeps which half of it.
 */
function Header({ status }: { status: StatusPayload | null }) {
  const notes = [
    status?.ai.degradedReason,
    status?.ai.fallbackNotice,
    status?.scripture.note,
    status?.voice.note,
  ].filter(Boolean) as string[];

  const audited = status?.coverage.audited;

  return (
    <header className="mb-8">
      <div className="mb-5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-display text-4xl tracking-tight">Scriptorium</h1>
        <p className="text-inksoft">Scripture shorts, in your own language.</p>
        {/* The social sliver: a heart that counts, and a door to the reviews.
            Both live on the far side so the masthead stays a masthead. The
            heart renders nothing on deployments with no feedback store. */}
        <div className="ml-auto flex items-center gap-3">
          <LikeButton />
          <a
            href="/gallery#reviews"
            className="text-sm text-inksoft underline decoration-rule underline-offset-4 transition hover:text-accent"
          >
            Leave a review
          </a>
          <a
            href="/gallery"
            className="rounded-xl border border-rule px-4 py-2 text-sm font-medium text-inksoft transition hover:bg-white"
          >
            Gallery →
          </a>
        </div>
      </div>

      <p className="mb-3 max-w-3xl text-lg leading-relaxed text-ink">
        Type a verse or a topic, paste a sermon, or drop in an article link.
        About a minute later you have a finished vertical short: narrated in a
        real voice, captioned word by word, set in your own script, ready to
        post. It works in{' '}
        <strong className="font-semibold">
          {audited ? `${audited.withBible} languages` : 'dozens of languages'}
        </strong>
        , and the design, the narration and the edit all come with it.
      </p>

      {/* Whose work this is, and what it was made for. Stated on the page
          rather than only in the README, because the page is what a judge
          opens first. */}
      <p className="mb-6 max-w-3xl border-l-2 border-rule pl-3 text-sm leading-relaxed text-inksoft">
        A submission by{' '}
        <strong className="font-semibold text-ink">
          Dr. Philemon Paul Daniel
        </strong>{' '}
        to <em>Scripture in New Frontiers</em>, the Kaggle competition run by{' '}
        <strong className="font-semibold text-ink">Gloo</strong> and{' '}
        <strong className="font-semibold text-ink">YouVersion</strong>.
      </p>

      {/* Two sources, two materials. */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-received/20 bg-receivedsoft/60 p-5">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-label text-[11px] font-bold tracking-[0.18em] text-received uppercase">
              Received
            </span>
            <span className="text-xs text-inksoft">the verse</span>
          </div>
          <p className="mb-3 border-l-2 border-received/40 pl-3 font-display text-xl leading-snug text-received">
            YouVersion
          </p>
          <p className="text-sm leading-relaxed text-inksoft">
            Every word of Scripture here is fetched from the{' '}
            <strong className="font-semibold text-ink">
              YouVersion Platform API
            </strong>{' '}
            and passed through untouched — never written by a model, never
            paraphrased.{' '}
            {audited
              ? `${audited.totalVersions} Bible versions across ${audited.withBible} languages`
              : 'Hundreds of Bible versions'}{' '}
            are open to this app, including many that have never had a video
            made in them. That generosity is the reason this tool can exist at
            all, and the reason it can be trusted.
          </p>
        </section>

        <section className="rounded-2xl border border-written/20 bg-writtensoft/60 p-5">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-label text-[11px] font-bold tracking-[0.18em] text-written uppercase">
              Written
            </span>
            <span className="text-xs text-inksoft">the teaching</span>
          </div>
          <p className="mb-3 font-label text-xl font-bold tracking-tight text-written">
            Gloo AI Studio
          </p>
          <p className="text-sm leading-relaxed text-inksoft">
            <strong className="font-semibold text-ink">Gloo</strong> writes the
            five sentences around the verse: the opening line, the teaching,
            the picture it reaches for. It is built for ministry rather than
            general chat, so a short can be aimed at the tradition and the
            audience it is actually for, and it reports which model answered
            and how confident it was. Careful work, put within reach of people
            who could not otherwise have paid for it.
          </p>
        </section>
      </div>

      {/* The gate that stands between the two panels above, so it sits
          between them on the page as well: one strip, one statement. */}
      <p className="mb-1 flex items-start gap-2.5 border-l-2 border-verified/50 py-0.5 pl-3 text-sm text-inksoft">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="mt-0.5 h-4 w-4 shrink-0 text-verified"
          aria-hidden="true"
        >
          <path
            d="M12 2 3 6v6c0 5 3.8 9.3 9 10 5.2-.7 9-5 9-10V6l-9-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="m8.5 12 2.5 2.5 4.5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>
          <strong className="font-label text-[11px] font-bold tracking-[0.14em] text-verified uppercase">
            Verified
          </strong>{' '}
          — before a single frame is captured, the verse on screen is fetched
          from YouVersion again and compared with what the API returns. A
          mismatch stops the render.
        </span>
      </p>

      {status && (
        <p className="mt-3 font-label text-xs tracking-wide text-inkfaint">
          {status.coverage.audited.withBible} languages ·{' '}
          {status.coverage.audited.complete} with a neural voice and word
          timing measured from the audio ·{' '}
          {status.coverage.audited.totalVersions} Bible versions ·{' '}
          {status.visuals?.doodles ?? 61} hand-drawn doodle panels
          {status.ai.active === 'gloo' && status.ai.fallbackReady
            ? ' · Gloo, with Claude standing by'
            : ''}
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
