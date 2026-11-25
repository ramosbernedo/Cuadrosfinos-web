#!/usr/bin/env python3
"""Genera miniaturas, imágenes para compartir (Open Graph) e íconos.

Uso:  python3 tools/imagenes.py      (requiere Pillow)
- img/cuadros/t/<archivo>.webp : miniatura de 400 px de ancho para el catálogo
- img/og/<slug>.jpg            : 1200×630 para WhatsApp, Facebook y Google
- img/icon-*.png               : íconos de la app y del navegador
Solo regenera lo que falta (usa --todo para rehacer todo).
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(ROOT, "data", "catalogo.json"), encoding="utf-8"))
SRC = os.path.join(ROOT, "img", "cuadros")
TODO = "--todo" in sys.argv
BG, FG, MUTED = (11, 11, 11), (243, 241, 236), (150, 146, 138)


def font(weight, size):
    for p in [f"/usr/share/fonts/opentype/inter/Inter-{weight}.otf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def need(path): return TODO or not os.path.exists(path)


def thumbs():
    os.makedirs(os.path.join(SRC, "t"), exist_ok=True)
    n = 0
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".webp"): continue
        out = os.path.join(SRC, "t", f)
        if not need(out): continue
        im = Image.open(os.path.join(SRC, f)).convert("RGB")
        w = 400 if im.width <= im.height else 560
        im.thumbnail((w, w * 2), Image.LANCZOS)
        im.save(out, "WEBP", quality=78, method=6)
        n += 1
    print("miniaturas:", n)


def framed(img, h):
    """Cuadro con marco negro y sombra, alto h."""
    cx = round(img.width * .015)
    img = img.crop((cx, 0, img.width - cx, img.height))
    ratio = img.width / img.height
    vertical = ratio < 1.05
    fw, fh = (round(h * 29.8 / 37.4), h) if vertical else (round(h * 37.4 / 29.8), h)
    frame = Image.new("RGB", (fw, fh), (14, 14, 14))
    mx, my = (round(fw * .055), round(fh * .044)) if vertical else (round(fw * .044), round(fh * .055))
    iw, ih = fw - 2 * mx, fh - 2 * my
    s = max(iw / img.width, ih / img.height)
    art = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    l, t = (art.width - iw) // 2, (art.height - ih) // 2
    frame.paste(art.crop((l, t, l + iw, t + ih)), (mx, my))
    return frame


def wrap(draw, text, f, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if draw.textlength(test, font=f) <= width: cur = test
        else: lines.append(cur); cur = w
    lines.append(cur)
    return lines


def og_card(pieces, title, line2, price, out):
    W, H = 1200, 630
    im = Image.new("RGB", (W, H), BG)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((60, -120, 700, 760), fill=70)
    im.paste((48, 44, 38), (0, 0), glow.filter(ImageFilter.GaussianBlur(120)))
    fh = 470 if len(pieces) == 1 else 250 if len(pieces) == 3 else 300
    frames = [framed(p, fh) for p in pieces]
    gap = 18
    total = sum(f.width for f in frames) + gap * (len(frames) - 1)
    x0, y0 = max(60, 380 - total // 2), (H - fh) // 2
    shadow = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(shadow)
    x = x0
    for f in frames:
        d.rectangle((x + 10, y0 + 24, x + f.width + 10, y0 + fh + 30), fill=170); x += f.width + gap
    im.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(22)))
    x = x0
    for f in frames:
        im.paste(f, (x, y0)); x += f.width + gap
    tx = min(max(x + 50, 720), W - 440)
    d = ImageDraw.Draw(im)
    d.text((tx, 130), "CUADROS FINOS", font=font("Medium", 20), fill=MUTED)
    size = 46
    while True:
        ft = font("SemiBold", size)
        lines = wrap(d, title.upper(), ft, W - tx - 50)
        if len(lines) <= 3 or size <= 30: break
        size -= 4
    y = 176
    for ln in lines[:3]:
        d.text((tx, y), ln, font=ft, fill=FG); y += round(size * 1.2)
    y += 14
    for ln in wrap(d, line2, font("Regular", 24), W - tx - 50)[:3]:
        d.text((tx, y), ln, font=font("Regular", 24), fill=MUTED); y += 32
    if price:
        d.text((tx, min(y + 20, H - 150)), price, font=font("SemiBold", 40), fill=FG)
    d.text((tx, H - 88), "Hecho en Lima · Envío a todo el Perú", font=font("Regular", 20), fill=MUTED)
    im.save(out, "JPEG", quality=84, optimize=True, progressive=True)


def ogs():
    os.makedirs(os.path.join(ROOT, "img", "og"), exist_ok=True)
    P = CAT["config"]["precio"]
    n = 0
    for x in CAT["productos"]:
        out = os.path.join(ROOT, "img", "og", x["s"] + ".jpg")
        if not need(out): continue
        k = 3 if x["o"] == "triptico" else 2 if x["o"] == "diptico" else 1
        files = [f"{x['s']}.webp"] if k == 1 else [f"{x['s']}-{i + 1}.webp" for i in range(k)]
        if not x.get("i"):
            pieces = [Image.new("RGB", (600, 780), (34, 34, 34))]
        else:
            pieces = [Image.open(os.path.join(SRC, f)).convert("RGB") for f in files]
        precio = None if x.get("q") else (P["triptico"] if k == 3 else P["diptico"] if k == 2 else P["pieza"]) + (P["personalizar"] if x.get("p") else 0)
        og_card(pieces, x["n"], x["f"], f"S/ {precio}" if precio else "Cotiza por WhatsApp", out)
        n += 1
    out = os.path.join(ROOT, "img", "og", "inicio.jpg")
    if need(out):
        og_card([Image.open(os.path.join(SRC, "leon-fuerza.webp")).convert("RGB")], "Cuadros que dicen quién vive aquí",
                f"{len(CAT['productos'])} cuadros en blanco y negro con marco, hechos a pedido en Lima.", f"Desde S/ {P['pieza']}", out)
        n += 1
    print("imágenes para compartir:", n)


def icons():
    for s in (180, 192, 512):
        out = os.path.join(ROOT, "img", f"icon-{s}.png")
        if not need(out): continue
        im = Image.new("RGB", (s, s), BG)
        d = ImageDraw.Draw(im)
        u = s / 32
        d.rectangle((9.5 * u, 6 * u, 22.5 * u, 26 * u), outline=FG, width=max(2, round(2.6 * u)))
        d.rectangle((13 * u, 9.6 * u, 19 * u, 22.4 * u), fill=(154, 150, 143))
        im.save(out, "PNG", optimize=True)
    print("íconos: ok")


def ambiente():
    """Miniaturas de 520 px de las fotos de ambiente (img/ambiente/t/)."""
    d = os.path.join(ROOT, "img", "ambiente")
    os.makedirs(os.path.join(d, "t"), exist_ok=True)
    n = 0
    for f in sorted(os.listdir(d)):
        if not f.endswith(".webp"): continue
        out = os.path.join(d, "t", f)
        if not need(out): continue
        im = Image.open(os.path.join(d, f)).convert("RGB")
        im.thumbnail((520, 520), Image.LANCZOS)
        im.save(out, "WEBP", quality=76, method=6); n += 1
    print("ambiente:", n)


if __name__ == "__main__":
    thumbs(); ogs(); icons(); ambiente()
