# Pipeline audit — 2026-08-01

A read-only detective pass over the pipeline, looking for defects rather than
style. Ordered by importance. Nothing in here has been changed.

**Read this first:** the headline claim holds. I specifically tried to break the
integrity gate and could not. `render/render.ts:267` fails closed when the
passage cannot be re-fetched, `:283` refuses when the spec disagrees with the
live API, `:336` refuses when the DOM disagrees, and the teaching-format branch
at `:320` inverts the check so an empty verse node cannot be quietly filled.
The `[data-verse-text]` node is populated synchronously during parse, so the
`waitUntil: 'load'` read at `:298` is not racing anything. That part is sound.

What follows is everything else.

Severity is about what a viewer or a judge would actually experience:
**High** = ships something wrong or drops content silently.
**Medium** = wrong under a plausible input, or degrades quietly.
**Low** = fragile, latent, or cosmetic.

---

## 1. HIGH — the export can silently drop the verse page

`src/app/api/export/route.ts:96`

```ts
const speakVerse =
  Array.isArray(specSegments) &&
  specSegments.some((s) => s.kind === 'verse') &&
  Boolean((spec.device as { explanation?: string } | undefined)?.explanation);
```

`speakVerse` is re-derived at export instead of being carried on the spec, and
it is gated on `device.explanation` being non-empty. The runner then does:

`scripts/render-request.ts:143` — `includeVerse: Boolean(request.speakVerse)`

whereas the preview did `includeVerse: body.speakVerse ?? true`
(`src/app/api/compose/route.ts:97`), and `buildNarrationScript` itself defaults
`includeVerse = true` (`src/lib/script/build.ts:45`).

**Failure:** a short whose device has `content` but no `explanation` previews
*with* the verse page and exports *without* it. The verse is the sixth page and
the point of the short; it would vanish from the MP4 while the studio showed it.

**How reachable:** narrower than it first looks. `src/lib/ai/provider.ts:161`
lists `explanation` as required and `:409` rejects a device whose explanation is
empty, so Gloo-generated devices are safe. But `/api/compose` validates only
`device?.content` (`route.ts:73`), so any caller that hand-builds a device —
the MCP `create_short` tool, a script, a future input path — can walk straight
into it. The two sides also disagree about the *default*: one says "verse unless
told otherwise", the other says "no verse unless told so".

**Worth noting:** this is the exact class of failure the project says it does not
have — the preview flattering the export. Everything else about that contract is
carefully enforced; this one flag escaped it.

**Direction:** carry `speakVerse` explicitly on the spec at compose time and have
export copy it through, rather than reconstructing it from two proxies. The
`explanation` term looks like it is standing in for "is this doc-sourced", which
is a different question than "should the verse be shown".

---

## 2. HIGH — preview and export disagree on length for long non-English shorts

`src/lib/voice/align.ts:63` — `Math.max(15, Math.min(90, words / 2.6))`

For any voice that is not Speechmatics (i.e. every non-English short, which is
most of the catalogue), `/api/compose` cannot synthesize audio server-side, so
it *estimates* duration and clamps it to **90 s**. The runner synthesizes real
Piper audio and measures it (`render-request.ts:178`), with no clamp.

**Failure:** a script the estimator puts past 90 s previews at 90 s and exports
at its true length. The header comment records this exact bug being fixed once
already — the ceiling was raised from 45 s to 90 s because 45 was "clamping
almost every non-English short". The clamp was raised, not removed, so the same
failure mode still exists one bracket higher.

**How close is it:** the six-page format is documented as 150–190 words → 58–73 s,
but live gallery entries already run **77 s and 81 s**. Add a long passage
(Jeremiah 17:5-8 is in there at 81 s) and 90 s is not comfortably far away.

**Direction:** either drop the ceiling entirely and let the estimate run long, or
make the preview declare that its timeline is an estimate for Piper languages
(the UI already surfaces "no voice yet" marks, so there is a place for it).

---

## 3. MEDIUM — concurrent render jobs will lose gallery entries

`scripts/render-request.ts:294-317`

```ts
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : [];
const next = [entry, ...manifest.filter((m) => m.id !== id)];
writeFileSync(manifestPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
```

Unguarded read-modify-write. Two render jobs finishing near each other each read
the manifest, each append their own entry, and the second write erases the
first's. Since the job also commits the manifest to git, the visible symptom is
either a lost gallery entry or a merge conflict on a generated file — neither of
which points at this line.

Single-job-at-a-time hides it today. Any parallelism (an Actions matrix, two
exports queued together) exposes it.

---

## 4. MEDIUM — `--t-photo` skips the CSS escaping that `--t-art` gets

`src/lib/render/bake.ts:82-84` vs `:100`

```ts
if (attrs.photoSrc) style += `; --t-photo: url('${rebase(attrs.photoSrc)}')`;   // raw
...
style += `; --t-art: url('${cssUrl(rebase(art.src))}')`;                        // escaped
```

`cssUrl` exists precisely because "a quote or a paren here would break out of the
CSS function and into the attribute" — its own doc comment says so, and says
"ours is not an argument". The photo path is then handed the same treatment the
comment argues against. `escapeAttr` afterwards escapes `"` but **not** `'`, and
the URL is wrapped in single quotes, so it does not cover this.

