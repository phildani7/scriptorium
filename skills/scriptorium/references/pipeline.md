# The pipeline, stage by stage

Every input path converges on the same rule: models return **references**;
verse text is fetched from YouVersion afterwards. A pasted sermon, an uploaded
PDF, a linked article, a planned series — none of them can put a generated word
on screen as Scripture.

```
input ──▶ /api/resolve   YouVersion    reference or topic ──▶ passage (verbatim)
      ──▶ /api/extract   Gloo AI       your text/PDF/article ──▶ teachings (references only)
      ──▶ /api/series    Gloo AI       theme + days ──▶ planned series (references only)
      ──▶ /api/generate  Gloo AI       passage ──▶ 3-7 teaching devices
      ──▶ /api/compose   Speechmatics  narration + word timings ──▶ ShortSpec
      ──▶ /api/preview   HyperFrames   ShortSpec + theme ──▶ composition HTML
      ──▶ /api/export    GitHub Actions ─or─ Vercel Sandbox ──▶ MP4 ──▶ /gallery
      ──▶ /api/mcp       MCP           the whole pipeline as 8 stateless tools
```

## resolve — the only source of Scripture

Takes a reference (`John 3:16`) or a topic (`anxiety at work`). A topic is sent
to the model, which answers with **references**; those references are then
resolved against the YouVersion Platform API and the text comes back from
there. The model never supplies a verse.

Off-topic input is declined politely rather than answered. A decline is a
normal, successful response — check `declined` before treating an empty
candidate list as an error.

## generate — the teaching, and only the teaching

The model writes the device line and the explanation that surround the verse.
The explanation is split into **exactly five sentences** upstream, and each
sentence becomes one page of the short: shown alone, held for as long as the
narrator is speaking it, cut hard when the next begins. The sixth page is the
verse itself.

Page boundaries come from the script's own sentence segments rather than a word
count, so a page turns exactly when the voice finishes a sentence.

## compose — narration, timing, and the gate

Speechmatics does two jobs. TTS produces the narration; batch transcription
produces per-word timings. The transcript's **words are discarded** — ASR
supplies only a clock, and captions are rendered from the verified script. ASR
reliably hears "he" where the text says "He", and displaying that under a verse
would look like altered Scripture.

Non-English narration is synthesized inside the export job by Piper (MIT
voices), because a serverless function cannot run the model. The preview plays
silently and says so; the exported MP4 is narrated.

The verbatim gate runs here, and again at render.

## preview — the same HTML the renderer captures

Theme choices bake in as CSS custom properties, so the browser preview and the
MP4 export consume byte-identical HTML. The preview cannot flatter the export.

Compositions are frozen HyperFrames pages: one paused GSAP timeline built
synchronously, seeded randomness only, transform/opacity/filter tweens,
seek-safe at any frame — which is exactly what lets the renderer capture frames
by seeking.

## export — two cloud renderers, kept alive side by side

Both run the same job through the same integrity gate:

- **GitHub Actions** (default) — a `repository_dispatch` starts the render
  workflow. Free minutes on a public repo; Chrome and Python preinstalled;
  Piper voice models cached between runs.
- **Vercel Sandbox** (alternate) — a `node24` microVM created from the public
  repo, running the job detached so the 60-second function returns immediately.

Either way the runner **re-synthesizes narration from its own secrets and
re-fetches the passage from YouVersion**. The gate refuses to render a tampered
spec. Losing one backend leaves the product fully alive.

## The gate, precisely

`render/render.ts` does this in order, and the order is the whole guarantee:

1. bake the spec into the frozen template
2. **re-fetch the passage from YouVersion, independently of the spec**
3. open the baked page in a real browser
4. read the verse back **out of the DOM** and diff it against that fresh fetch
5. only then capture frames

Step 2 is not redundant. The spec is precisely the artifact a bug or a careless
edit would modify, and comparing a file against itself always passes. The gate
fails **closed**: no app key, no network, or a passage that no longer resolves
all refuse the render rather than falling back to the spec.

The comparison is NFC-normalized, because Devanagari matras and Tamil vowel
signs have multiple valid encodings and a browser text node may hand back a
different one than the API did. It deliberately does **not** strip U+200C ZWNJ
or U+200D ZWJ: in Devanagari, Bengali and Tamil those control conjunct
formation and are part of the text's meaning. Removing them to make a diff pass
would defeat the check on exactly the languages this exists to serve.
