#!/usr/bin/env python3
"""Dibuja el cuadro «Círculo de transmutación» (img/cuadros/circulo-de-transmutacion.webp).

Diseño original con simbología alquímica clásica (de dominio público):
la cuadratura del círculo (círculo, cuadrado, triángulo, círculo), un heptagrama
de los siete metales y un anillo con los planetas, los cuatro elementos y la sal.
Uso:  python3 tools/alquimia.py      (requiere Pillow)
"""
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "img", "cuadros", "circulo-de-transmutacion.webp")
W, H, S = 600, 900, 4                      # lienzo final y sobremuestreo
BG, FG = (12, 12, 12), (226, 220, 206)
CX, CY = W / 2, H / 2

img = Image.new("RGB", (W * S, H * S), BG)
d = ImageDraw.Draw(img)


def p(x, y): return (x * S, y * S)
def polar(r, a, cx=CX, cy=CY): return (cx + r * math.cos(a), cy + r * math.sin(a))


def circle(cx, cy, r, w=1.6, fill=None):
    d.ellipse([p(cx - r, cy - r), p(cx + r, cy + r)], outline=FG, width=round(w * S), fill=fill)


def line(a, b, w=1.6): d.line([p(*a), p(*b)], fill=FG, width=round(w * S))


def poly(pts, w=1.6): d.line([p(*q) for q in pts + pts[:1]], fill=FG, width=round(w * S), joint="curve")


def arc(cx, cy, r, a0, a1, w=1.4):
    d.arc([p(cx - r, cy - r), p(cx + r, cy + r)], a0, a1, fill=FG, width=round(w * S))


def tri(cx, cy, r, up=True, bar=False, w=1.4):
    s = -1 if up else 1
    pts = [polar(r, math.radians(-90 * -s + 120 * k) if False else math.radians((-90 if up else 90) + 120 * k), cx, cy) for k in range(3)]
    poly(pts, w)
    if bar:
        y = cy + s * -r * .05
        line((cx - r * .75, y), (cx + r * .75, y), w)


# ---- Símbolos (dibujados con trazos, tamaño ~ r) -------------------------------
def sol(x, y, r):      circle(x, y, r * .7, 1.4); circle(x, y, r * .12, 1, FG)
def luna(x, y, r):     arc(x, y, r * .7, 60, 300); arc(x + r * .35, y, r * .55, 100, 260)
def cruz(x, y, r, w=1.4): line((x, y - r * .45), (x, y + r * .45), w); line((x - r * .3, y), (x + r * .3, y), w)
def venus(x, y, r):    circle(x, y - r * .3, r * .4, 1.4); cruz(x, y + r * .55, r * .7)
def marte(x, y, r):
    circle(x - r * .15, y + r * .15, r * .42, 1.4)
    a, b = (x + r * .15, y - r * .15), (x + r * .6, y - r * .6)
    line(a, b, 1.4); line(b, (b[0] - r * .35, b[1]), 1.4); line(b, (b[0], b[1] + r * .35), 1.4)
def mercurio(x, y, r):
    circle(x, y - r * .05, r * .32, 1.4); arc(x, y - r * .62, r * .3, 20, 160); cruz(x, y + r * .6, r * .6)
def jupiter(x, y, r):
    arc(x - r * .1, y - r * .25, r * .35, 180, 360 + 40)
    line((x - r * .45, y + r * .2), (x + r * .5, y + r * .2), 1.4)
    line((x + r * .3, y - r * .7), (x + r * .3, y + r * .7), 1.4)
def saturno(x, y, r):
    line((x - r * .2, y - r * .75), (x - r * .2, y + r * .2), 1.4)
    line((x - r * .5, y - r * .5), (x + r * .1, y - r * .5), 1.4)
    arc(x + r * .1, y + r * .2, r * .3, 180, 400)
def sal(x, y, r):      circle(x, y, r * .62, 1.4); line((x - r * .62, y), (x + r * .62, y), 1.4)
def fuego(x, y, r):    tri(x, y, r * .7, True)
def agua(x, y, r):     tri(x, y, r * .7, False)
def aire(x, y, r):     tri(x, y, r * .7, True, True)
def tierra(x, y, r):   tri(x, y, r * .7, False, True)

ANILLO = [sol, fuego, luna, aire, mercurio, sal, venus, agua, marte, tierra, jupiter, saturno]
METALES = [sol, luna, mercurio, venus, marte, jupiter, saturno]

# ---- Anillo exterior ----------------------------------------------------------
R1, R2, R3 = 262, 238, 228
circle(CX, CY, R1 + 8, 1)
circle(CX, CY, R1, 2.2)
circle(CX, CY, R2, 1.4)
circle(CX, CY, R3, 2)
for k in range(120):                                  # graduación fina
    a = math.radians(k * 3)
    line(polar(R1 + 8, a), polar(R1 + (14 if k % 10 == 0 else 11), a), 1)
mid = (R1 + R2) / 2
for k, f in enumerate(ANILLO):                         # doce símbolos en el anillo
    a = math.radians(-90 + 30 * k)
    f(*polar(mid, a), 10)
    b = a + math.radians(15)
    circle(*polar(mid, b), 1.6, 1, FG)

# ---- Heptagrama de los siete metales ------------------------------------------
v = [polar(R3, math.radians(-90 + 360 / 7 * k)) for k in range(7)]
for k in range(7):
    line(v[k], v[(k + 3) % 7], 1.4)
    line(v[k], v[(k + 2) % 7], .9)
for k, f in enumerate(METALES):
    x, y = v[k]
    circle(x, y, 17, 1.8, BG)
    circle(x, y, 13, .9)
    f(x, y, 9)

# ---- Cuadratura del círculo ---------------------------------------------------
RC = 150
circle(CX, CY, RC, 2)
side = RC * math.sqrt(2)
sq = [(CX - side / 2, CY - side / 2), (CX + side / 2, CY - side / 2), (CX + side / 2, CY + side / 2), (CX - side / 2, CY + side / 2)]
d.polygon([p(*q) for q in sq], fill=BG)
poly(sq, 2)
for q in sq: circle(*q, 4, 1.4, BG)
ri = side / 2
circle(CX, CY, ri, 1.4)
t = [polar(ri, math.radians(-90 + 120 * k)) for k in range(3)]
poly(t, 2)
rt = ri / 2
circle(CX, CY, rt, 1.6)
for q in t: circle(*q, 3.2, 1.2, BG)

# ---- Centro: el sol, la piedra ------------------------------------------------
for k in range(16):                                    # rayos
    a = math.radians(k * 22.5)
    line(polar(rt * .48, a), polar(rt * (.85 if k % 2 == 0 else .7), a), 1)
circle(CX, CY, rt * .4, 1.6, BG)
circle(CX, CY, rt * .09, 1, FG)

# ---- Arriba y abajo: Mercurio y Sal como sellos --------------------------------
for y, f in [(CY - 340, mercurio), (CY + 340, sal)]:
    line((CX, y + (22 if y < CY else -22)), (CX, CY + (-(R1 + 16) if y < CY else R1 + 16)), 1)
    circle(CX, y, 22, 1.4)
    f(CX, y, 13)

img = img.resize((W, H), Image.LANCZOS)
img.save(OUT, "WEBP", quality=90, method=6)
print("listo:", OUT)