`attrs.doodleData` at `:88` is interpolated raw as well. Both are currently
shipped assets with tame filenames, so nothing is broken today — this is an
inconsistency that will bite whenever a background arrives from somewhere less
controlled, which is exactly the direction the visuals system has been moving.

---

## 5. MEDIUM — the bake regexes depend on attribute order and only replace once

`src/lib/render/bake.ts:61`

```ts
/(class="clip"\s+data-start="0"\s+)data-duration="[^"]*"/
```

Requires `class` → `data-start` → `data-duration` in that exact order, separated
only by whitespace, and being non-global it rewrites only the **first** match.

Verified all three templates currently have exactly one `.clip` with the
attributes in the expected order, so this works today. The reason it is worth
recording is the failure mode, which the comment above it already describes from
experience: a missed replace does not error, it leaves the template's static 30 s
and "a 33-second short goes blank for its last three seconds while nothing
errors". A second track, or a formatter reordering attributes, silently
reintroduces that.

The same shape applies to the `#bg-video-holder` removal at `:127`
(`[\s\S]*?</div>` stops at the first `</div>`, so a nested element inside the
holder would truncate the markup).

---

## 6. LOW — spec id and gallery id can diverge

`src/app/api/compose/route.ts:208` builds `short-${passage.usfm}-${style}-…`
with no sanitisation; `scripts/render-request.ts:137` then does
`.replace(/[^\w.-]/g, '-')` before it becomes a filename and a manifest key.

So for any USFM containing a character outside `[\w.-]`, the id in the spec is
not the id in the gallery. Underscores survive (`JHN.1_1.1` in the live manifest
is real), so nothing is broken now, but the id stops being a reliable join key
between spec and gallery the moment a reference has a colon or a space —
and USFM handling has already needed one underscore-remapping fix.

---

## 7. LOW — WAV duration returns 0 if `fmt ` follows `data`

`src/lib/voice/align.ts:379-380`

`byteRate` is captured when the `fmt ` chunk is walked; the `data` branch bails
with `return 0` if `byteRate` is still unset. Legal-but-unusual WAVs that place
`data` first therefore report zero duration.

Everything upstream produces conventional WAVs, and the surrounding code is
otherwise unusually careful — the `0xFFFFFFFF` placeholder handling and the
`+16` byte-rate offset (with its comment about `+12` silently doubling every
duration) are both correct and both non-obvious. Noting the ordering case only
for completeness.

---

## 8. LOW — the aligner's desync fallback is a coin flip

`src/lib/voice/align.ts:140-141`

```ts
t += 1;
if (t % 2 === 0) a += 1;
```

When no resynchronisation point is found inside the 5-word window, the script
pointer advances every iteration and the ASR pointer every other one. That is a
deliberate bias toward "ASR dropped a word", which the comment states, but it is
a fixed 2:1 ratio rather than anything derived from the streams — a long
mismatched run drifts and then cannot recover, because the window is relative to
positions that are now far apart.

Consequence is bounded and honest: unmatched words get interpolated timings and
`matchRate` reports it, and `timingSource` downgrades to `estimated` below 0.5
(`render-request.ts:185`). Caption *accuracy* is never at risk because the text
always comes from the script. So this is a precision issue, not a correctness
one — recorded because it is the kind of thing that looks fine until a language
with heavy ASR disagreement shows up.

---

## Checked and found sound

Worth stating explicitly, since absence of a finding is easy to misread as
absence of a check:

- **The integrity gate** — fails closed on no key, no network, spec tampering,
  and DOM mismatch; teaching format inverts correctly. No bypass found.
- **Video background looping** — `loop` present and identical in all three
  templates; the runtime wraps `currentTime` modulo clip duration
  (`hyperframe-runtime.js`), so 4.25 s loops repeat correctly under 60 s+ shorts.
  The one conditional is that `sourceDuration` must be known at capture;
  `preload="auto"` covers it.
- **Silent-MP4 guard** — `render-request.ts:207-219` refuses to publish when the
  registry promised a voice and synthesis failed. This is the right call and the
  comment documents the Mandarin short that forced it.
- **Rate limiting** — in-memory and therefore per-instance, but disclosed as a
  speed bump in its own header rather than overclaimed.
- **Spec JSON injection** — `</` escaped at `bake.ts:161` before going into the
  inline `<script>`.
- **Duration at export** — genuinely re-measured from synthesized audio, not
  trusted from the spec (this is what makes finding #2 preview-only).

---

## Suggested order if any of this gets fixed

1. **#1** — smallest change, worst symptom, and it contradicts the project's
   central promise. Carry `speakVerse` on the spec.
2. **#3** — cheap to make safe and gets worse the moment throughput increases.
3. **#2** — needs a product decision (drop the clamp, or label the preview),
   not just a patch.
4. **#4**, **#5** — hardening; no current failure, clear future one.
5. **#6**, **#7**, **#8** — record and move on.

None of these block the competition submission. #1 is the only one I would want
fixed before this codebase gets real users, and even it requires a device
without an explanation to trigger.
