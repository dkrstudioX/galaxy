# -*- coding: utf-8 -*-
"""Генерирует 5 вариантов: assets/vN/*.png (свои рамки и палитра) + indexN.html."""
import math, os, re
from PIL import Image, ImageDraw, ImageFilter

S = 4
SRC_HTML = "index.html"

# ---------------------------------------------------------------- утилиты
def canvas(w, h):
    return Image.new("RGBA", (int(w * S), int(h * S)), (0, 0, 0, 0))

def save(img, name):
    img = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    img.save(name)
    print(" ", name)

def with_glow(layer, blur=5, alpha=0.85):
    glow = layer.filter(ImageFilter.GaussianBlur(blur))
    r, g, b, a = glow.split()
    a = a.point(lambda v: int(v * alpha))
    return Image.alpha_composite(Image.merge("RGBA", (r, g, b, a)), layer)

def bezier(draw, p0, p1, p2, fill, width):
    pts = []
    for i in range(41):
        t = i / 40
        pts.append(((1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0],
                    (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]))
    draw.line(pts, fill=fill, width=width, joint="curve")

def spiral(draw, cx, cy, r0, turns, fill, width, ccw=False):
    pts = []
    n = int(turns * 40)
    for i in range(n + 1):
        t = i / n
        ang = t * turns * 2 * math.pi * (-1 if ccw else 1)
        r = r0 * (1 - t * 0.92)
        pts.append((cx + r * math.cos(ang), cy + r * math.sin(ang)))
    draw.line(pts, fill=fill, width=width, joint="curve")

def diamond(draw, cx, cy, r, fill, outline=None, ow=0):
    draw.polygon([(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)], fill=fill, outline=outline, width=ow)

def rgb(c): return (c[0], c[1], c[2])

# ---------------------------------------------------------------- углы (96x96)
def corner_arch(hi, mid, dk):
    size, k, m, r = 96, S, 10 * S, 62 * S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    cx = cy = m + r
    d.line([(m, cy), (m, size*k - 6*k)], fill=mid, width=3*k)
    d.line([(cx, m), (size*k - 6*k, m)], fill=mid, width=3*k)
    d.line([(m + 7*k, cy), (m + 7*k, size*k - 14*k)], fill=dk, width=k)
    d.line([(cx, m + 7*k), (size*k - 14*k, m + 7*k)], fill=dk, width=k)
    d.arc([m, m, m + 2*r, m + 2*r], 180, 270, fill=mid, width=3*k)
    d.arc([m+7*k, m+7*k, m+7*k + 2*(r-7*k), m+7*k + 2*(r-7*k)], 180, 270, fill=dk, width=k)
    d.ellipse([cx-20*k, cy-20*k, cx+20*k, cy+20*k], outline=dk, width=k)
    diamond(d, cx, cy, 12*k, mid, hi, k)
    bezier(d, (m+7*k, cy+34*k), (m+7*k, cy+78*k), (m+44*k, cy+78*k), mid, 2*k)
    bezier(d, (cx+34*k, m+7*k), (cx+78*k, m+7*k), (cx+78*k, m+44*k), mid, 2*k)
    spiral(d, m+46*k, cy+78*k, 13*k, 1.4, mid, 2*k, ccw=True)
    spiral(d, cx+78*k, m+46*k, 13*k, 1.4, mid, 2*k)
    diamond(d, m, size*k-6*k, 5*k, hi); diamond(d, size*k-6*k, m, 5*k, hi)
    return img

def corner_bracket(hi, mid, dk):
    size, k, m = 96, S, 12 * S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    d.line([(m, 8*k), (m, size*k-8*k)], fill=mid, width=3*k)
    d.line([(8*k, m), (size*k-8*k, m)], fill=mid, width=3*k)
    d.line([(m+9*k, 20*k), (m+9*k, size*k-20*k)], fill=dk, width=k)
    d.line([(20*k, m+9*k), (size*k-20*k, m+9*k)], fill=dk, width=k)
    # скошенный угол + заклёпки
    d.line([(m, 34*k), (34*k, m)], fill=hi, width=2*k)
    for t in (0.35, 0.55, 0.75):
        d.ellipse([m+9*k + t*(30*k)-3*k, 30*k - t*(30*k)-3*k + 9*k,
                   m+9*k + t*(30*k)+3*k, 30*k - t*(30*k)+3*k + 9*k], fill=hi)
    diamond(d, m+9*k, m+9*k, 6*k, mid, hi, k)
    diamond(d, size*k-8*k, m, 4*k, hi); diamond(d, m, size*k-8*k, 4*k, hi)
    return img

