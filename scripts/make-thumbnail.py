"""YouTube thumbnail — 1280x720.

Not the same job as the Kaggle cover. A cover is looked AT; a thumbnail is
glimpsed at maybe 210px wide in a sidebar, so it gets fewer tiles, much larger
type, and no language codes. Four non-Latin scripts carry the whole pitch:
whatever this is, it is not another English Bible app.
"""
import pathlib, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, H = 1280, 720
BG     = (13, 11, 20)
INK    = (247, 243, 233)
SOFT   = (162, 154, 182)
ACCENT = (240, 186, 96)

PICKS = [
    ("Hebrew",   "short-JHN.1_1.1-warm-minimal-ms9dv6ua.jpg"),
    ("Arabic",   "short-PSA.37.4-warm-minimal-ms98f15g.jpg"),
    ("Hindi",    "short-JHN.13.34-35-warm-minimal-ms9824ej.jpg"),
    ("Mandarin", "::zh-clean::"),
]


def zh_clean_frame():
    """Same reason as the cover: the published poster for the Mandarin short
    caught a page mid-transition. Pull a clean verse page from the MP4."""
    mp4 = ROOT / "public" / "gallery" / "short-2TI.1.7-warm-minimal-ms977fsi.mp4"
    out = pathlib.Path(tempfile.gettempdir()) / "scriptorium-cover-zh.png"
    if not out.exists():
        subprocess.run(["ffmpeg", "-v", "error", "-ss", "13.2", "-i", str(mp4),
                        "-frames:v", "1", str(out), "-y"], check=True)
    return out


def font(name, size):
    for p in (rf"C:\Windows\Fonts\{name}", name):
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            continue
    return ImageFont.load_default()


f_head  = font("segoeuib.ttf", 68)
f_head2 = font("segoeuib.ttf", 68)
f_lang  = font("segoeuib.ttf", 30)
f_foot  = font("segoeuib.ttf", 27)

img = Image.new("RGB", (W, H), BG)
wash = Image.new("RGB", (W, H), BG)
wd = ImageDraw.Draw(wash)
wd.ellipse((-260, -360, 900, 300), fill=(33, 26, 47))
wd.ellipse((760, -240, 1600, 240), fill=(27, 22, 40))
img = Image.blend(img, wash, 0.9)
d = ImageDraw.Draw(img)

# Headline. Two lines, because one line at this width would have to shrink.
d.text((64, 44), "SCRIPTURE SHORTS", font=f_head, fill=INK)
d.text((64, 118), "IN YOUR OWN LANGUAGE", font=f_head2, fill=ACCENT)

# Tiles.
PW, PH = 225, 372
GAP = 26
total = len(PICKS) * PW + (len(PICKS) - 1) * GAP
x0 = (W - total) // 2
y0 = 226

for i, (label, fname) in enumerate(PICKS):
    x = x0 + i * (PW + GAP)
    src = zh_clean_frame() if fname == "::zh-clean::" else ROOT / "public" / "gallery" / fname
    poster = Image.open(src).convert("RGB")
    sr, dr = poster.width / poster.height, PW / PH
    if sr > dr:
        nw = int(poster.height * dr)
        poster = poster.crop(((poster.width - nw) // 2, 0, (poster.width + nw) // 2, poster.height))
    else:
        nh = int(poster.width / dr)
        poster = poster.crop((0, (poster.height - nh) // 2, poster.width, (poster.height + nh) // 2))
    poster = poster.resize((PW, PH), Image.LANCZOS)

    mask = Image.new("L", (PW, PH), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, PW - 1, PH - 1), radius=14, fill=255)
    img.paste(poster, (x, y0), mask)
    d.rounded_rectangle((x, y0, x + PW - 1, y0 + PH - 1), radius=14, outline=(66, 59, 86), width=2)

    tw = d.textlength(label, font=f_lang)
    d.text((x + (PW - tw) / 2, y0 + PH + 16), label, font=f_lang, fill=INK)

d.text((64, 660), "Retrieved from YouVersion  ·  never generated  ·  the build proves it",
       font=f_foot, fill=SOFT)

out = ROOT / "public" / "youtube-thumbnail.png"
img.save(out, "PNG")
print("wrote", out, img.size, f"{out.stat().st_size/1024:.0f} KB")

jpg = ROOT / "public" / "youtube-thumbnail.jpg"
img.save(jpg, "JPEG", quality=92)
print("wrote", jpg, f"{jpg.stat().st_size/1024:.0f} KB  (YouTube limit 2 MB)")
