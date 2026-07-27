# Text motion styles — design

Date: 2026-07-27 · Status: approved (verbally, in session)

## What

A one-click **text motion** theme option — like palettes and backgrounds — that
changes how stage text *enters*: the device line, the teaching words, and the
verse/citation panel. Captions keep their legibility-first hard cuts. Each
template keeps its own clock (kinetic words still land on the voice) and its
seam transitions; the style swaps only the entry recipe: `from` state, ease,
settle.

## The set

`TEXT_STYLES` in `src/lib/theme/options.ts`, same frozen-set pattern as
palettes:

| id | entry motion |
| --- | --- |
| `signature` (default) | the template's designed move — zero change for existing specs |
| `floating` | rise from below with soft blur, gentle decelerate |
| `dropping` | fall from above, `back.out` settle |
| `sliding` | slide in from the side, sign flips for RTL |
| `pop` | scale up from 0.6 with a snap |
| `typewriter` | appear in place, no motion — safest for complex scripts |
| `flip` | rotateX flap-board entry (`transformPerspective` per element) |
| `blur-focus` | start large and blurred, rack into focus |

## Plumbing

Exactly the background pattern:

- `ShortTheme.textStyleId` → `themeAttributes()` returns the resolved id
- `bake.ts` stamps `data-anim="<id>"` on the composition root
- each template holds a small inline recipe map keyed by that attribute and
  uses it wherever it animates stage text; block panels use the recipe
  without stagger; `signature` (or an unknown id) falls through to the
  template's existing tween values
- ThemePanel gets a "Text motion" row

## Determinism

Every recipe is transform/opacity/filter only, tweens on the one paused
timeline, seek-safe. Preview and MP4 stay byte-identical.

## Rejected alternatives

- CSS keyframe classes: a second animation system that must stay in sync with
  GSAP seeking.
- Shared vendored JS module: adds a bundle dependency to deliberately
  self-contained templates to save ~30 duplicated lines.

## Testing

- Unit: `data-anim` lands on the baked root; `resolveTheme`/`themeAttributes`
  default to `signature`.
- Visual: screenshot harness across styles × templates before commit.
