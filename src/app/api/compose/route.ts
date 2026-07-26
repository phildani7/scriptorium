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
import type { DeviceItem, Passage, ShortSpec, StyleId, VoiceId } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ComposeBody {
  passage?: Passage;
  device?: DeviceItem;
  style?: StyleId;
  theme?: ShortSpec['theme'];
  voice?: VoiceId;
  languageCode?: string;
  /** Creator's edited narration for the DEVICE portion only. */
  deviceOverride?: string;
  speakReference?: boolean;
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
  };

  const { script, segments } = buildNarrationScript({
    device: effectiveDevice,
    passage,
    speakReference: body.speakReference ?? true,
  });

  // --- the gate ------------------------------------------------------------
  // Assert that the verse inside the assembled script is still exactly the
  // verse the API returned. This catches any mutation introduced by script
  // assembly before a single frame is rendered.
  const verseText = segments.find((s) => s.kind === 'verse')?.text ?? '';
  const verification = verifyVerbatim(verseText, passage.text);
  if (!verification.ok) {
    return NextResponse.json(
      {
        error: 'Scripture integrity check failed during script assembly.',
        detail: verification.message,
      },
      { status: 500 },
    );
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
    durationSec,
    verified: true,
    // Presentation hints the template reads directly.
    script: entry?.script ?? 'latin',
    dir: directionFor(languageCode),
  };

  return NextResponse.json({ spec, verification: verification.message });
}
