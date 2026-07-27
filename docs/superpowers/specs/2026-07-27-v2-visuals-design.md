# V2 — Dramatic visuals per teaching type

Date: 2026-07-27 · Status: approved (user brief, in session) · V1 frozen at tag v1.0.0

## What V2 adds

1. **Visual mode is a first-class choice.** On the compose screen the creator
   picks *Text only* or *Text + pictures*. Choosing pictures reveals a second
   choice: **Free graphics** (vendored no-attribution SVG icons + CC0 photos
   from Openverse) or **AI images** (1024×1024 1:1, low quality tier, via the
   Kie.ai GPT-Image API — key arrives later; infrastructure ships now and the
   option stays disabled until `KIE_API_KEY` is set).
2. **A dramatic style per teaching type.** The device type drives the visual
   choreography (`data-drama` on the root):
   - `hook` → **Blast**: visuals slam in at 3× with a motion-blur streak and a
     micro-shake settle; vignette pulse.
   - `analogy` → **Split**: pairs enter from opposite sides with opposing
     rotationY tilts and meet — the comparison made literal.
   - `punch-line` → **Pop**: back.out(2.4) spring pops with a small
     deterministic particle burst behind each visual.
   - `illustration` → **Waterfall**: visuals drop in as a soft cascade and
     drift gently.
   - `object-lesson` → **Spotlight**: one hero visual center stage with a glow
     bloom and a slow settle; secondary items arrive blurred and stay soft.
3. **No review gate.** The approve-before-compose step and the Auto-mode
   toggle are deleted; choosing an opening composes immediately. The verbatim
   machine gate still runs everywhere it always did.
4. **Final step is editable.** The preview screen shows the full narration
   text (device line + teaching), fully editable; applying edits re-composes
   narration (voice + timings). The citation stays derived; the verse stays
   retrieved-only.

## Data model

```ts
type VisualMode = 'text' | 'free' | 'ai';
interface VisualItem {
  kind: 'icon' | 'photo' | 'ai-image';
  svg?: string;        // icons: inline vendored markup (stroke: currentColor)
  src?: string;        // photos/ai: URL (preview) → local path (render bundle)
  term: string;        // the concept it illustrates
  timeSec: number;     // resolved against narration timings at compose
  slot: number;        // deterministic placement slot
  credit?: string;
}
interface ShortVisuals { mode: VisualMode; items: VisualItem[]; }
// ShortSpec.visuals?: ShortVisuals ; DeviceItem.visualTerms?: string[]
// DeviceItem.imagePrompt?: string  (AI mode's 1:1 image prompt)
```

## Pipelines

- **Icons**: `lucide-static` (ISC — no attribution) as a devDependency.
  `scripts/make-icons.ts` reads a curated concept→icon map (~140 concepts) and
  generates `src/lib/visuals/icons.generated.ts` with raw SVG markup. Inline
  markup, not files: SVGs recolor via `currentColor` and need no fetch, so
  the file:// renderer needs no CORS exemption.
- **Matching**: generation now returns `visualTerms` (3–5 concrete English
  nouns) per device; fallback is keyword extraction from the explanation.
  The matcher finds each term's word in the narration timings and anchors the
  visual to that beat, spread across the teaching segment, max 4.
- **Photos**: Openverse API, `license=cc0`, square-leaning, no key required;
  failures degrade to icons silently.
- **AI**: `src/lib/visuals/kie.ts` — create-task + poll client, base URL and
  model env-configurable (`KIE_API_KEY`, `KIE_API_BASE`, `KIE_IMAGE_MODEL`),
  1024×1024, one image per short (the device's `imagePrompt`). Unconfigured →
  `/api/status` reports it and the UI disables the choice.
- **Render**: `render/render.ts` downloads any http(s) visual into the bundle
  and rewrites the spec copy, so the offline render stays self-contained.

## Determinism

Visual entrances are transform/opacity/filter tweens on the one paused
timeline; particle bursts use fixed pools with index-seeded values; slots and
timing are resolved at compose, not at render. Seek-safe both directions.

## Out of scope (V2.1+)

Multiple AI images per short; per-visual manual placement; AI image style
presets; visuals in captions.
