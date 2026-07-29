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

## Music (CC BY 4.0, /public/music, pre-attenuated + faded at import)

All by **Kevin MacLeod (incompetech.com)**, Creative Commons: By Attribution
4.0 — https://creativecommons.org/licenses/by/4.0/. The credit travels with
every gallery entry that uses a track.

| File | Track |
| --- | --- |
| `meditation.mp3` | Meditation Impromptu 01 |
| `at-rest.mp3` | At Rest |
| `heartbreaking.mp3` | Heartbreaking |
| `wounded.mp3` | Wounded |

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

## Photo backgrounds (public domain, /public/backgrounds)

NASA imagery is not subject to copyright. Normalized to 1080×1920 at import.

| File | Source |
| --- | --- |
| `starfield.jpg` | Hubble Ultra Deep Field (NASA/ESA), via Wikimedia Commons |
| `pillars.jpg` | Pillars of Creation, HST WFC3 (NASA/ESA), via Wikimedia Commons |
| `earth.jpg` | The Blue Marble, Apollo 17 (NASA), via Wikimedia Commons |

## Licensed stock art (creator-licensed, no attribution required)

The video background loops (`/public/backgrounds/video`), the full-bleed
image backgrounds (`/public/backgrounds/img`), and the full-colour clipart
library (`/public/cliparts`) are stock assets licensed to the project
creator. The licence covers use in produced video and **requires no
attribution**. All were normalized at import with ffmpeg: videos to
1080×1920 muted ~60 s loops, image backgrounds to 1080×1920 crops, cliparts
downscaled to a 512 px bounding box with alpha preserved.

## Other backgrounds

Grain, mesh, rays, particles, paper, halftone and linen are CSS/SVG-generated
at render time — no image files.

Narration is synthesized per short: Speechmatics (English) and Piper
(MIT-licensed voices, ~50 languages) in the export job.
