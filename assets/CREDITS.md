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

## Backgrounds, doodles, music

All background treatments (grain, mesh, rays, particles) are CSS-generated at
render time — there are no image or texture files. No music beds ship in this
build; narration is synthesized per short via Speechmatics.
