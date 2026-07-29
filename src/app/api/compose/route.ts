/**
 * Passage + chosen device -> a complete, verified ShortSpec.
 *
 * This is the single assembly point, called by both paths:
 *   - review mode, after the creator approves the script
 *   - auto mode, immediately after a device is chosen
 *
 * Both run identical code. Auto mode skips the human check, not the machine
 * one: the verbatim gate below runs either way, and a failure here refuses to
 * return a spec rather than returning one that renders altered Scripture.
 */

import { NextResponse } from 'next/server';
import { guard } from '@/lib/rate-limit';
import { buildNarrationScript } from '@/lib/script/build';
import { synthesizeAndAlign } from '@/lib/voice';
import { alignScriptToAudio } from '@/lib/voice/align';
import { verifyVerbatim } from '@/lib/verify/verbatim';
import { directionFor, getLanguage } from '@/lib/languages/registry';
import { buildVisuals } from '@/lib/visuals/match';
import { findCc0Photo } from '@/lib/visuals/openverse';
import { generateKieImage, kieConfigured } from '@/lib/visuals/kie';
import type {
  DeviceItem,
  Narration,
  Passage,
  ShortSpec,
  StyleId,
  VisualItem,
  VisualMode,
  VoiceId,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
// Fluid compute allows this even on Hobby; TTS + batch alignment for a long
// short can genuinely need more than 60 s, and a 504 here loses real work.
export const maxDuration = 300;

interface ComposeBody {
  passage?: Passage;
  device?: DeviceItem;
  style?: StyleId;
  theme?: ShortSpec['theme'];
  voice?: VoiceId;
  languageCode?: string;
  /** Creator's edited narration for the DEVICE portion only. */
  deviceOverride?: string;
  /** Creator's edited teaching text (the explanation). Never the verse. */
  explanationOverride?: string;
  /** V2: text only, free graphics, or AI images. Default text. */
  visualMode?: VisualMode;
  speakReference?: boolean;
  /**
   * Doc-sourced format: speak and display the verse after the teaching
   * (title → thought → verse → reference). The verse segment then goes
   * through the verbatim gate below.
   */
  speakVerse?: boolean;
}

export async function POST(request: Request) {
  const limited = guard(request, 'compose', 15);
  if (limited) return limited;

  let body: ComposeBody;
  try {
    body = (await request.json()) as ComposeBody;
  } catch {
    return NextResponse.json({ error: 'Body must be JSON.' }, { status: 400 });
  }

  const { passage, device } = body;
  if (!passage?.text || !device?.content) {
    return NextResponse.json(
      { error: 'A passage and a chosen device are both required.' },
      { status: 400 },
    );
  }

  const languageCode = body.languageCode ?? passage.languageCode ?? 'en';
  const style: StyleId = body.style ?? 'warm-minimal';

  // The creator may rewrite the device line. They may not rewrite the verse:
  // there is deliberately no field on this request that could carry one.
  const effectiveDevice: DeviceItem = {
    ...device,
    content: (body.deviceOverride ?? device.content).trim() || device.content,
    explanation:
      (body.explanationOverride ?? device.explanation)?.trim() ||
      device.explanation,
  };

  const { script, segments } = buildNarrationScript({
    device: effectiveDevice,
    passage,
    speakReference: body.speakReference ?? true,
    includeVerse: body.speakVerse ?? false,
  });

  // --- the gate ------------------------------------------------------------
  // When the script carries a verse segment (legacy verse-display shape),
  // assert it is still exactly the verse the API returned. Teaching-format
  // scripts never speak or display the verse, so there is nothing verbatim to
  // check here — provenance is enforced at render, where the cited passage is
  // re-fetched and diffed against the spec.
  const verseSeg = segments.find((s) => s.kind === 'verse');
  let verificationMessage =
    'Teaching format: verse cited, not displayed; provenance enforced at render.';
  if (verseSeg) {
    const verification = verifyVerbatim(verseSeg.text, passage.text);
    if (!verification.ok) {
      return NextResponse.json(
        {
          error: 'Scripture integrity check failed during script assembly.',
          detail: verification.message,
        },
        { status: 500 },
      );
    }
    verificationMessage = verification.message;
  }

  // Default voice, chosen by capability rather than left silent:
  //   en        Speechmatics — narrated here, word timing measured from audio
  //   non-en    Piper — synthesized inside the export job (serverless cannot
  //             run the model); the preview uses estimated timings meanwhile
  // A studio export was arriving as a silent MP4 because this defaulted to the
  // browser engine, which only exists client-side.
  const voice: VoiceId =
    body.voice ??
    (languageCode === 'en'
      ? { engine: 'speechmatics', model: 'theo', label: 'Theo (British)' }
      : getLanguage(languageCode)?.piperVoice
        ? {
            engine: 'piper',
            model: getLanguage(languageCode)!.piperVoice!,
            label: 'Neural voice (rendered at export)',
          }
        : { engine: 'browser', model: languageCode, label: 'Device voice' });

  // --- narration -----------------------------------------------------------
  let audioUrl = '';
  let durationSec: number;
  let timings;
  let timingSource: ShortSpec['narration']['timingSource'];

  if (voice.engine === 'speechmatics' && process.env.SPEECHMATICS_API_KEY) {
    const result = await synthesizeAndAlign({ script, languageCode, voice });
    audioUrl = `data:audio/wav;base64,${Buffer.from(result.audio).toString('base64')}`;
    durationSec = result.durationSec;
    timings = result.timings;
    timingSource = result.timingSource;
  } else {
    // Browser and Piper voices are produced elsewhere (client-side preview and
    // the export job respectively), so here we lay out an estimated timeline
    // at a natural reading pace and label it honestly.
    const words = script.trim().split(/\s+/).length;
    durationSec = Math.max(15, Math.min(45, words / 2.6));
    timings = alignScriptToAudio(script, [], durationSec).timings;
    timingSource = 'estimated';
  }

  // --- V2 visuals -----------------------------------------------------------
  // Resolved HERE, server-side, so preview and export consume one spec. Icons
  // are deterministic; the hero photo/AI image is fetched once and embedded
  // by URL (the render step localizes it). Every failure degrades toward
  // icons-only — a broken image API can never block a short.
  const visualMode: VisualMode = body.visualMode ?? 'text';
  let visuals: ShortSpec['visuals'];
  if (visualMode !== 'text') {
    const narration: Narration = {
      script,
      audioUrl,
      durationSec,
      timings,
      timingSource,
      segments,
    };
    const heroTime = (() => {
      const teach =
        segments.find((s) => s.kind === 'teaching') ?? segments[0];
      const first = timings[teach?.wordStart ?? 0];
      return first ? first.start + 0.4 : durationSec * 0.35;
    })();

    const extras: VisualItem[] = [];
    if (visualMode === 'ai' && kieConfigured() && effectiveDevice.imagePrompt) {
      const image = await generateKieImage(effectiveDevice.imagePrompt);
      if (image) extras.push({ ...image, timeSec: heroTime });
    } else if (visualMode === 'free' && effectiveDevice.visualTerms?.length) {
      const photo = await findCc0Photo(effectiveDevice.visualTerms[0]);
      if (photo) extras.push({ ...photo, timeSec: heroTime });
    }
    visuals = buildVisuals(visualMode, effectiveDevice, narration, extras);
  }

  const entry = getLanguage(languageCode);

  const spec: ShortSpec & { script: string; dir: string } = {
    id: `short-${passage.usfm}-${style}-${Date.now().toString(36)}`,
    passage,
    device: effectiveDevice,
    style,
    theme: body.theme,
    languageCode,
    voice,
    narration: { script, audioUrl, durationSec, timings, timingSource, segments },
    music: null,
    visuals,
    durationSec,
    verified: true,
    // Presentation hints the template reads directly.
    script: entry?.script ?? 'latin',
    dir: directionFor(languageCode),
  };

  return NextResponse.json({ spec, verification: verificationMessage });
}
