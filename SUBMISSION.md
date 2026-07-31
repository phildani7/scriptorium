# Kaggle submission — *Scripture in New Frontiers*

Copy-paste source for the Kaggle Writeup. Body is held under the 500-word limit.

---

## Title

**Scriptorium — Scripture shorts, in your own language**

## Subtitle

*The world moved to vertical video. Most of the world's languages never got Scripture there. A creator studio that closes the gap — and a build that fails rather than ship an altered verse.*

---

## Body

**The gap.** YouVersion serves Scripture as *text* in over a thousand languages. The dominant medium is now *vertical video*, and in most of those languages there is essentially none of it — not from indifference, but because a good short needs a designer, a voice, and an editor that a volunteer church does not have. English has thousands. Bengali has almost none.

**The frontier: creator tools.** Scriptorium supplies all three roles. Type a reference or a feeling ("anxiety at work"), paste a sermon, drop an article link, upload a PDF, or ask for a seven-day series. Pick a lens and a language. About a minute later you have a publishable 1080×1920 short — narrated in a real voice, captioned word by word, set in your own script, with real motion design. Not a Bible app. A production line for the medium culture is actually made in.

**The architectural claim: Scripture is retrieved, never generated — and the build proves it.** Verse text comes verbatim from the YouVersion Platform API. The model writes only the teaching *around* it. Before a single frame is captured, the rendered verse node is NFC-normalized and diffed against a fresh API response; a mismatch throws and **fails the build**. Every input path obeys one rule: models return *references only*; verse text is fetched afterward. A pasted sermon cannot put one generated word on screen as Scripture.

The attached notebook does not describe this. It calls the live deployment, then attacks the gate with a substituted word, a pious "(Amen.)", one dropped Devanagari matra, and a danda swapped for a full stop. Four of four blocked.

**Using Gloo deliberately.** `tradition` carries values-alignment — a Catholic parish and a Pentecostal youth group want different emphases from the same verse, and we pass that through instead of flattening everyone. `auto_routing` picks the model per request and reports tier and confidence; both are recorded, so every short can say which model wrote it.

**Engineering that had to be real.** 40 languages, 116 versions, 33 complete with neural voice and word timing *measured* from audio. `check:fit` sweeps 252 theme × style × script configurations across 7 scripts and fails on overflow. Sixteen OFL font families are self-hosted, because headless Chrome has no system-font fallback and would render Devanagari blank. Two render backends run side by side so one sick CI queue cannot kill a demo.

**Live now:** 29 rendered shorts across 8 languages. The whole studio is also 8 stateless MCP tools, so an agent can drive it.

- **Video demo:** `<PASTE YOUTUBE LINK HERE>`
- **App:** https://scriptorium-gamma-wheat.vercel.app
- **Code (Apache-2.0):** https://github.com/phildani7/scriptorium
- **MCP:** https://scriptorium-gamma-wheat.vercel.app/api/mcp

*Scripture is retrieved at run time and stays under its publisher's copyright. None is redistributed.*

---

## Submission checklist

Kaggle requires **all five** of these attached to one Writeup, submitted (not left as a draft)
before the deadline. Each team gets **one** submission.

| # | Requirement | Status | Where it is |
| :-: | --- | :-: | --- |
| 1 | **Kaggle Writeup**, ≤500 words, with title + subtitle | ready | body above — 442 words, leaving room for the video URL |
| 2 | **Media Gallery** with a **cover image** (required) | ready | `public/cover.png` (1600×900); `public/cover-1200x630.png` variant |
| 3 | **Attached public Notebook** | ready | `notebook/scriptorium.ipynb` — upload to Kaggle, set **Public**, save with outputs |
| 4 | **Attached public Video**, ≤3 min, on YouTube | **pending** | paste the link into the body above *and* attach it to the Media Gallery |
| 5 | **Public Project Link** | ready | https://scriptorium-gamma-wheat.vercel.app (live) + https://github.com/phildani7/scriptorium (Apache-2.0) |

### Steps on Kaggle

1. Competition page → **New Writeup**.
2. Paste the title, subtitle and body above.
3. **Media Gallery** → upload `public/cover.png` as the cover, then attach the YouTube video.
   Optionally add a few gallery stills.
4. **Project Files** → attach the notebook. Upload `notebook/scriptorium.ipynb`, run it once on
   Kaggle with *Settings → Internet* **on** so the live outputs are saved, then set it
   **Public** and attach it.
5. Add the project link.
6. **Save**, then click **Submit** in the top-right. A saved-but-unsubmitted draft is not judged.

### Notes

- The rules say the video should be **published to YouTube** and reachable **without a login**.
  *Unlisted* satisfies "no login", but **Public** is the safer reading of "post it publicly" —
  and it costs nothing to switch.
- Anything private you attach becomes public after the deadline anyway, so there is no reason
  to attach a private notebook.
- Licensing is already satisfied: the repo is public and GitHub reports **Apache License 2.0**,
  which is an OSI-approved licence that does not limit commercial use — exactly what the
  winner-licence clause (§2.5) requires.
