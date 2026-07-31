# Scriptorium

**Scripture shorts, in your own language.**

A submission by **Dr. Philemon Paul Daniel** to *Scripture in New Frontiers*,
the Kaggle competition run by **Gloo** and **YouVersion**.

---

## The gap

YouVersion serves Scripture as **text** in over a thousand languages. The world's
dominant medium is now **vertical video** — and in most of those languages there is
essentially none of it, because making a good short takes a designer, a voice, and an
editor that a volunteer church does not have.

Scriptorium supplies all three. Type a reference or a topic, paste your own sermon,
drop in an article link, upload a PDF, or ask for a whole multi-day series; pick a
lens and a language; and about a minute later you have a publishable 1080×1920
short: narrated in a real voice, captioned word by word, set in your own script,
with real motion design and your own colours and type, and the verse's provenance
carried in the gallery manifest.

Every short is six pages. Five sentences of teaching, one per page, shown one at a
time so nothing ever overlaps. Then the verse itself.

## The architectural claim

**Scripture is retrieved, never generated — and the build proves it.**

Verse text comes verbatim from the YouVersion Platform API and is never touched. The
model writes only the teaching device around it. Before a frame is captured, the
rendered verse node is NFC-normalized and diffed against a fresh API response; a
mismatch **fails the build** rather than shipping.

You can see this claim in three places:

- `src/lib/verify/verbatim.ts` — the gate, dependency-free so it is trivially auditable
- `src/lib/verify/verbatim.test.ts` — 13 tests, including a single dropped Devanagari
  matra (`मुझे` → `मुझ`) and a danda swapped for a period
- The review screen — every field is editable except the verse, which is **locked**

## Architecture

```
input ──▶ /api/resolve   YouVersion    reference or topic ──▶ passage (verbatim)
      ──▶ /api/extract   Gloo AI       your text/PDF/article ──▶ teachings (references only)
      ──▶ /api/series    Gloo AI       theme + days ──▶ planned series (references only)
      ──▶ /api/generate  Gloo AI       passage ──▶ 3-7 teaching devices
      ──▶ review gate    human         verse locked; or Auto mode skips review
      ──▶ /api/compose   Speechmatics  narration + word timings ──▶ ShortSpec
      ──▶ /api/preview   HyperFrames   ShortSpec + theme ──▶ composition HTML
      ──▶ /api/export    GitHub Actions ─or─ Vercel Sandbox ──▶ MP4 ──▶ /gallery
      ──▶ /api/mcp       MCP           the whole pipeline as 8 stateless tools
```

Every input path converges on the same rule: models only ever return
**references**; verse text is always fetched from YouVersion afterwards. A
pasted sermon, an uploaded PDF, a linked article, a planned series — none of
them can put a single generated word on screen as Scripture.

## Start from anything

Five ways in, one pipeline out:

- **Topic or verse** — `Psalm 23`, `anxiety at work`
- **Your own text** — paste a sermon or article, or upload a `.txt` / `.pdf`;
  its teachings are mined and each anchored to a passage (`/api/extract`, MIT
  `unpdf` for PDFs)
- **A link** — paste an article, blog post, devotional or PDF URL and its
  prose is read (a small readability pass, no key, no quota). Mined exactly
  like a pasted sermon, so the verse still comes from YouVersion, never from
  the page. **YouTube links are not supported**, and the studio says so the
  moment one is pasted rather than after a request that cannot succeed:
  YouTube refuses caption requests from datacenter IPs, which is where this
  app runs. The fix is the transcript (⋯ → Show transcript → paste into *From
  your text*), which takes about fifteen seconds
- **A series** — a theme and 3/5/7/14 days become a planned arc of passages
  and lenses, each day one click from a finished short (`/api/series`)
- **The gallery** — search + filter by language/lens/style, and share any
  short to WhatsApp, Telegram, or X

## Six pages

The teaching arrives as **exactly five sentences**, and each sentence is one
page: shown alone, held for as long as the narrator is speaking it, cut hard
when the next begins. The sixth page is the verse itself, retrieved and
verified. Page boundaries come from the script's own sentence segments rather
than a word count, so a page turns exactly when the voice finishes a sentence
— and the handoff uses `autoAlpha`, so "one sentence at a time" is a property
of the timeline rather than something the eases have to avoid violating.

