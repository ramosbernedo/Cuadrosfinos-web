#!/usr/bin/env python3
"""Genera el logo de Cuadros Finos (marco con destello) en SVG, con las letras convertidas a trazos.

Uso:  python3 tools/logo.py      (requiere fontTools y brotli: pip install fonttools brotli)
Salida en img/marca/:
- logo-{blanco,negro,dorado}.svg           : horizontal (símbolo + CUADROS / FINOS)
- logo-vertical-{blanco,negro,dorado}.svg  : símbolo arriba, nombre debajo
- simbolo-{blanco,negro,dorado}.svg        : solo el marco con el destello
y img/favicon.svg (versión afinada para 16–32 px).
Los PNG (íconos, perfil de redes) los hace tools/imagenes.py y tools/logo-png.js.
"""
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUENTE = os.path.join(ROOT, "tools", "fuentes", "archivo-variable.woff2")
OUT = os.path.join(ROOT, "img", "marca")
COLORES = {"blanco": "#f3f1ec", "negro": "#0b0b0b", "dorado": "#c9a86a"}
FONDO = "#0b0b0b"

# Símbolo en una caja de 100 × 100: marco de 6 de grosor y destello de cuatro puntas centrado.
MARCO = "M0 0H100V100H0Z M6 6V94H94V6Z"
DESTELLO = ("M50 16C50.7 39 52.6 47.6 71 50C52.6 52.4 50.7 61 50 84"
            "C49.3 61 47.4 52.4 29 50C47.4 47.6 49.3 39 50 16Z")


def instancia(peso):
    f = TTFont(FUENTE)
    return instantiateVariableFont(f, {"wght": peso, "wdth": 112})


NEGRITA, LIVIANA = instancia(700), instancia(300)


def texto(font, palabra, x, base, tam, ancho):
    """Palabra en trazos, desde x hasta x+ancho (reparte el espacio entre letras, como textLength)."""
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    upm = font["head"].unitsPerEm
    s = tam / upm
    nombres = [cmap[ord(c)] for c in palabra]
    avances = [font["hmtx"][n][0] * s for n in nombres]
    hueco = (ancho - sum(avances)) / (len(nombres) - 1)
    trazos, cx = [], x
    for n, av in zip(nombres, avances):
        pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, cx, base)))
        trazos.append(pen.getCommands())
        cx += av + hueco
    return "".join(trazos)


def simbolo(x, y, lado):
    k = lado / 100
    return f'<g transform="translate({x:g} {y:g}) scale({k:g})"><path fill-rule="evenodd" d="{MARCO}"/><path d="{DESTELLO}"/></g>'


def svg(w, h, cuerpo, color, titulo):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" role="img" aria-label="{titulo}">'
            f'<title>{titulo}</title><g fill="{color}">{cuerpo}</g></svg>\n')


def main():
    os.makedirs(OUT, exist_ok=True)
    horizontal = (simbolo(0, 0, 100)
                  + f'<path d="{texto(NEGRITA, "CUADROS", 124, 52, 38, 232)}"/>'
                  + f'<path d="{texto(LIVIANA, "FINOS", 125, 92, 29, 229)}"/>')
    vertical = (simbolo(72, 0, 96)
                + f'<path d="{texto(NEGRITA, "CUADROS", 0, 136, 30, 240)}"/>'
                + f'<path d="{texto(LIVIANA, "FINOS", 1, 172, 23, 238)}"/>')
    for nombre, color in COLORES.items():
        open(os.path.join(OUT, f"logo-{nombre}.svg"), "w").write(svg(356, 100, horizontal, color, "Cuadros Finos"))
        open(os.path.join(OUT, f"logo-vertical-{nombre}.svg"), "w").write(svg(240, 174, vertical, color, "Cuadros Finos"))
        open(os.path.join(OUT, f"simbolo-{nombre}.svg"), "w").write(svg(100, 100, simbolo(0, 0, 100), color, "Cuadros Finos"))
    # Favicon: fondo negro redondeado, marco y destello proporcionalmente más gruesos para que se lean en 16 px.
    fav = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
           f'<rect width="32" height="32" rx="6" fill="{FONDO}"/>'
           f'<rect x="5.2" y="5.2" width="21.6" height="21.6" fill="none" stroke="{COLORES["blanco"]}" stroke-width="2.2"/>'
           f'<path fill="{COLORES["blanco"]}" d="M16 8.4C16.35 14 17.1 15.5 21.6 16C17.1 16.5 16.35 18 16 23.6'
           'C15.65 18 14.9 16.5 10.4 16C14.9 15.5 15.65 14 16 8.4Z"/></svg>\n')
    open(os.path.join(ROOT, "img", "favicon.svg"), "w").write(fav)
    print("logo: ok")


if __name__ == "__main__":
    main()
