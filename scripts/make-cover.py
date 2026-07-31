"""Cover image for the Kaggle Writeup: six real rendered shorts, six scripts."""
import io, json, pathlib, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
W, H = 1600, 900
BG      = (13, 11, 20)
INK     = (247, 243, 233)
SOFT    = (150, 143, 168)
ACCENT  = (231, 178, 92)

# One short per script — the visual argument of the whole project.
PICKS = [
    ("he", "Hebrew",     "short-JHN.1_1.1-warm-minimal-ms9dv6ua.jpg"),
    ("bn", "Bengali",    "short-HAB.3.17-19-warm-minimal-ms99lbhj.jpg"),
    ("ar", "Arabic",     "short-PSA.37.4-warm-minimal-ms98f15g.jpg"),
    # The published poster for this short caught a mid-transition overlap;
    # this is a clean verse-page frame pulled from the same MP4.
    ("zh", "Mandarin",   "::zh-clean::"),
    ("hi", "Hindi",      "short-JHN.13.34-35-warm-minimal-ms9824ej.jpg"),
    ("en", "English",    "short-PSA.46.1-neon-night-ms1zi0ug.jpg"),
]

def zh_clean_frame():
    """The published poster for the Mandarin short caught a page mid-transition,
    with two sentences overlapping the illustration — which is exactly what the
    six-page format claims never happens. Rather than put that on the cover,
    pull a clean verse-page frame straight out of the same MP4."""
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

f_title = font("segoeuib.ttf", 92)
f_sub   = font("segoeui.ttf", 36)
f_lang  = font("segoeuib.ttf", 25)
f_small = font("segoeui.ttf", 22)
f_foot  = font("segoeui.ttf", 24)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

# A soft warm wash behind the title so the frame is not a flat rectangle.
wash = Image.new("RGB", (W, H), BG)
wd = ImageDraw.Draw(wash)
wd.ellipse((-300, -420, 1100, 360), fill=(31, 25, 44))
wd.ellipse((900, -300, 2000, 300), fill=(26, 22, 38))
img = Image.blend(img, wash, 0.85)
d = ImageDraw.Draw(img)

d.text((84, 74), "SCRIPTORIUM", font=f_title, fill=INK)
d.text((88, 186), "Scripture shorts, in your own language.", font=f_sub, fill=ACCENT)

# The filmstrip.
PW, PH = 236, 420
GAP = 18
total = len(PICKS) * PW + (len(PICKS) - 1) * GAP
x0 = (W - total) // 2
y0 = 288

for i, (code, label, fname) in enumerate(PICKS):
    x = x0 + i * (PW + GAP)
    src = zh_clean_frame() if fname == "::zh-clean::" else ROOT / "public" / "gallery" / fname
    poster = Image.open(src).convert("RGB")
    # cover-crop to 9:16
    tw, th = PW, PH
    sr, dr = poster.width / poster.height, tw / th
    if sr > dr:
        nw = int(poster.height * dr)
        poster = poster.crop(((poster.width - nw) // 2, 0, (poster.width + nw) // 2, poster.height))
    else:
        nh = int(poster.width / dr)
        poster = poster.crop((0, (poster.height - nh) // 2, poster.width, (poster.height + nh) // 2))
    poster = poster.resize((tw, th), Image.LANCZOS)

    # rounded corners
    mask = Image.new("L", (tw, th), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, tw - 1, th - 1), radius=16, fill=255)
    img.paste(poster, (x, y0), mask)
    d.rounded_rectangle((x, y0, x + tw - 1, y0 + th - 1), radius=16, outline=(58, 52, 76), width=1)

    d.text((x, y0 + th + 16), label, font=f_lang, fill=INK)
    d.text((x, y0 + th + 46), code, font=f_small, fill=SOFT)

d.line((84, 812, W - 84, 812), fill=(48, 43, 66), width=1)
d.text((84, 832),
       "Verse text retrieved verbatim from YouVersion, never generated  ·  "
       "teaching written by Gloo AI  ·  a mismatch fails the build",
       font=f_foot, fill=SOFT)

out = ROOT / "public" / "cover.png"
img.save(out, "PNG")
print("wrote", out, img.size)

# A 1200x630 variant, the usual social/card ratio.
img.resize((1200, 675), Image.LANCZOS).crop((0, 22, 1200, 652)).save(ROOT / "public" / "cover-1200x630.png", "PNG")
print("wrote 1200x630 variant")