Captions are unaffected: the word-synced rail runs continuously underneath,
as it always has.

Six teaching lenses (hook, analogy, punch-line, illustration, object lesson,
**summary**), three audiences, three cultural tones (everyday / formal /
liturgical), and a **Bible version picker** for languages where more than one
translation is licensed.

## Styles, themes, customization

Three frozen HyperFrames styles — **Warm Minimal** (editorial, zoom-through
seam), **Kinetic Type** (poster type landing word-by-word on the measured
voice timings), **Neon Night** (glow, seeded particles, a flare at the turn) —
crossed with one-click **8 palettes × 4 font pairs × 3 sizes × 69
backgrounds** (8 CSS-generated, 10 hand-drawn doodle frames, 17 licensed image
backgrounds, and **34 animated video loops**), plus 8 text motions and
**9 music beds**. Theme choices bake in as CSS custom properties, so the
browser preview and the MP4 export consume byte-identical HTML.

Backgrounds are **picked by looking, not by reading**. Seventy names in a wrap
of chips asked a creator to imagine "Groovy liquid", click, wait for a re-bake
and discover they had imagined it wrong; the picker is now a packed grid of
9:16 thumbnails generated from the assets themselves. The images and video
loops carry no caption because the picture is complete information. The CSS
textures and doodle frames keep theirs — they are whisper-quiet by design and
at tile size they honestly render as near-identical rectangles, and a picture
that cannot be told from its neighbour is not information.

The 32 newest loops arrive as 5-second clips and play under a 40–60 second
short, so each one repeats ten times or more. Their last 0.8 s is cross-faded
over their first, which makes the closing frame and the opening frame the same
picture: the loop closes on itself instead of ticking. Audio is stripped, and
a short's render bundle now carries only the one background it uses rather
than the whole 35 MB library.

**Nothing that ships in a short requires a credit to travel with it.** That is
stricter than "correctly licensed", and it is the point: a short is made to be
reposted by people who will never see a CREDITS file, so an asset whose
licence depends on attribution surviving that repost will eventually be used
in breach by a volunteer acting in good faith. The NASA photo backgrounds and
the four CC-BY music beds were removed on that reasoning rather than kept with
an obligation attached. Credits still travel in the gallery manifest, as
provenance rather than a condition.

## Type that fits, measured rather than guessed

Stage text is set large and broken into short rows of a few words. A row that
ends up holding one word is the vertical beat: the sentence steps down the
frame a word at a time, then picks up its horizontal run again. The rows are
grouped by **measuring** the shaped glyphs, and the block then steps down in
size until it genuinely fits its box.

