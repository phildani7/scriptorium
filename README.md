# Pentecost Studio

**Scripture shorts, in your own language.**

Built for the Gloo × YouVersion *Scripture in New Frontiers* challenge.

---

## The gap

YouVersion serves Scripture as **text** in over a thousand languages. The world's
dominant medium is now **vertical video** — and in most of those languages there is
essentially none of it, because making a good short takes a designer, a voice, and an
editor that a volunteer church does not have.

Pentecost Studio removes all three. Type a reference or a feeling, pick a lens and a
language, and about a minute later you have a publishable 1080×1920 short: narrated,
word-synced captions, motion design, attribution on screen.

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
      ──▶ /api/preview   HyperFrames   ShortSpec ──▶ composition HTML
```

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

50 in the registry, with tiers **derived from verified capability**, never asserted:
38 have a neural voice *and* measured word timing; the rest are labelled honestly in
the UI as voiced-only or captions-only.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev
```

`npm test` runs the integrity-gate suite. `npm run smoke:voice` exercises the live
Speechmatics loop. Without a YouVersion key the app serves clearly-labelled offline
sample passages — it never asks a model for verse text.

## Licence

Apache-2.0. Asset licences are recorded in `assets/CREDITS.md`.
