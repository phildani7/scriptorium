# Asset credits and licences

Every third-party asset that ships with Scriptorium, with source and licence.
Nothing here is paid, and nothing is licence-ambiguous.

## Fonts (all SIL Open Font License 1.1, self-hosted in /public/fonts)

| Family | Files | Source |
| --- | --- | --- |
| Fraunces | `fraunces-*.woff2` | https://fonts.google.com/specimen/Fraunces |
| Inter | `inter-*.woff2` | https://fonts.google.com/specimen/Inter |
| Noto Serif Devanagari | `notoserifdevanagari-*.woff2` | https://fonts.google.com/noto/specimen/Noto+Serif+Devanagari |
| Archivo Black | `archivoblack-*.woff2` | https://fonts.google.com/specimen/Archivo+Black |
| Space Grotesk | `spacegrotesk-*.woff2` | https://fonts.google.com/specimen/Space+Grotesk |

Fonts are self-hosted because the MP4 render runs offline; a CDN reference
would silently fall back to a system face and, for Devanagari, break conjunct
shaping.

## Animation runtime

| Asset | File | Licence | Source |
| --- | --- | --- | --- |
| GSAP 3 | `/public/vendor/gsap.min.js` | GSAP standard license (free, incl. commercial use) | https://gsap.com |

## Scripture text

Verse text is retrieved at runtime from the YouVersion Platform API and is
never bundled, cached into the repo, or generated. Version names, copyright
strings, and publisher attributions travel with every gallery entry in
`public/gallery/manifest.json`. The English samples use the Berean Standard
Bible, which is dedicated to the public domain.

## Music (Audiio licence, /public/music, pre-attenuated + faded at import)

Licensed through the project creator's Audiio subscription (audiio.com).
The licence covers distribution in produced video; **no attribution is
required**. Credits still travel with gallery entries as a courtesy.

| File | Track | Artist |
| --- | --- | --- |
| `right-here.mp3` | Right Here | Su |
| `deeper-still.mp3` | Deeper Still | Jacob Montague |
| `beyond-the-pull.mp3` | Beyond the Pull of Things (Ambient) | Dmitriy Redko |
| `eternal-strings.mp3` | Eternal (Hanging Solo with Strings) | Pendelton |
| `sleep-habits.mp3` | Sleep Habits | Allen Bright |
| `elevate.mp3` | Elevate (Instrumental) | JinSei |
| `snow-fall.mp3` | Snow Fall (Instrumental) | Nylon & Cedar |
| `o-holy-night.mp3` | O Holy Night (Instrumental) | Allen & Bright |
| `christmas-cassette.mp3` | Christmas on Cassette (Instrumental) | Alex Velte |

## Attribution policy

Nothing that ships in a rendered short requires a credit to travel with it.

That is stricter than "correctly licensed", and deliberately so. A short is
made to be reposted, re-cut and re-uploaded by people who will never see this
file, so any asset whose licence depends on a credit line surviving that
journey is an asset that will eventually be used in breach of its terms by a
volunteer acting in good faith. Two sets were removed on that reasoning rather
than kept with a credit obligation attached:

- **NASA photo backgrounds** (`starfield.jpg`, `pillars.jpg`, `earth.jpg`).
  Public domain and free of legal obligation, but NASA's media guidelines ask
  that imagery not be used in a way implying endorsement, which a devotional
  short arguably does.
- **Four CC BY 4.0 music beds** by Kevin MacLeod (incompetech.com) —
  *Meditation Impromptu 01*, *At Rest*, *Heartbreaking*, *Wounded*. CC BY
  requires attribution to accompany the work.

Nine Audiio-licensed beds remain, which need no attribution.

Credits still travel in `public/gallery/manifest.json` for every short, as a
courtesy and a provenance record rather than a licence obligation.

### Outstanding: eight pre-rendered gallery shorts

Removing the source files stops any NEW short from incurring an attribution
obligation, but it cannot change an MP4 that was already rendered. Eight
entries in `public/gallery` were mixed with a Kevin MacLeod bed before the
policy changed, and in a finished MP4 the music and the narration are one
audio track — there is nothing to strip:

| Short | Bed |
| --- | --- |
| `short-MRK.12.41-44-warm-minimal-ms6mbf9z` | Wounded |
| `short-PRO.3.7-kinetic-type-ms30jpqh` | Heartbreaking |
| `short-MRK.10.13-16-warm-minimal-ms30byj8` | Heartbreaking |
| `short-JHN.8.32-warm-minimal-ms2q7n7y` | At Rest |
| `short-JER.17.5-8-warm-minimal-ms2iqhg6` | Meditation Impromptu 01 |
| `short-TIT.3.4-7-warm-minimal-ms244ezl` | Wounded |
| `short-HEB.12.1-warm-minimal-ms220fon` | At Rest |
| `es-philippians4-illustration` | Meditation Impromptu 01 |

These are **correctly licensed as they stand** — CC BY 4.0 requires
attribution, and each carries its credit in the gallery manifest, which is
what the gallery renders. They are listed here because they are the one place
the "no credit has to travel with it" rule does not yet hold. Re-rendering
them clears it; they predate the five-sentence format and will be re-rendered
for that reason anyway.

## Doodle panels (creator-owned, /public/doodles)

61 hand-drawn vertical panels (1080×1935) from the CartoonForChrist /
BibleBuddies doodle shorts, owned by the project creator and reused here as
the house illustration style for AI-visual mode. Catalogued with a
description, match tags and measured layout metrics in
`src/lib/visuals/doodles.ts`, and listed in `docs/doodle-library.md`.

## AI-generated images (xAI Grok Imagine)

When no doodle panel fits a teaching, one image is generated per short with
`grok-imagine-image` at 9:16 (720×1280, the model's lowest tier). Requires
`XAI_API_KEY`; without it the mode is reuse-only. Generated images carry an
`AI image (grok-imagine-image via xAI)` credit in the spec and the gallery
manifest. Grok is used for **pictures only** — never for verse text, and never
for the teaching prose, which comes from Gloo (see `src/lib/visuals/grok.ts`).

## Licensed stock art (creator-licensed, no attribution required)

The video background loops (`/public/backgrounds/video`), the full-bleed
image backgrounds (`/public/backgrounds/img`), and the full-colour clipart
library (`/public/cliparts`) are stock assets licensed to the project
creator. The licence covers use in produced video and **requires no
attribution**. All were normalized at import with ffmpeg: videos to
1080×1920 muted ~60 s loops, image backgrounds to 1080×1920 crops, cliparts
downscaled to a 512 px bounding box with alpha preserved.

## CC0 photos (Openverse, fetched at compose time)

"Free graphics" mode may add one CC0 photo from Openverse. CC0 waives all
rights and requires no attribution; the source is recorded in the spec anyway.

## Other backgrounds

Grain, mesh, rays, particles, paper, halftone and linen are CSS/SVG-generated
at render time — no image files.

Narration is synthesized per short: Speechmatics (English) and Piper
(MIT-licensed voices, ~50 languages) in the export job.