That replaced a set of character-count buckets ("past 118 characters, drop a
size"). A character count is a proxy for width that knows nothing about which
face is set or which script it is setting, so it was wrong in both directions:
it shrank Devanagari that had room to spare, and it left Latin overflowing at
the largest size — and a block centred in a box it overflows spills equally at
*both* ends, which is how a teaching line came to start above the top of the
frame at Clean + Large.

`npm run check:fit` walks the whole customization grid — 4 faces × 3 sizes ×
3 styles × 3 scripts, 108 configurations — in a real browser, and fails if a
single row of type lands outside 1080×1920. It is slower than a unit test
because measuring real shaped glyphs is the only thing that could have caught
this.

Every animation obeys the HyperFrames determinism contract: one paused GSAP
timeline built synchronously, seeded randomness only, transform/opacity/filter
tweens, seek-safe at any frame — which is exactly what lets the renderer
capture frames by seeking. The fit runs before the timeline is built and
touches only layout, so seeking is unaffected; it runs a second time on
`document.fonts.ready`, because a fallback face's metrics are not the real
ones.

## Visuals (V2)

Creators choose **Text only** or **Text + pictures**, and pictures come from
one of two sources.

**Free graphics** — a 68-piece licensed full-colour clipart library (placed
small, in its own colours) backed by ~150 vendored icons (lucide, ISC) matched
by keyword to the narration. Both libraries ship in the repo, and nothing is
fetched from an open image search: a CC0 stock lookup used to supply a hero
image here and returned, for the word "silence", a watermarked quote card from
a link-farm — correctly licensed and completely wrong. Each teaching lens
carries its own dramatic choreography: hooks **blast** in, analogies
enter as a **split** pair, punch-lines **pop** with a particle burst,
illustrations **waterfall**, object lessons get a **spotlight** hero with a
glow. Every visual is anchored to the second its word is spoken and clears the
frame before the citation.

**AI images** — one hand-drawn doodle fills the whole frame behind all five
sentences, in the shape the format needs: a clean paper band up top for the
sentence, the drawing through the middle, a caption rail across the bottom.
**Reuse before spend**: a 61-panel library of vertical doodle panels ships
with the app, each catalogued with a description, match tags and a *measured*
clean-band height, and a panel that honestly fits the teaching is used as-is —
instant, free, and a known-good frame. Only when nothing fits does
**Grok Imagine** draw a new one in the same style, at the model's lowest tier
(9:16, 720×1280), gated behind `XAI_API_KEY`. Because the panels ship, the
mode is useful with no key at all.

Grok is wired in for **pictures and nothing else** — there is no code path
sending text to xAI. Verse text comes from YouVersion; teaching prose comes
from Gloo. `src/lib/visuals/grok.ts` is one file calling one endpoint, so that
boundary is auditable rather than asserted.

The narration itself stays fully editable on the preview screen right up to
export — only the verse is out of reach.

## Export and gallery — two cloud renderers, kept alive side by side

"Export MP4" hands off to whichever backend is preferred (`RENDER_BACKEND`
env or per-request `backend`); both run the **same** `scripts/render-request.ts`
through the same integrity gate and push the finished MP4 + poster into
`/public/gallery` with the same bot identity:

- **GitHub Actions** (default) — a `repository_dispatch` starts
  `.github/workflows/render.yml`: free minutes on a public repo, Chrome and
  Python preinstalled, Piper voice models cached between runs.
- **Vercel Sandbox** (alternate) — a `node24` microVM is created from the
  public repo (`@vercel/sandbox`), installs Chromium's dnf deps + static
  ffmpeg, runs the job **detached** (the 60-second function returns
  immediately), and halts itself when done. OIDC auth on deployments;
  `npm run render:sandbox -- --request request.json` runs the same job
  attached from a laptop.

Either way the runner re-synthesizes narration from its own secrets and
re-fetches the passage from YouVersion — the gate refuses to render a
tampered spec. When neither backend is configured the studio hands back the
spec for a local `npm run render`. Neither path replaces the other; losing
one leaves the product fully alive.

## MCP — the whole studio as tools

`POST /api/mcp` is a **stateless MCP server** (streamable HTTP, plain JSON,
no sessions — each request builds a fresh server and throws it away). Point
any MCP client at the deployment and drive everything the UI can do:

| Tool | Does |
| --- | --- |
| `resolve_passage` | reference/topic → verbatim YouVersion passages |
| `list_versions` | licensed Bible versions for a language |
| `generate_devices` | passage → 3-7 teaching devices through one lens |
| `extract_teachings` | your source text → teachings, references only |
| `plan_series` | theme + days → a planned series, references only |
| `create_short` | end-to-end: resolve → generate → compose → queue export |
| `list_options` / `gallery` | every customization; the rendered shorts |

Every tool is a thin wrapper over the same API routes, so the
retrieved-never-generated rule holds for agents exactly as it does for humans.

### Agent Skills

An MCP server tells an agent what it *can* call. It does not tell it which lens
suits a passage, that the five teaching sentences are five pages, or why it
must never ask a model for a verse. That is what the skill pack carries.

**[Download `scriptorium-skills.zip`](public/downloads/scriptorium-skills.zip)**
— `SKILL.md`, a pipeline reference, and worked multi-call recipes. Unzip into
your agent's skills directory and point the client at `/api/mcp`.

```bash
claude mcp add --transport http scriptorium \
  https://scriptorium-gamma-wheat.vercel.app/api/mcp
```

The zip is committed so it downloads from the repo tree and from the deployed
site (`/downloads/scriptorium-skills.zip`) as the same file, and it is packed
from `skills/` by `npm run skills:pack` rather than by hand — a download nobody
can regenerate is a download that ends up describing a version of the product
that no longer exists.

## Stack

| | |
| --- | --- |
| **HyperFrames** | the render framework: frozen HTML compositions captured to MP4 by seeking a paused timeline |
| **GSAP** | every animation — transform/opacity/filter only, seek-safe at any frame |
| **Next.js 16 · React 19** | App Router, TypeScript, Tailwind v4, deployed on Vercel |
| **YouVersion Platform API** | every word of Scripture, retrieved and verified |
| **Gloo AI Studio** | the teaching, on `gloo-anthropic-claude-haiku-4.5`, with Claude live behind it |
| **Speechmatics** | narration, plus the word timings the captions ride |
| **Piper** | MIT neural voices for ~50 languages, synthesized inside the export job |
| **Grok Imagine** | pictures, and nothing else — no text path reaches xAI |
| **Playwright · FFmpeg** | frame capture and encode, on GitHub Actions or a Vercel Sandbox microVM |
| **MCP** | the whole studio as eight stateless tools |

Fonts are 16 self-hosted OFL families, one per script in the registry.

**Gloo** writes every teaching, on `gloo-anthropic-claude-haiku-4.5`, and is used
for what only Gloo does: `tradition` values-alignment, so a short can be aimed at
the tradition and the audience it is actually for, and `auto_routing`, whose tier
and confidence are recorded per short.

Claude stands behind it as a **live** fallback, not merely a configured one.
The distinction matters: Gloo runs on a prepaid balance, so the realistic
failure is not "no credentials" — that is decided at boot — but "credit
exhausted" or "rate limited", which arrive mid-request in front of whoever is
watching. `src/lib/ai/resilient.ts` retries the same call on Claude and records
the substitution, which `/api/status` then shows, because a short generated on
the fallback carries none of Gloo's values alignment and the creator is
entitled to know which engine wrote their teaching. Aborts are never retried —
a cancelled request should not spend money on an answer nobody wants.

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

**Every script in the registry has a self-hosted face.** Naming a font stack is
not shipping one: until `npm run fonts:fetch` existed, only Devanagari had files
on disk, and Telugu, Tamil, Malayalam, Bengali, Hebrew, Arabic, Urdu, Thai, Han,
Hangul, Georgian and Armenian all resolved to whatever the machine happened to
have. On a developer's Windows box that is Nirmala UI and the page looks fine;
in the headless Chrome that captures the MP4 there is no such fallback and the
text comes out blank. A tool whose whole claim is "Scripture in your own
language" cannot leave that to the host. Sixteen OFL families now ship, and the
render bundler copies only the script a given short is set in — the CJK families
alone are 19 MB, and a Telugu short has no use for 124 Japanese subsets.

## Live

- **App**: https://scriptorium-gamma-wheat.vercel.app
- **Gallery**: https://scriptorium-gamma-wheat.vercel.app/gallery — reads the repo's
  manifest live, so exported shorts appear as their render jobs push
- **MCP**: https://scriptorium-gamma-wheat.vercel.app/api/mcp (streamable HTTP, stateless)
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
| `npm run check:fit` | 108 theme × style × script combinations; fails on any type that overflows |
| `npm run shots` | Screenshots every template at every page boundary, into `.render-tmp/shots` |
| `npm run smoke:mcp` | Speaks the MCP protocol to a running deployment and calls the tools |
| `npm run fonts:fetch` | Re-download the self-hosted face for every script in the registry |
| `npm run skills:pack` | Rebuild the downloadable Agent Skills zip from `skills/` |
| `npm run smoke:voice` | Live Speechmatics TTS → ASR → alignment round trip |
| `npm run audit:languages` | Re-audit language coverage against the live API |
| `npm run samples` / `npm run gallery` | Generate specs through the real pipeline, render them into `/public/gallery` |
| `npm run render -- --spec <file>` | Render one spec to MP4 through the verse re-fetch gate |
| `npm run render:sandbox -- --request <file>` | Same render, inside a Vercel Sandbox microVM, log streamed |

Without a YouVersion key the app serves clearly-labelled offline sample passages —
it never asks a model for verse text.

## Licence

The source code is licensed under the **Apache License, Version 2.0** — the full
text is in [`LICENSE`](LICENSE), and attribution plus scope notes are in
[`NOTICE`](NOTICE).

Bundled third-party assets (fonts, music beds, illustration sets, motion
runtimes) carry their own licences, each recorded with its source in
[`assets/CREDITS.md`](assets/CREDITS.md). Nothing bundled here is paid or
licence-ambiguous.

Scripture text is **not redistributed**. It is fetched at run time from the
YouVersion Platform API and stays under its publisher's copyright, which is
carried through to every rendered short and its gallery manifest entry.
