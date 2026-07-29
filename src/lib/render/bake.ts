/**
 * Bake a ShortSpec into a frozen template.
 *
 * Shared by the live preview route and the MP4 renderer so both consume
 * byte-identical HTML — the preview cannot flatter the export.
 *
 * Three things must be written into the STATIC markup rather than applied by
 * the composition's own script, because the renderer reads them while parsing
 * the page, before any script runs:
 *
 *   - `data-duration` on the root, which is authoritative for render length
 *   - the narration `<audio src>`, since the framework owns media playback
 *   - `data-script` / `data-dir`, which drive font and direction CSS
 *
 * Getting this wrong is quiet: the render simply comes out the template's
 * default length, with no audio, and nothing errors.
 */

import {
  resolveMusic,
  themeAttributes,
  themeStyle,
  type ShortTheme,
} from '@/lib/theme/options';

export interface BakeOptions {
  /** Raw template HTML. */
  template: string;
  /** The ShortSpec, plus the presentation hints the template reads. */
  spec: Record<string, unknown>;
  /**
   * Rewrites root-relative asset URLs (`/fonts/…`, `/vendor/…`). The web app
   * serves them from the origin; the renderer reads them from disk.
   */
  assetPrefix?: string;
  /** Overrides `narration.audioUrl` for the static `<audio src>`. */
  audioSrc?: string;
}

export function bakeComposition(options: BakeOptions): string {
  const { template, spec, assetPrefix, audioSrc } = options;
  const theme = spec.theme as ShortTheme | undefined;

  const narration = spec.narration as { durationSec?: number; audioUrl?: string } | undefined;
  const duration = Number(spec.durationSec ?? narration?.durationSec ?? 30);
  const src = audioSrc ?? narration?.audioUrl ?? '';

  let html = template;

  // Root attributes the renderer reads at parse time.
  html = html.replace(
    /(<div\s+id="short"[^>]*?)data-duration="[^"]*"/,
    `$1data-duration="${duration.toFixed(3)}"`,
  );

  // The clip window must match too. The framework owns clip visibility and
  // hides content outside [data-start, data-start + data-duration] — with the
  // template's static 30s the composition kept rendering but every element
  // vanished at 0:30, which is precisely how a 33-second short goes blank for
  // its last three seconds while nothing errors.
  html = html.replace(
    /(class="clip"\s+data-start="0"\s+)data-duration="[^"]*"/,
    `$1data-duration="${duration.toFixed(3)}"`,
  );
  html = html.replace(
    /(<div\s+id="short"[^>]*?)data-script="[^"]*"/,
    `$1data-script="${escapeAttr(String(spec.script ?? 'latin'))}"`,
  );
  html = html.replace(
    /(<div\s+id="short"[^>]*?)data-dir="[^"]*"/,
    `$1data-dir="${escapeAttr(String(spec.dir ?? 'ltr'))}"`,
  );

  // Theme: CSS custom properties inline on the root, plus a background-variant
  // attribute. Written statically so the very first captured frame is themed —
  // applying these from script would leave frame 0 in default colours.
  const attrs = themeAttributes(theme);
  const rebase = (path: string) =>
    assetPrefix !== undefined ? assetPrefix + path.replace(/^\//, '') : path;

  let style = themeStyle(theme);
  if (attrs.photoSrc) {
    style += `; --t-photo: url('${rebase(attrs.photoSrc)}')`;
  }
  // A data URI, deliberately: mask-image is CORS-checked and the renderer
  // loads compositions from file://, where an external mask can never load.
  if (attrs.doodleData) {
    style += `; --t-doodle: url('${attrs.doodleData}')`;
  }

  // V2: the device type drives the visual choreography (drama preset).
  const deviceType = (spec.device as { type?: string } | undefined)?.type ?? '';
  const drama = /^[a-z-]+$/.test(deviceType) ? deviceType : '';

  html = html.replace(
    /(<div\s+id="short")/,
    `$1 style="${escapeAttr(style)}" data-bg="${attrs.bg}" data-dark="${attrs.dark}"` +
      ` data-anim="${attrs.textStyle}"` +
      (drama ? ` data-drama="${drama}"` : '') +
      (attrs.captionsOff ? ' data-captions="off"' : ''),
  );

  // Video background: point the static loop at its file, or remove the holder
  // entirely — an empty-src <video> would make the renderer wait on a failed
  // media request, exactly like the audio elements below.
  html = attrs.videoSrc
    ? html.replace(
        /(<video\s+id="bg-video"[^>]*?\s)src="[^"]*"/,
        `$1src="${escapeAttr(rebase(attrs.videoSrc))}"`,
      )
    : html.replace(
        /<div id="bg-video-holder">[\s\S]*?<\/div>/,
        '<div id="bg-video-holder"></div>',
      );

  // Music bed: point the static element at the chosen track, or remove it —
  // an <audio> with an empty src makes the renderer wait on a failed request.
  const music = resolveMusic(theme);
  html = music.file
    ? html.replace(
        /(<audio\s+id="music"[^>]*?\s)src="[^"]*"/,
        `$1src="${escapeAttr(rebase(music.file))}"`,
      )
    : html.replace(/<audio\s+id="music"[\s\S]*?<\/audio>/, '');

  // Narration element: point it at the audio, or remove it. An <audio> with an
  // empty src makes Chrome emit a failed media request, which the renderer
  // waits on.
  html = src
    ? html.replace(
        /(<audio\s+id="narration"[^>]*?\s)src="[^"]*"/,
        `$1src="${escapeAttr(src)}"`,
      )
    : html.replace(/<audio\s+id="narration"[\s\S]*?<\/audio>/, '');

  // Empty string is meaningful: it turns "/fonts/…" into the plain relative
  // "fonts/…" for self-contained render bundles. Only undefined skips.
  if (assetPrefix !== undefined) {
    html = html.replace(
      /(href|src)="\/(fonts|vendor|music|backgrounds|cliparts)\//g,
      `$1="${assetPrefix}$2/`,
    );
  }

  // Escaping `</` stops a passage or device string from closing the script tag.
  const json = JSON.stringify(spec, null, 2).replace(/<\//g, '<\\/');
  html = html.replace(
    /(<script id="short-spec" type="application\/json">)[\s\S]*?(<\/script>)/,
    `$1\n${json}\n$2`,
  );

  return html;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
