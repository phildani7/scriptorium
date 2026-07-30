"""Measure the clean paper band at the top of each doodle panel.

Sentence text sits in a centre column with generous side margins, so the
decorative doodle border in the outer 12% must not end the band. We scan only
x in [12%, 88%] and stop at the first row that departs from the panel's own
paper colour.
"""
import os, json, sys

from PIL import Image

ROOT = r"A:\CC\Kaggle26_YouGloo\pentecost-studio\public\doodles"
TOL = 30


def paper_ref(px, w):
    """Median colour of the top few centre rows: the page stock."""
    sample = [px[x, y] for y in range(3, 12) for x in range(int(w * 0.12), int(w * 0.88), 23)]
    return tuple(sorted(c[i] for c in sample)[len(sample) // 2] for i in range(3))


def top_band(img):
    w, h = img.size
    px = img.load()
    ref = paper_ref(px, w)
    x0, x1 = int(w * 0.12), int(w * 0.88)
    for y in range(h):
        for x in range(x0, x1, 7):
            c = px[x, y]
            if max(abs(c[i] - ref[i]) for i in range(3)) > TOL:
                return y, ref
    return h, ref


out = {}
for topic in sorted(os.listdir(ROOT)):
    d = os.path.join(ROOT, topic)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        if not name.endswith(".jpg"):
            continue
        img = Image.open(os.path.join(d, name)).convert("RGB")
        band, ref = top_band(img)
        out[f"{topic}/{name}"] = {
            "bandPx": band,
            "bandPct": round(band / img.size[1] * 100),
            "paper": "#%02x%02x%02x" % ref,
        }

for topic in sorted({k.split("/")[0] for k in out}):
    rows = [(k, v) for k, v in out.items() if k.startswith(topic + "/")]
    print(
        f"{topic:<11}"
        + "  ".join(f"{k.split('/')[1][6]}:{v['bandPct']:>2}%" for k, v in rows)
        + f"   paper {rows[0][1]['paper']}"
    )

print()
print(json.dumps({k: v["bandPct"] for k, v in out.items()}, separators=(",", ":")))
