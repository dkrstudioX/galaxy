# -*- coding: utf-8 -*-
"""Генератор PNG-рамок для design2: угловые орнаменты (панели/квадраты) и печать для квадратов."""
import math
from PIL import Image, ImageDraw, ImageFilter

S = 4  # суперсэмплинг
GOLD_HI = (243, 217, 154)
GOLD = (216, 180, 106)
GOLD_DK = (138, 108, 51)

def canvas(size):
    return Image.new("RGBA", (size * S, size * S), (0, 0, 0, 0))

def save(img, name):
    img = img.resize((img.width // S, img.height // S), Image.LANCZOS)
    img.save(name)
    print(name, img.size)

def with_glow(layer, blur=5, alpha=0.85):
    """свечение под основным слоем"""
    glow = layer.filter(ImageFilter.GaussianBlur(blur))
    r, g, b, a = glow.split()
    a = a.point(lambda v: int(v * alpha))
    glow = Image.merge("RGBA", (r, g, b, a))
    return Image.alpha_composite(glow, layer)

def bezier(draw, p0, p1, p2, fill, width):
    pts = []
    for i in range(41):
        t = i / 40
        x = (1-t)**2*p0[0] + 2*(1-t)*t*p1[0] + t**2*p2[0]
        y = (1-t)**2*p0[1] + 2*(1-t)*t*p1[1] + t**2*p2[1]
        pts.append((x, y))
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
    pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
    draw.polygon(pts, fill=fill, outline=outline, width=ow)

# ------------------------------------------------ corner-panel.png (96x96)
# Богатый угловой орнамент: Г-образные кромки, четвертная арка, завиток, камень-ромб.
size = 96
img = canvas(size)
d = ImageDraw.Draw(img)
k = S
m = 10 * k          # отступ кромки от края
L = 340 * k // 4    # длина прямых участков (85px)
r = 62 * k          # радиус арки
cx = cy = m + r     # центр арки

# прямые кромки (внешняя толстая + внутренняя тонкая)
d.line([(m, cy), (m, size * k - 6 * k)], fill=GOLD, width=3 * k)
d.line([(cx, m), (size * k - 6 * k, m)], fill=GOLD, width=3 * k)
d.line([(m + 7 * k, cy), (m + 7 * k, size * k - 14 * k)], fill=GOLD_DK, width=k)
d.line([(cx, m + 7 * k), (size * k - 14 * k, m + 7 * k)], fill=GOLD_DK, width=k)
# четвертные арки
d.arc([m, m, m + 2 * r, m + 2 * r], 180, 270, fill=GOLD, width=3 * k)
d.arc([m + 7 * k, m + 7 * k, m + 7 * k + 2 * (r - 7 * k), m + 7 * k + 2 * (r - 7 * k)], 180, 270, fill=GOLD_DK, width=k)
# камень-ромб на диагонали
d.ellipse([cx - 20 * k, cy - 20 * k, cx + 20 * k, cy + 20 * k], fill=(0, 0, 0, 0), outline=GOLD_DK, width=k)
diamond(d, cx, cy, 12 * k, GOLD, GOLD_HI, k)
# листья-завитки внутрь панели
bezier(d, (m + 7 * k, cy + 34 * k), (m + 7 * k, cy + 78 * k), (m + 44 * k, cy + 78 * k), GOLD, 2 * k)
bezier(d, (cx + 34 * k, m + 7 * k), (cx + 78 * k, m + 7 * k), (cx + 78 * k, m + 44 * k), GOLD, 2 * k)
spiral(d, m + 46 * k, cy + 78 * k, 13 * k, 1.4, GOLD, 2 * k, ccw=True)
spiral(d, cx + 78 * k, m + 46 * k, 13 * k, 1.4, GOLD, 2 * k)
# ромбики на концах кромок
diamond(d, m, size * k - 6 * k, 5 * k, GOLD_HI)
diamond(d, size * k - 6 * k, m, 5 * k, GOLD_HI)
save(with_glow(img), "corner-panel.png")

# ------------------------------------------------ corner-sq.png (44x44)
# Лаконичный уголок для квадратных карточек: скоба, дуга, точка.
size = 44
img = canvas(size)
d = ImageDraw.Draw(img)
m = 6 * k
r = 26 * k
cx = cy = m + r
d.line([(m, cy), (m, size * k - 4 * k)], fill=GOLD, width=2 * k)
d.line([(cx, m), (size * k - 4 * k, m)], fill=GOLD, width=2 * k)
d.arc([m, m, m + 2 * r, m + 2 * r], 180, 270, fill=GOLD, width=2 * k)
d.line([(m + 5 * k, cy - 8 * k), (m + 5 * k, size * k - 10 * k)], fill=GOLD_DK, width=k)
d.line([(cx - 8 * k, m + 5 * k), (size * k - 10 * k, m + 5 * k)], fill=GOLD_DK, width=k)
diamond(d, cx, cy, 7 * k, GOLD, GOLD_HI, k)
save(with_glow(img), "corner-sq.png")

# ------------------------------------------------ frame-sq.png (156x156)
# Цельная рамка-печать для квадратов: восьмиугольник с ромбами по углам и сторонам.
size = 156
img = canvas(size)
d = ImageDraw.Draw(img)
c = size * k / 2
R = size * k / 2 - 8 * k      # радиус восьмиугольника
cut = R * math.tan(math.pi / 8)  # срез угла
oct_pts = []
for ang_deg, (dx, dy) in [(270, (cut, 0)), (315, (R, -R) if False else (0, 0))] * 0 or []:
    pass
for ang_deg, ux, uy in [(270, 1, 0), (315, 1, -1), (0, 1, 0), (45, 1, 1), (90, 0, 1), (135, -1, 1), (180, -1, 0), (225, -1, -1)]:
    a = math.radians(ang_deg)
    L = R if ux * uy == 0 else R * math.sqrt(2) * math.cos(math.pi / 4)  # вершины на окружности
    oct_pts.append((c + L * math.cos(a), c + L * math.sin(a)))
oct_pts = []
for ang_deg in (270, 315, 0, 45, 90, 135, 180, 225):
    # вершины правильного восьмиугольника: середины сторон смотрят на кардиналы
    a = math.radians(ang_deg)
    L = R / math.cos(math.pi / 8) if ang_deg % 90 else R
    oct_pts.append((c + L * math.cos(a), c + L * math.sin(a)))
d.polygon(oct_pts, outline=GOLD, width=3 * k)
# внутренняя тонкая жила (тот же контур, меньше)
oct2 = [((x - c) * 0.88 + c, (y - c) * 0.88 + c) for x, y in oct_pts]
d.polygon(oct2, outline=GOLD_DK, width=k)
# ромбы: 4 на углах (диагонали) и 4 на серединах сторон
for ang_deg in (292.5, 337.5, 22.5, 67.5, 112.5, 157.5, 202.5, 247.5):
    a = math.radians(ang_deg)
    x, y = c + R * math.cos(a), c + R * math.sin(a)
    diamond(d, x, y, 6 * k, GOLD_HI, GOLD_DK, k)
# большие ромбы на кардиналах (вверх/вниз/влево/вправо)
for ang_deg in (270, 90, 0, 180):
    a = math.radians(ang_deg)
    x, y = c + R * math.cos(a), c + R * math.sin(a)
    diamond(d, x, y, 8 * k, GOLD, GOLD_HI, k)
save(with_glow(img), "frame-sq.png")

# ------------------------------------------------ crest.png (72x48)
# Эмблема-делитель: ромб с крыльями.
w, h = 72, 48
img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
cx, cy = w * S / 2, h * S / 2
diamond(d, cx, cy, 11 * k, GOLD, GOLD_HI, k)
d.line([(6 * k, cy), (cx - 20 * k, cy)], fill=GOLD, width=2 * k)
d.line([(cx + 20 * k, cy), (w * S - 6 * k, cy)], fill=GOLD, width=2 * k)
bezier(d, (6 * k, cy - 4 * k), (cx - 24 * k, cy - 10 * k), (cx - 20 * k, cy), GOLD_DK, k)
bezier(d, (w * S - 6 * k, cy - 4 * k), (cx + 24 * k, cy - 10 * k), (cx + 20 * k, cy), GOLD_DK, k)
save(with_glow(img), "crest.png")