def corner_leaf(hi, mid, dk):
    size, k, m = 96, S, 12 * S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    d.line([(m, 6*k), (m, size*k-10*k)], fill=mid, width=3*k)
    d.line([(6*k, m), (size*k-10*k, m)], fill=mid, width=3*k)
    for rr, w, c in ((46*k, 2*k, hi), (36*k, 2*k, mid), (26*k, k, dk)):
        d.arc([m, m, m+2*rr, m+2*rr], 180, 270, fill=c, width=w)
    bezier(d, (m, 60*k), (m+40*k, 60*k), (m+58*k, 84*k), mid, 2*k)
    bezier(d, (60*k, m), (60*k, m+40*k), (84*k, m+58*k), mid, 2*k)
    bezier(d, (m, 60*k), (m+26*k, 74*k), (m+10*k, 88*k), hi, k)
    bezier(d, (60*k, m), (74*k, m+26*k), (88*k, m+10*k), hi, k)
    for i, t in enumerate((70, 82)):
        d.ellipse([t*k-2.5*k, t*k-2.5*k, t*k+2.5*k, t*k+2.5*k], fill=hi)
        d.ellipse([t*k-2.5*k, t*k-2.5*k, t*k+2.5*k, t*k+2.5*k], fill=hi)
    diamond(d, m+40*k, m+40*k, 7*k, mid, hi, k)
    return img

def corner_spikes(hi, mid, dk):
    size, k, m = 96, S, 14 * S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    d.line([(m, 10*k), (m, size*k-8*k)], fill=mid, width=3*k)
    d.line([(10*k, m), (size*k-8*k, m)], fill=mid, width=3*k)
    # шипы по диагонали
    for i, L in enumerate((26*k, 42*k, 58*k)):
        w = (3 if i == 1 else 2) * k
        d.line([(L, m+2*k), (m+2*k, L)], fill=mid if i != 1 else hi, width=w)
    # внутренняя грань зигзагом
    pts = [(m+8*k, 64*k)]
    x = m + 8*k
    while x < size*k - 16*k:
        pts.append((x, 64*k)); pts.append((x + 12*k, m + 8*k + 22*k)); x += 24*k
    d.line(pts[:8], fill=dk, width=k)
    diamond(d, m+66*k, m+66*k, 8*k, hi, mid, k)
    diamond(d, m+8*k, size*k-8*k, 5*k, mid); diamond(d, size*k-8*k, m+8*k, 5*k, mid)
    return img

def corner_gear(hi, mid, dk):
    size, k, m = 96, S, 16 * S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    r = 58 * k
    cx = cy = m
    # четверть шестерни
    d.arc([cx-r, cy-r, cx+r, cy+r], 180, 270, fill=mid, width=3*k)
    d.arc([cx-r+9*k, cy-r+9*k, cx+r-9*k, cy+r-9*k], 180, 270, fill=dk, width=k)
    for i in range(7):
        a = math.radians(180 + 90 * i / 6)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        d.rectangle([x-3*k, y-3*k, x+3*k, y+3*k], fill=mid)
    d.ellipse([cx-12*k, cy-12*k, cx+12*k, cy+12*k], fill=mid, outline=dk, width=k)
    d.ellipse([cx-4*k, cy-4*k, cx+4*k, cy+4*k], fill=hi)
    d.line([(cx, cy), (cx, cy-r+6*k)], fill=hi, width=2*k)
    d.line([(m+2*k, cy+r-8*k), (m+2*k, cy+r+18*k)], fill=mid, width=2*k)
    return img

# ---------------------------------------------------------------- рамки для квадратов (156x156)
def frame_octagon(hi, mid, dk):
    size = 156; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    c = size*k/2; R = size*k/2 - 8*k
    pts = []
    for adeg in (270, 315, 0, 45, 90, 135, 180, 225):
        a = math.radians(adeg)
        L = R if adeg % 90 == 0 else R / math.cos(math.pi/8)
        pts.append((c + L*math.cos(a), c + L*math.sin(a)))
    d.polygon(pts, outline=mid, width=3*k)
    d.polygon([((x-c)*.88+c, (y-c)*.88+c) for x, y in pts], outline=dk, width=k)
    for adeg in (292.5, 337.5, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5):
        a = math.radians(adeg)
        diamond(d, c + R*math.cos(a), c + R*math.sin(a), 6*k, hi, dk, k)
    for adeg in (270, 90, 0, 180):
        a = math.radians(adeg)
        diamond(d, c + R*math.cos(a), c + R*math.sin(a), 8*k, mid, hi, k)
    return img

