"""Build the Kaggle submission notebook from readable source blocks.

Writing the .ipynb JSON by hand is a quoting minefield, so the notebook is
generated from the plain-text blocks below and executed afterwards.

CAUTION: this OVERWRITES notebook/scriptorium.ipynb with unexecuted cells,
throwing away the saved outputs. Those outputs are the point — they are the
evidence that the live pipeline answered. After regenerating, always re-execute:

    python -c "import nbformat; from nbclient import NotebookClient; \\
      nb=nbformat.read('notebook/scriptorium.ipynb',as_version=4); \\
      NotebookClient(nb,timeout=600,kernel_name='python3',allow_errors=True).execute(); \\
      nbformat.write(nb,'notebook/scriptorium.ipynb')"

then confirm all 8 code cells carry outputs before committing.
"""
import json, pathlib

cells = []


def md(text):
    cells.append({"cell_type": "markdown", "metadata": {}, "source": text.strip("\n").splitlines(keepends=True)})


def code(text):
    cells.append({
        "cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
        "source": text.strip("\n").splitlines(keepends=True),
    })


md("""
# Scriptorium — Scripture shorts, in your own language

**A creator tool that puts Scripture where culture is actually made: vertical video, in languages that have none of it.**

*Submission to **Scripture in New Frontiers** (Gloo × YouVersion) by Dr. Philemon Paul Daniel.*

| | |
|---|---|
| 🎬 **Video demo** | see the Writeup / Media Gallery |
| 🌍 **Live app** | https://scriptorium-gamma-wheat.vercel.app |
| 💻 **Code** | https://github.com/phildani7/scriptorium (Apache-2.0) |
| 🔌 **Live MCP endpoint** | https://scriptorium-gamma-wheat.vercel.app/api/mcp |

---

## The gap

YouVersion serves Scripture as **text** in over a thousand languages. The world's dominant
medium is now **vertical video** — and in most of those languages there is essentially none
of it, because making a good short takes a designer, a voice, and an editor that a volunteer
church does not have.

Scriptorium supplies all three. Type a reference or a topic, paste a sermon, drop an article
link, upload a PDF, or ask for a whole multi-day series; pick a lens and a language; and about
a minute later you have a publishable 1080×1920 short — narrated in a real voice, captioned
word by word, set in your own script, with real motion design.

## The architectural claim

> **Scripture is retrieved, never generated — and the build proves it.**

Verse text comes verbatim from the YouVersion Platform API and is never touched. The model
writes only the teaching device *around* the verse. Before a single frame is captured, the
rendered verse node is NFC-normalized and diffed against a fresh API response; a mismatch
**fails the build** rather than shipping.

**This notebook is not a description of that claim. It runs it against the live production
deployment, and then tries to break it.**
""")

md("""
---
## 0. Setup

Everything below talks to the **live production deployment** over its public, stateless MCP
endpoint — the same interface any MCP client (Claude, an IDE, an agent) uses to drive the
studio. No API keys are needed to run this notebook: the deployment holds the YouVersion and
Gloo credentials server-side.

> ⚠️ **Kaggle notebooks have internet disabled by default.** Turn on *Settings → Internet* to
> re-run the live cells. Every cell degrades gracefully and explains itself if the network is
> unavailable, and the saved outputs show a real run.
""")

code('''
import json, urllib.request, urllib.error, textwrap, unicodedata, re

BASE = "https://scriptorium-gamma-wheat.vercel.app"
MCP  = f"{BASE}/api/mcp"

ONLINE = True          # flipped to False automatically if the first call fails
_rpc_id = 0

def mcp(tool, arguments=None, timeout=120):
    """Call one MCP tool on the live deployment. Returns the parsed JSON payload."""
    global _rpc_id, ONLINE
    if not ONLINE:
        raise RuntimeError("offline")
    _rpc_id += 1
    payload = json.dumps({
        "jsonrpc": "2.0", "id": _rpc_id, "method": "tools/call",
        "params": {"name": tool, "arguments": arguments or {}},
    }).encode()
    req = urllib.request.Request(MCP, data=payload, headers={
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = json.loads(r.read().decode())
    except Exception as e:
        ONLINE = False
        raise RuntimeError(f"live call failed ({e}). Enable Settings -> Internet to re-run.") from e
    if "error" in body:
        raise RuntimeError(body["error"])
    # MCP wraps tool output as a text content block holding JSON.
    return json.loads(body["result"]["content"][0]["text"])

def show(obj, width=100):
    print(textwrap.fill(json.dumps(obj, ensure_ascii=False), width) if isinstance(obj, str)
          else json.dumps(obj, ensure_ascii=False, indent=2)[:4000])

print("target:", MCP)
''')

