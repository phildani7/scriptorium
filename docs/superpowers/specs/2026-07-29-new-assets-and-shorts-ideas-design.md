# New assets + shorts ideas — design (implemented 2026-07-29)

Goal (from the creator): fold `A:\CC\Kaggle26_YouGloo\New_Assets` into
Scriptorium (all creator-licensed, no attribution required), make video
backgrounds and audio selectable, auto-use the cliparts/pics at full colour
scaled down, implement the shorts-relevant ideas from `enhanced_plan.txt`
(text/PDF-output ideas explicitly skipped), accept PDF / text / pasted text as
a teaching source, and add a "summary" teaching type.

## Assets (imported with ffmpeg, one-off)

- **Music** — 9 Audiio WAVs → 60 s mp3 beds in `/public/music`, leveled to the
  existing beds (max ≈ −18 dB), 1.5 s fade-in / 3 s fade-out. Selectable in the
  existing Music group; credits carry "Audiio license".
- **Video backgrounds** — 2 loops → 1080×1920 muted ~60 s H.264 in
  `/public/backgrounds/video` (`still-waters`, `forest-path`). New
  `BackgroundOption` kind `'video'`; bake writes the `<video id="bg-video">`
  src (or empties the holder); all three templates gained the holder markup +
  CSS with the same palette scrim as photos. Preview relies on
  `autoplay muted loop`; export relies on framework-owned media playback
  (`class` semantics untouched — the element carries `data-start="0"`).
- **Image backgrounds** — 18 texture/scene PNGs → 1080×1920 JPG crops in
  `/public/backgrounds/img`, riding the existing `photo` pipeline (Ken Burns +
  scrim), selectable.
- **Cliparts** — 68 images → max-512 px, alpha preserved, in
  `/public/cliparts`. Curated term index in `src/lib/visuals/cliparts.ts`;
  the matcher (`match.ts`) now normalizes BOTH libraries' keys and prefers
  full-colour clipart over line icons. New `VisualItem` kind `'clipart'`;
  templates place them at icon slots at 250 px, full colour, `object-fit:
  contain` + drop shadow. `render.ts` copies `/cliparts` into bundles and
  relativizes root-relative spec srcs.
- `assets/CREDITS.md` updated (Audiio + licensed stock sections).

## Summary teaching type

`'summary'` added to `DeviceType`, provider `DEVICE_TYPES`, the illustrate
prompt (type description + labels + language-rule enum), and the Studio lens
grid. Faithful 2–3 sentence distillation; explicitly not a paraphrase of the
verse text, so the verbatim gate stays meaningful.

## Source text → teachings

- `/api/extract`: pasted text (JSON) or uploaded `.txt`/`.pdf` (multipart;
  `unpdf`, MIT). Source capped at 24 000 chars with an honest notice.
- Provider seam gained a generic `completeJson` (Claude structured outputs /
  Gloo prompt-described JSON) used by extraction and series planning.
- The model mines 3–5 teachings `{title, summary, reference}` — references
  only; picking a card resolves the passage from YouVersion and enters the
  normal devices flow. Nothing from an upload can become Scripture.
- Studio gained a source-mode tab ("Topic or verse" / "From your text") and a
  teachings step.

## Shorts ideas from enhanced_plan.txt

- **Bible version dropdown** — `/api/versions?lang=` wraps `listBibles`; the
  picker appears when more than one version is licensed; `versionId` was
  already honoured by `/api/resolve`.
- **Cultural tone** — `tone` (`conversational` / `formal` / `liturgical`) on
  `PromptContext`, rendered as a `<tone>` register clause in the universal
  system prompt; three-way control in the studio.
- **Series generator** — `/api/series`: theme + 3/5/7/14 days → planned days
  `{day, focus, reference, lens}` (references only). Series step lists the
  days; each click resolves that day's passage and generates with its lens.
- **Gallery discovery + sharing** — search box, language/lens/style filters,
  per-entry Copy link (anchored `#id`) and WhatsApp / Telegram / X share links.

Skipped by instruction: image-card export, embed codes, small-group discussion
packs, and the other text/PDF-output ideas.

## Verification

- `npm run typecheck` clean, all 50 unit tests pass (one matcher test updated
  for the clipart-over-icon preference), `next build` clean with all new
  routes. Bake smoke-checked: video src injection/removal, image-background
  var, music src, and asset-prefix rebasing.
- Pre-existing lint noise (vendored minified files, one legacy React effect
  pattern) untouched.