def frame_square_notch(hi, mid, dk):
    size = 156; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    m, w = 14*k, size*k - 28*k
    d.rectangle([m, m, m+w, m+w], outline=mid, width=3*k)
    d.rectangle([m+8*k, m+8*k, m+w-8*k, m+w-8*k], outline=dk, width=k)
    for x, y in ((m, m), (m+w, m), (m, m+w), (m+w, m+w)):
        diamond(d, x, y, 9*k, mid, hi, k)
    for x, y in ((m+w/2, m), (m+w/2, m+w), (m, m+w/2), (m+w, m+w/2)):
        d.rectangle([x-3*k, y-3*k, x+3*k, y+3*k], fill=hi)
    return img

def frame_circle(hi, mid, dk):
    size = 156; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    c = size*k/2
    d.ellipse([c-66*k, c-66*k, c+66*k, c+66*k], outline=mid, width=3*k)
    d.ellipse([c-58*k, c-58*k, c+58*k, c+58*k], outline=dk, width=k)
    d.arc([c-72*k, c-72*k, c+72*k, c+72*k], 200, 250, fill=hi, width=2*k)
    d.arc([c-72*k, c-72*k, c+72*k, c+72*k], 20, 70, fill=hi, width=2*k)
    d.arc([c-72*k, c-72*k, c+72*k, c+72*k], 110, 160, fill=hi, width=2*k)
    d.arc([c-72*k, c-72*k, c+72*k, c+72*k], 290, 340, fill=hi, width=2*k)
    for adeg in (270, 90, 0, 180):
        a = math.radians(adeg)
        diamond(d, c + 66*k*math.cos(a), c + 66*k*math.sin(a), 8*k, mid, hi, k)
    return img

def frame_diamond_spikes(hi, mid, dk):
    size = 156; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    c = size*k/2; R = 62*k
    pts = [(c + R*math.cos(math.radians(a)), c + R*math.sin(math.radians(a))) for a in (225, 315, 45, 135)]
    d.polygon(pts, outline=mid, width=3*k)
    pts2 = [(c + R*.85*math.cos(math.radians(a)), c + R*.85*math.sin(math.radians(a))) for a in (225, 315, 45, 135)]
    d.polygon(pts2, outline=dk, width=k)
    for adeg in (225, 315, 45, 135):
        a = math.radians(adeg)
        x, y = c + R*math.cos(a), c + R*math.sin(a)
        d.line([(x*0.85 + c*0.15, y*0.85 + c*0.15), (x + 12*k*math.cos(a), y + 12*k*math.sin(a))], fill=hi, width=2*k)
        diamond(d, x, y, 6*k, mid, hi, k)
    for adeg in (270, 90, 0, 180):
        a = math.radians(adeg)
        diamond(d, c + R*math.cos(a), c + R*math.sin(a), 5*k, hi)
    return img

def frame_cog(hi, mid, dk):
    size = 156; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    c = size*k/2; R = 62*k
    d.ellipse([c-R, c-R, c+R, c+R], outline=mid, width=3*k)
    for i in range(16):
        a = math.radians(i * 22.5)
        x, y = c + R*math.cos(a), c + R*math.sin(a)
        d.rectangle([x-3.5*k, y-3.5*k, x+3.5*k, y+3.5*k], fill=mid)
    d.ellipse([c-R+10*k, c-R+10*k, c+R-10*k, c+R-10*k], outline=dk, width=k)
    for adeg in (270, 90, 0, 180):
        a = math.radians(adeg)
        diamond(d, c + R*math.cos(a), c + R*math.sin(a), 9*k, hi, mid, k)
    return img

# ---------------------------------------------------------------- crest (72x48)
def crest(hi, mid, dk):
    w, h, k = 72, 48, S
    img = canvas(w, h); d = ImageDraw.Draw(img)
    cx, cy = w*k/2, h*k/2
    diamond(d, cx, cy, 11*k, mid, hi, k)
    d.line([(6*k, cy), (cx-20*k, cy)], fill=mid, width=2*k)
    d.line([(cx+20*k, cy), (w*k-6*k, cy)], fill=mid, width=2*k)
    bezier(d, (6*k, cy-4*k), (cx-24*k, cy-10*k), (cx-20*k, cy), dk, k)
    bezier(d, (w*k-6*k, cy-4*k), (cx+24*k, cy-10*k), (cx+20*k, cy), dk, k)
    return img