md("""
---
## 1. What the studio exposes

The whole pipeline is published as **8 stateless MCP tools**, so Scriptorium is not just a web
app — it is a tool any agent can drive. That matters for the "creator tools" frontier: the
studio can live inside the editor a creator already uses.
""")

code('''
req = urllib.request.Request(MCP, data=json.dumps(
        {"jsonrpc": "2.0", "id": 0, "method": "tools/list"}).encode(),
    headers={"Content-Type": "application/json",
             "Accept": "application/json, text/event-stream"})
try:
    tools = json.loads(urllib.request.urlopen(req, timeout=60).read())["result"]["tools"]
    for t in tools:
        print(f"  {t['name']:<20} {t['description'][:88]}")
    print(f"\\n{len(tools)} tools, live.")
except Exception as e:
    ONLINE = False
    print("Offline — enable Settings -> Internet. Expected tools: list_options, list_versions,")
    print("resolve_passage, generate_devices, extract_teachings, plan_series, create_short, gallery")
''')

md("""
---
## 2. YouVersion: Scripture retrieved, verbatim

`resolve_passage` accepts either a **reference** ("John 3:16") or a **situation** ("anxiety at
work") and returns candidate passages **retrieved from the YouVersion Platform API**
(`https://api.youversion.com/v1`), carrying the version and the publisher attribution that
must travel with the text.

Note what comes back: `text`, `versionId`, `versionAbbreviation`, `attribution`. The
attribution is not decoration — it is threaded through the render and into the gallery
manifest for every short produced.
""")

code('''
try:
    res = mcp("resolve_passage", {"input": "John 3:16", "languageCode": "en"})
    c = res["candidates"][0]
    print("mode:       ", res["mode"])
    print("reference:  ", c["reference"], f"({c['usfm']})")
    print("version:    ", c["versionAbbreviation"], "-", c["versionName"], f"[id {c['versionId']}]")
    print("attribution:", c["attribution"])
    print("\\ntext:")
    print(textwrap.fill(c["text"], 90))
    JHN = c["text"]          # kept for the integrity gate below
except RuntimeError as e:
    print(e)
    JHN = ("For God so loved the world, that he gave his only begotten Son, that whosoever "
           "believeth on him should not perish, but have eternal life.")
    print("\\nUsing a recorded ASV response so the gate demo below still runs.")
''')

md("""
### The same verse, in a script the medium has forgotten

This is the point of the project. Retrieval — and every downstream stage: type-fitting,
word-level captioning, voice — has to hold in scripts that Latin-first tooling silently breaks.
""")

code('''
for code_, label in [("hi", "Hindi"), ("ta", "Tamil"), ("ar", "Arabic"), ("zh", "Mandarin")]:
    try:
        c = mcp("resolve_passage", {"input": "John 3:16", "languageCode": code_})["candidates"][0]
        print(f"{label:<9} {c['versionAbbreviation']:<10} {c['text'][:70]}…")
    except RuntimeError as e:
        print(f"{label:<9} (offline)")
        break
''')

md("""
---
## 3. The integrity gate — and an attempt to break it

Here is the load-bearing part of the whole submission.

`src/lib/verify/verbatim.ts` is **dependency-free on purpose**, so a judge can audit it in one
sitting. It is re-implemented below in ~15 lines of Python — a faithful port, not a summary —
and then attacked with the exact adversarial cases from the TypeScript test suite
(`src/lib/verify/verbatim.test.ts`, 13 tests).

Normalization is deliberately narrow:

* **NFC** — Devanagari matras and Tamil vowel signs have multiple valid encodings; a browser
  text node may hand back a different one than the API did.
* **Render artefacts stripped** — BOM, soft hyphen, bidi marks: things a *layout engine* can
  legitimately insert.
* **ZWJ / ZWNJ deliberately preserved** — in Devanagari, Bengali and Tamil these control
  conjunct formation and are *part of the meaning*. Stripping them to make a diff pass would
  defeat the check on exactly the languages this project exists to serve.
""")

code('''
RENDER_ARTIFACTS = re.compile("[\\uFEFF\\u00AD\\u200E\\u200F\\u202A-\\u202E\\u2066-\\u2069]")
LEADING_VERSE_NUMBER = re.compile(r"(^|\\s)\\d{1,3}(?=[^\\W\\d_])", re.UNICODE)

def normalize_scripture(s, strip_verse_numbers=True):
    s = unicodedata.normalize("NFC", s)
    s = RENDER_ARTIFACTS.sub("", s)
    if strip_verse_numbers:
        s = LEADING_VERSE_NUMBER.sub(r"\\1", s)
    return re.sub(r"\\s+", " ", s).strip()

def verify_verbatim(rendered, source):
    a, b = normalize_scripture(rendered), normalize_scripture(source)
    if a == b:
        return True, f"Verse verified: {len(b)} characters match the YouVersion response exactly."
    i = next((i for i in range(min(len(a), len(b))) if a[i] != b[i]), min(len(a), len(b)))
    return False, f"MISMATCH at character {i}: expected {b[i:i+18]!r}, rendered {a[i:i+18]!r}"

ok, msg = verify_verbatim(JHN, JHN)
print("untouched render ->", ok, "|", msg)
''')

