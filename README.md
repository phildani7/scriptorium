# Scriptorium

**Scripture shorts, in your own language.**

Built for the Gloo × YouVersion *Scripture in New Frontiers* challenge.

---

## The gap

YouVersion serves Scripture as **text** in over a thousand languages. The world's
dominant medium is now **vertical video** — and in most of those languages there is
essentially none of it, because making a good short takes a designer, a voice, and an
editor that a volunteer church does not have.

Scriptorium removes all three. Type a reference or a feeling, pick a lens and a
language, and about a minute later you have a publishable 1080×1920 short: narrated,
word-synced captions, real motion design, your colors and type — with the verse's
provenance carried in the gallery manifest.

## The architectural claim

**Scripture is retrieved, never generated — and the build proves it.**

Verse text comes verbatim from the YouVersion Platform API and is never touched. The
model writes only the teaching device around it. Before a frame is captured, the
rendered verse node is NFC-normalized and compared character by character against the
API response; a mismatch **fails the build** rather than shipping.

You can see this claim in three places:

- `src/lib/verify/verbatim.ts` — the gate, dependency-free so it is trivially auditable
- `src/lib/verify/verbatim.test.ts` — 13 tests, including a single dropped Devanagari
  matra (`मुझे` → `मुझ`) and a danda swapped for a period
- The review screen — every field is editable except the verse, which is **locked**

## Architecture

```
input ──▶ /api/resolve   YouVersion    reference or topic ──▶ passage (verbatim)
      ──▶ /api/generate  Gloo AI       passage ──▶ 3-7 teaching devices
      ──▶ review gate    human         verse locked; or Auto mode skips review
      ──▶ /api/compose   Speechmatics  narration + word timings ──▶ ShortSpec
      ──▶ /api/preview   HyperFrames   ShortSpec + theme ──▶ composition HTML
      ──▶ /api/export    GitHub Actions render ──▶ MP4 ──▶ /gallery
```

## Styles, themes, customization

Three frozen HyperFrames styles — **Warm Minimal** (editorial, zoom-through
seam), **Kinetic Type** (poster type landing word-by-word on the measured
voice timings), **Neon Night** (glow, seeded particles, a flare at the turn) —
crossed with one-click **8 palettes × 4 font pairs × 3 sizes × 5 CSS-generated
backgrounds**. Theme choices bake in as CSS custom properties, so the browser
preview and the MP4 export consume byte-identical HTML.

Every animation obeys the HyperFrames determinism contract: one paused GSAP
timeline built synchronously, seeded randomness only, transform/opacity/filter
tweens, seek-safe at any frame — which is exactly what lets the renderer
capture frames by seeking.

## Export and gallery

"Export MP4" fires a `repository_dispatch`; a GitHub Actions job re-synthesizes
narration from its own secrets, re-fetches the passage from YouVersion (the
integrity gate refuses to render if the spec was tampered with), renders
1080×1920 H.264, and commits the MP4 + poster into `/public/gallery` — which
redeploys the gallery. When cloud rendering is not configured the studio hands
back the spec for a local `npm run render`.

**Gloo** is used for what only Gloo does: `tradition` values-alignment (a Catholic
parish and a Pentecostal youth group need different emphases from the same verse) and
`auto_routing`, whose tier and confidence are recorded per short. A Claude provider
sits behind the same interface for development.

**Speechmatics** does two jobs. TTS produces narration; batch transcription produces
per-word timings. Crucially the transcript's *words are discarded* — ASR supplies only
a clock, and captions are rendered from the verified script. ASR reliably hears "he"
where the text says "He"; displaying that under a verse would look like altered
Scripture.

**Templates** are frozen HyperFrames compositions: one paused timeline, seek-safe, no
network, self-hosted OFL fonts. The same HTML serves the browser preview and the
offline MP4 render, so the preview cannot flatter the export.

## Languages

50 in the registry, with tiers **derived from verified capability**, never asserted.
`npm run audit:languages` sweeps the live YouVersion API and writes the numbers the
UI shows: against this app key, **40 languages licensed, 33 complete (Bible + voice
+ measured word timing), 116 Bible versions reachable**.

## Live

- **App**: https://scriptorium-gamma-wheat.vercel.app
- **Gallery**: https://scriptorium-gamma-wheat.vercel.app/gallery — reads the repo's
  manifest live, so exported shorts appear as their render jobs push
- **Repo / render jobs**: https://github.com/phildani7/scriptorium

## Run it

```bash
npm install
cp .env.example .env.local    # then fill in the keys
npm run dev
```

| Command | Does |
| --- | --- |
| `npm test` | Integrity-gate, USFM, and alignment suites (36 tests) |
| `npm run prove:gate` | End-to-end proof: tampers with a verse, asserts the render refuses |
| `npm run smoke:voice` | Live Speechmatics TTS → ASR → alignment round trip |
| `npm run audit:languages` | Re-audit language coverage against the live API |
| `npm run samples` / `npm run gallery` | Generate specs through the real pipeline, render them into `/public/gallery` |
| `npm run render -- --spec <file>` | Render one spec to MP4 through the verse re-fetch gate |

Without a YouVersion key the app serves clearly-labelled offline sample passages —
it never asks a model for verse text.

## Licence

Apache-2.0. Asset licences are recorded in `assets/CREDITS.md`.