def corner_sq_simple(hi, mid, dk):
    size = 44; k = S
    img = canvas(size, size); d = ImageDraw.Draw(img)
    m, r = 6*k, 26*k
    cx = cy = m + r
    d.line([(m, cy), (m, size*k-4*k)], fill=mid, width=2*k)
    d.line([(cx, m), (size*k-4*k, m)], fill=mid, width=2*k)
    d.arc([m, m, m+2*r, m+2*r], 180, 270, fill=mid, width=2*k)
    d.line([(m+5*k, cy-8*k), (m+5*k, size*k-10*k)], fill=dk, width=k)
    d.line([(cx-8*k, m+5*k), (size*k-10*k, m+5*k)], fill=dk, width=k)
    diamond(d, cx, cy, 7*k, mid, hi, k)
    return img

# ---------------------------------------------------------------- варианты
VARIANTS = [
    dict(name="Аметист", hi="#e6c9ff", mid="#a97fe8", dk="#5d3f8f", accent="#7fe0d2",
         corner=corner_arch, frame=frame_octagon),
    dict(name="Сталь", hi="#e8f1f8", mid="#9fb4c8", dk="#55697c", accent="#86d6f0",
         corner=corner_bracket, frame=frame_square_notch),
    dict(name="Изумруд", hi="#c7f0b0", mid="#7cc26a", dk="#3f6f34", accent="#f0d786",
         corner=corner_leaf, frame=frame_circle),
    dict(name="Багрец", hi="#ffb3a0", mid="#d95f4a", dk="#7c2f22", accent="#ffc86a",
         corner=corner_spikes, frame=frame_diamond_spikes),
    dict(name="Медь", hi="#f5c68a", mid="#c87f3f", dk="#6e4320", accent="#6fd8c6",
         corner=corner_gear, frame=frame_cog),
]

GOLD_HI, GOLD, GOLD_DK, TEAL = "#f3d99a", "#d8b46a", "#8a6c33", "#6fd8c6"
BTN_HI, BTN_DK = "#e7c887", "#b98f45"

def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def build_html(v, n):
    html = open(SRC_HTML, encoding="utf-8").read()
    repl = [
        ("#f3d99a", v["hi"]), ("#d8b46a", v["mid"]), ("#8a6c33", v["dk"]),
        ("#6fd8c6", v["accent"]),
        ("#e7c887", v["hi"]), ("#b98f45", v["mid"]),
        ("rgba(243, 217, 154,", "rgba(%d, %d, %d," % hex2rgb(v["hi"])),
        ("rgba(216, 180, 106,", "rgba(%d, %d, %d," % hex2rgb(v["mid"])),
        ("rgba(138, 108, 51,", "rgba(%d, %d, %d," % hex2rgb(v["dk"])),
        ("rgba(111, 216, 198,", "rgba(%d, %d, %d," % hex2rgb(v["accent"])),
        ('url("assets/', 'url("assets/v%d/' % n),
        ("<title>HELIOS // 7 — орбитальная база · design2</title>",
         "<title>HELIOS // 7 — орбитальная база · design2 · вариант %d «%s»</title>" % (n, v["name"])),
    ]
    for a, b in repl:
        html = html.replace(a, b)
    open("index%d.html" % n, "w", encoding="utf-8").write(html)
    print("index%d.html — %s" % (n, v["name"]))

for n, v in enumerate(VARIANTS, 1):
    os.makedirs("assets/v%d" % n, exist_ok=True)
    os.chdir("assets/v%d" % n)
    hi, mid, dk = hex2rgb(v["hi"]) + (255,), hex2rgb(v["mid"]) + (255,), hex2rgb(v["dk"]) + (255,)
    save(with_glow(v["corner"](hi, mid, dk)), "corner-panel.png")
    save(with_glow(corner_sq_simple(hi, mid, dk)), "corner-sq.png")
    save(with_glow(v["frame"](hi, mid, dk)), "frame-sq.png")
    save(with_glow(crest(hi, mid, dk)), "crest.png")
    os.chdir("../..")
    build_html(v, n)