md("""
### Now tamper with it

Each of these is a plausible failure: a model "improving" a word, a pious addition, a dropped
vowel sign that is visually near-invisible at 1080×1920, a punctuation mark swapped by a font
fallback. **All four must fail.**
""")

code('''
PSA_HI = "यहोवा मेरा चरवाहा है; मुझे कुछ घटी न होगी।"

attacks = [
    ("a single substituted word",        JHN.replace("world", "cosmos"),   JHN),
    ("a pious editorial addition",       JHN + " (Amen.)",                 JHN),
    ("one dropped Devanagari matra",     PSA_HI.replace("मुझे", "मुझ"),      PSA_HI),
    ("a danda swapped for a full stop",  PSA_HI.replace("।", "."),         PSA_HI),
]

passed = 0
for name, tampered, source in attacks:
    ok, msg = verify_verbatim(tampered, source)
    verdict = "LEAKED THROUGH" if ok else "blocked"
    passed += (not ok)
    print(f"{verdict:<14} {name}")
    if not ok:
        print(f"               {msg}")

print(f"\\n{passed}/{len(attacks)} tampering attempts blocked.")
print("In the real pipeline this raises ScriptureIntegrityError in render/render.mjs,")
print("after the DOM is populated and BEFORE a single frame is captured. The build fails.")
print("`npm run prove:gate` performs exactly this tamper-and-refuse cycle end to end.")
''')

md("""
That is the difference between *claiming* the verse is untouched and *proving* it. A short
that ships altered Scripture is worse than no short, so the failure mode is a dead build, not
a warning in a log.
""")

md("""
---
## 4. Gloo AI Studio: the model writes the teaching, never the verse

`generate_devices` resolves a passage and then asks **Gloo AI Studio**
(`platform.ai.gloo.com/ai/v2/chat/completions`, OAuth2 client-credentials) for 3–7 *teaching
devices* through a chosen lens.

Two Gloo-specific capabilities are used deliberately rather than incidentally:

* **`tradition`** — values-alignment. A short for a Catholic parish and one for a Pentecostal
  youth group want different emphases from the same verse. The user's tradition is passed
  through instead of flattening everyone into one voice.
* **`auto_routing`** — Gloo picks the model per request and reports its tier and confidence.
  Both are recorded in the run manifest, so every short in the gallery can say **which model
  wrote its device and how confident the router was**.

The critical constraint: across *every* input path — a typed topic, a pasted sermon, an
uploaded PDF, a linked article, a planned series — the model may only ever return
**references**. Verse text is always fetched from YouVersion afterwards. No generated word can
reach the screen as Scripture.
""")

code('''
try:
    out = mcp("generate_devices", {"input": "anxiety at work", "lens": "hook",
                                   "languageCode": "en"}, timeout=180)
    p = out["passage"]
    print("Gloo chose the passage:", p["reference"], f"({p['versionAbbreviation']})")
    print("…and YouVersion supplied the text:")
    print(textwrap.fill(p["text"], 90), "\\n")
    for i, d in enumerate(out["devices"][:3]):
        print(f"--- device {i} ---")
        print(json.dumps(d, ensure_ascii=False, indent=2)[:700], "\\n")
except RuntimeError as e:
    print(e)
''')

md("""
Notice the shape of that result: Gloo returned a **reference**, and the verse text sitting
next to it came from YouVersion — not from the model. The two are joined only after retrieval.
""")

md("""
---
## 5. Shorts that actually exist

`gallery` reads the manifest of real MP4s rendered through the full pipeline — every one of
which passed the gate above before its first frame was captured.
""")

code('''
from collections import Counter

try:
    items = mcp("gallery", {})
    print(f"{len(items)} rendered shorts in the live gallery\\n")
    print(f"  {'language':<9}{'reference':<26}{'ver':<8}{'style':<14}{'sec':>4}")
    print("  " + "-" * 59)
    for s in items[:10]:
        print(f"  {s['language']:<9}{s['reference'][:24]:<26}{s['version']:<8}"
              f"{s['style']:<14}{s['durationSec']:>4}")

    langs = Counter(s["language"] for s in items)
    print(f"\\n  {len(langs)} languages represented: "
          + ", ".join(f"{k}({v})" for k, v in langs.most_common()))

    # The publisher attribution travels with every single short.
    print("\\n  attribution carried by the first short (truncated):")
    print("    " + " ".join(items[0]["attribution"].split())[:150] + "…")
    print("  music licence recorded alongside it:")
    print("    " + items[0].get("musicCredit", "—"))
except RuntimeError as e:
    print(e)

print("\\nBrowse them: " + BASE + "/gallery")
''')

