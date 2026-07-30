# Scriptorium

**Scripture shorts, in your own language.**

Built for the Gloo × YouVersion *Scripture in New Frontiers* challenge.

---

## The gap

YouVersion serves Scripture as **text** in over a thousand languages. The world's
dominant medium is now **vertical video** — and in most of those languages there is
essentially none of it, because making a good short takes a designer, a voice, and an
editor that a volunteer church does not have.

Scriptorium removes all three. Type a reference or a feeling — or paste your own
sermon, drop in a YouTube link, upload a PDF, or ask for a whole multi-day series —
pick a lens and a language, and about a minute later you have a publishable
1080×1920 short: narrated, word-synced captions, real motion design, your colors and
type — with the verse's provenance carried in the gallery manifest.

Every short is six pages. Five sentences of teaching, one per page, shown one at a
time so nothing ever overlaps. Then the verse itself.

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
crossed with one-click **8 palettes × 4 font pairs × 3 sizes × 38
backgrounds** (8 CSS-generated, 10 hand-drawn doodle frames, 18 licensed image
backgrounds, and 2 licensed **animated video loops**), plus 8 text motions and
**9 music beds**. Theme choices bake in as CSS custom properties, so the
browser preview and the MP4 export consume byte-identical HTML.

**Nothing that ships in a short requires a credit to travel with it.** That is
stricter than "correctly licensed", and it is the point: a short is made to be
reposted by people who will never see a CREDITS file, so an asset whose
licence depends on attribution surviving that repost will eventually be used
in breach by a volunteer acting in good faith. The NASA photo backgrounds and
the four CC-BY music beds were removed on that reasoning rather than kept with
an obligation attached. Credits still travel in the gallery manifest, as
provenance rather than a condition.

Every animation obeys the HyperFrames determinism contract: one paused GSAP
timeline built synchronously, seeded randomness only, transform/opacity/filter
tweens, seek-safe at any frame — which is exactly what lets the renderer
capture frames by seeking.

## Visuals (V2)

Creators choose **Text only** or **Text + pictures**, and pictures come from
one of two sources.

**Free graphics** — a 68-piece licensed full-colour clipart library (placed
small, in its own colours) backed by ~150 vendored icons (lucide, ISC) matched
by keyword to the narration, plus CC0 photos from Openverse. Each teaching
lens carries its own dramatic choreography: hooks **blast** in, analogies
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

**Gloo** writes every teaching, on `gloo-anthropic-claude-haiku-4.5`, and is used
for what only Gloo does: `tradition` values-alignment (a Catholic parish and a
Pentecostal youth group need different emphases from the same verse) and
`auto_routing`, whose tier and confidence are recorded per short.

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
| `npm run smoke:voice` | Live Speechmatics TTS → ASR → alignment round trip |
| `npm run audit:languages` | Re-audit language coverage against the live API |
| `npm run samples` / `npm run gallery` | Generate specs through the real pipeline, render them into `/public/gallery` |
| `npm run render -- --spec <file>` | Render one spec to MP4 through the verse re-fetch gate |
| `npm run render:sandbox -- --request <file>` | Same render, inside a Vercel Sandbox microVM, log streamed |

Without a YouVersion key the app serves clearly-labelled offline sample passages —
it never asks a model for verse text.

## Licence

Apache-2.0. Asset licences are recorded in `assets/CREDITS.md`.
