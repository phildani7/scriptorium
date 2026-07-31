---
name: scriptorium
description: Use when producing Scripture short-form video — a narrated, word-synced 1080x1920 vertical short from a Bible reference, a topic, a sermon, an article, or a multi-day series plan, in any of 40 languages. Drives the Scriptorium MCP server end to end. Also use when asked about retrieved-never-generated Scripture handling, the verbatim integrity gate, or the Scriptorium studio's customization surface.
---

# Scriptorium

Turn a Bible reference or a topic into a finished vertical short: narrated in a
real voice, captioned word by word, set in the language's own script, rendered
to MP4 at 1080x1920.

Everything the studio screen can do is reachable headlessly through one
stateless MCP endpoint, so an agent, a script, or a cron job can drive the
whole pipeline.

## The one rule

**Scripture is retrieved, never generated.**

Verse text always comes verbatim from the YouVersion Platform API. The model
writes only the teaching *around* the verse. Every tool here obeys that,
because each is a thin wrapper over the same API route the studio calls —
there is no path through this server where a model's words become Scripture.

Before a single frame is captured, the rendered verse node is NFC-normalized
and diffed against a **fresh** API response. A mismatch fails the render rather
than shipping. If you are writing a prompt that touches a passage, do not ask a
model to quote, translate, modernise, correct or re-punctuate it. Ask for a
reference; fetch the text.

## Connect

```
POST https://scriptorium-gamma-wheat.vercel.app/api/mcp
```

Streamable HTTP, stateless: no sessions, no stored context, no SSE stream to
hold open. Each request builds a server, answers in plain JSON, and discards
it. A `GET` on the same address returns the server descriptor and the tool
list, which is the quickest way to confirm a deployment is live before wiring a
client to it.

Claude Code:

```bash
claude mcp add --transport http scriptorium \
  https://scriptorium-gamma-wheat.vercel.app/api/mcp
```

Any other MCP client: point it at the same URL with the streamable-HTTP
transport. There is nothing to authenticate and no session id to carry.

## The tools

| Tool | Takes | Gives back |
| --- | --- | --- |
| `resolve_passage` | a reference or a topic | candidate passages, verbatim |
| `list_versions` | a language code | the Bible versions licensed for it |
| `generate_devices` | a passage + a lens | 3-7 teaching devices |
| `extract_teachings` | your own sermon or article | teachings, **references only** |
| `plan_series` | a theme + a day count | a planned arc, references only |
| `create_short` | everything above, in one call | a verified short + a queued MP4 |
| `list_options` | — | every palette, face, size, background, motion, music bed |
| `gallery` | — | the shorts that have already rendered |

## The shortest useful path

One call produces a finished short and queues its export:

```json
{
  "name": "create_short",
  "arguments": {
    "input": "Psalm 23",
    "lens": "analogy",
    "languageCode": "en",
    "style": "warm-minimal",
    "visualMode": "ai"
  }
}
```

It returns the narration script, the duration, the verification message, and
the export job. Read `verified` and `verification` before you present the
result as finished: they are the gate's own words about this specific short.

## When to take the long path instead

`create_short` picks `devices[0]`. A creator picks. So when the *teaching*
matters — which is most of the time — resolve, generate, look at the options,
and compose the one that is actually good:

1. `resolve_passage` → choose a candidate
2. `generate_devices` → read all of them, choose a device
3. `create_short` with `deviceIndex` set to the one you chose

The devices differ in kind, not just in wording. Asked to illustrate the
prodigal son, one may reach for a father running down a road and another for a
parent waiting in a driveway. Both are good. They are not interchangeable, and
nothing downstream can tell them apart.

## Choosing the arguments

**`lens`** — how the teaching approaches the verse.
`hook` (an opener that makes someone need this passage) · `analogy` (a picture
from ordinary life, with its limits named) · `punch-line` (one sentence that
compresses the tension) · `illustration` (a short true-to-life scenario) ·
`object-lesson` (something you can hold up and show) · `summary` (the passage
distilled).

**`style`** — the frozen visual treatment.
`warm-minimal` (editorial calm, serif, whitespace) · `kinetic-type` (poster
type landing word by word on the measured voice) · `neon-night` (dark glow,
drifting particles, a flare at the turn).

**`visualMode`** —
`text` (type only) · `free` (curated clipart and icons, keyword-matched to the
narration) · `ai` (one hand-drawn doodle panel fills the frame; a shipped panel
when one honestly fits the teaching, a generation only when none does).

**`tone`** — `conversational` · `formal` · `liturgical`.
**`ageGroup`** — `kids` · `youth` · `adult`.

**`theme`** — optional, and every field is optional inside it: `paletteId`,
`fontId`, `sizeId`, `backgroundId`, `textStyleId`, `musicId`, `captions`.
Call `list_options` for the current ids rather than guessing; the background
library alone runs to 69 entries including 34 animated loops.

## Languages

40 languages are licensed against this deployment; 33 are complete, meaning a
Bible **and** a neural voice **and** word timing measured from the audio.
`resolve_passage` and `generate_devices` both take `languageCode`, and the
teaching comes back in that language, not translated into it afterwards.

Every script in the registry has a self-hosted face — Devanagari, Bengali,
Telugu, Tamil, Malayalam, Thai, Hebrew, Arabic, Urdu, Han, Hangul, Georgian,
Armenian, Cyrillic, Greek, Latin — so a short renders identically in the
browser and in the headless Chrome that captures the MP4.

For a language with no measured timing, the studio lays out an estimated
timeline and says so; check `timingSource` if that distinction matters to you.

## Reading the results

- `verified` / `verification` — the integrity gate's verdict on this short.
- `timingSource` — `speechmatics` (measured from audio) or `estimated`.
- `export` — the queued render job, or a note that no backend is configured.

A short whose teaching was written by the Claude fallback rather than Gloo
carries none of Gloo's values alignment. `/api/status` reports which engine
answered. If you are producing on someone's behalf, pass that on.

## What not to do

- Do not ask a model for verse text, in any language, for any reason.
- Do not present an unverified short as verified. The gate's message is the
  authority, not the absence of an error.
- Do not paste a YouTube link into `extract_teachings`. It is refused on
  purpose: YouTube declines caption requests from datacenter IPs, so the
  request cannot succeed. Paste the transcript instead.
- Do not invent option ids. `list_options` is one cheap call.

## Deeper reference

- `references/pipeline.md` — every stage, and what each one guarantees
- `references/recipes.md` — worked multi-call examples