md("""
---
## 6. Architecture

```
input ──▶ /api/resolve    YouVersion     reference or topic ──▶ passage (verbatim)
      ──▶ /api/extract    Gloo AI        your text/PDF/article ──▶ teachings (references only)
      ──▶ /api/series     Gloo AI        theme + days ──▶ planned series (references only)
      ──▶ /api/generate   Gloo AI        passage ──▶ 3-7 teaching devices
      ──▶ review          human          every field editable EXCEPT the verse, which is locked
      ──▶ /api/compose    Speechmatics   narration + word timings ──▶ ShortSpec
      ──▶ /api/preview    HyperFrames    ShortSpec + theme ──▶ composition HTML
      ──▶ /api/export     GitHub Actions ─or─ Vercel Sandbox ──▶ MP4 ──▶ /gallery
      ──▶ /api/mcp        MCP            the whole pipeline as 8 stateless tools
```

**Stack.** Next.js on Vercel · YouVersion Platform API (Scripture, versions, licensing) ·
Gloo AI Studio (teaching generation, tradition alignment, auto-routing) · Speechmatics
(TTS + forced alignment for word-level captions) · Piper (offline neural voices for languages
without a hosted one) · HyperFrames (deterministic, seek-safe motion design) · headless Chrome
+ ffmpeg for the MP4, run on GitHub Actions or in a Vercel Sandbox microVM.

**Reach.** 40 languages with licensed Bible text across 116 versions; 33 of them complete
(text + a free neural voice + word timing *measured* from the audio), 4 voiced with estimated
timing, 3 captions-only. Sixteen OFL font families are self-hosted, because in the headless
Chrome that captures the MP4 there is no system-font fallback — a CDN reference would silently
render blank, and a tool whose whole claim is "Scripture in your own language" cannot leave
that to the host. See `docs/language-coverage.md`, regenerated by `npm run audit:languages`
against the live API.

---

## 7. Things that cost real engineering

* **The type has to fit, measured rather than guessed.** `npm run check:fit` sweeps **252**
  theme × style × script configurations across 7 scripts — including Hebrew, Arabic and
  Chinese — and fails the build on any type that overflows. Text is re-fitted every time the
  font set finishes loading, not once.
* **Six pages, one sentence at a time.** Five sentences of teaching, one per page, then the
  verse. `npm run smoke:pages` bakes every template and asserts that **exactly one** sentence
  is visible at each page boundary, so nothing ever overlaps mid-transition.
* **YouTube captions cannot be scraped from the watch page.** `ytInitialPlayerResponse` still
  carries plausible `captionTracks`, so the scrape *looks* like it works — but those URLs are
  bound to the browser session and return HTTP 200 with a **zero-byte body** server-side. The
  link reader uses InnerTube (`POST /youtubei/v1/player`) with the iOS client, falling back to
  Android.
* **Two render backends kept alive side by side** — GitHub Actions by default, a Vercel
  Sandbox microVM as an alternate — because a contest demo that depends on one CI queue being
  healthy is a demo that fails at the wrong moment.

---

## 8. Try it yourself

* **Live studio** — <https://scriptorium-gamma-wheat.vercel.app>
* **Gallery** — <https://scriptorium-gamma-wheat.vercel.app/gallery>
* **MCP endpoint** — `https://scriptorium-gamma-wheat.vercel.app/api/mcp` (streamable HTTP,
  stateless — point any MCP client at it)
* **Source** — <https://github.com/phildani7/scriptorium>, Apache-2.0

Run the gate yourself:

```bash
git clone https://github.com/phildani7/scriptorium && cd scriptorium
npm install
npm test              # integrity-gate, USFM and alignment suites
npm run prove:gate    # tampers with a verse, asserts the render refuses
```

*Scripture text is retrieved from the YouVersion Platform API at run time and remains under
its publisher's copyright. Scriptorium redistributes none of it.*
""")

nb = {
    "cells": cells,
    "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python", "version": "3.11"},
    },
    "nbformat": 4, "nbformat_minor": 5,
}

out = pathlib.Path(__file__).resolve().parent.parent / "notebook" / "scriptorium.ipynb"
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")
print("wrote", out, len(cells), "cells")
