#!/usr/bin/env python3
"""Genera el sitio estático de Cuadros Finos a partir de data/catalogo.json.

Uso:  python3 tools/build.py
Crea: index.html, 404.html, cuadro/<slug>/index.html, una página por colección y ambiente,
      data.js, sitemap.xml, robots.txt, llms.txt, llms-full.txt, manifest.webmanifest y _headers.
Para cambiar de dominio, edita config.sitio en data/catalogo.json y vuelve a ejecutarlo.
"""
import datetime, hashlib, html, json, os, re, shutil, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(ROOT, "data", "catalogo.json"), encoding="utf-8"))
C = CAT["config"]
SITE = C["sitio"].rstrip("/")
P = C["precio"]
HOY = datetime.date.today().isoformat()
PRODS = CAT["productos"]
for i, x in enumerate(PRODS):
    x["idx"] = i
BY = {x["s"]: x for x in PRODS}
COLS = CAT["colecciones"]
PORTADA = CAT["portada"]
PAREDES = CAT["paredes"]
COL = {c["id"]: c for c in COLS}
VIRT = CAT["virtuales"]
AMB = CAT["ambientes"]
AMB_BY = {a["id"]: a for a in AMB}

e = lambda s: html.escape(str(s), quote=True)
soles = lambda n: f"S/ {n:,}".replace(",", ",")


def piezas(x): return 3 if x["o"] == "triptico" else 2 if x["o"] == "diptico" else 1
def es_h(x): return x["o"] in ("horizontal", "panoramico")
def precio(x):
    if x.get("q"): return None
    return P["triptico"] if x["o"] == "triptico" else P["diptico"] if x["o"] == "diptico" else P["pieza"]
def precio_total(x):
    b = precio(x)
    return None if b is None else b + (P["personalizar"] if x.get("p") else 0)
def medida(x):
    if x["o"] == "triptico": return "Tríptico 3 × (30 × 37 cm) con marco"
    if x["o"] == "diptico": return "Díptico 2 × (30 × 37 cm) con marco"
    return "37 × 30 cm con marco (horizontal)" if es_h(x) else "30 × 37 cm con marco"
def sub_nombre(x):
    for k, n in COL[x["c"]]["subs"]:
        if k == x["u"]: return n
    return ""
def purl(x): return f"/cuadro/{x['s']}/"
def img_main(x): return f"/img/cuadros/{x['s']}.webp" if piezas(x) == 1 else f"/img/cuadros/{x['s']}-1.webp"
def img_og(x): return f"/img/og/{x['s']}.jpg"
def ambientes_txt(x): return ", ".join(a.capitalize() for a in x["a"])
def rank(x):
    return (0 if x.get("t") else 10) + (0 if x.get("nw") else 3) + (0 if x.get("i") else 20) + (15 if x["c"] == "papa" else 0) + x["idx"] / 100
VFILTRO = {"top": lambda x: x.get("t"), "nuevos": lambda x: x.get("nw"), "personalizados": lambda x: x.get("p")}


def precio_txt(x):
    t = precio_total(x)
    return "Cotizar" if t is None else ("Desde " if x.get("p") else "") + soles(precio(x))


def descripcion(x):
    """Texto natural de cada cuadro (sirve para la ficha, Google y asistentes de IA)."""
    col = COL[x["c"]]
    partes = [f"{x['f']}"]
    if x["o"] == "triptico":
        partes.append("Tríptico de tres cuadros de 30 × 37 cm con marco negro, unos 98 cm de ancho colgados con separación.")
    elif x["o"] == "diptico":
        partes.append("Díptico de dos cuadros de 30 × 37 cm con marco negro, unos 64 cm de ancho.")
    else:
        partes.append(f"Cuadro de {'37 × 30' if es_h(x) else '30 × 37'} cm con marco negro, impreso y armado a pedido en Lima, listo para colgar.")
    partes.append(f"De la colección {col['nombre']}{(' · ' + sub_nombre(x)) if sub_nombre(x) and len(col['subs']) > 1 else ''}; va bien en {ambientes_txt(x).lower()}.")
    if x.get("p"):
        partes.append(f"Personalizable ({x['p'].lower()}): te enviamos la vista previa por WhatsApp antes de imprimir.")
    t = precio_total(x)
    partes.append("Precio a cotizar por WhatsApp." if t is None else f"Precio: {soles(t)}. Envío a todo el Perú.")
    return " ".join(partes)


def meta_desc(x):
    t = precio_total(x)
    p = "Cotiza por WhatsApp" if t is None else soles(t)
    s = f"{x['n']}: {x['f']} {medida(x)}, listo para colgar. {p}. Hecho a pedido en Lima, envío a todo el Perú."
    return s if len(s) <= 165 else s[:162].rsplit(" ", 1)[0] + "…"


# ---------- piezas de HTML que replica app.js ----------
def pf(x, lazy=True, thumb=False, scene=False):
    ld = ' loading="lazy" decoding="async"' if lazy else ""
    base = "/img/cuadros/t/" if thumb else "/img/cuadros/"
    n = piezas(x)
    if n > 1:
        inner = "".join(
            f'<span class="pf"><img src="{base}{x["s"]}-{i + 1}.webp" alt="{e(x["n"]) + " (panel " + str(i + 1) + ")" }"{ld}></span>'
            for i in range(n))
        return inner if scene else f'<span class="set">{inner}</span>'
    cls = "pf" + (" pf--h" if es_h(x) else "")
    if not x.get("i"):
        return f'<span class="{cls}"><span class="ph"><b>{e(x["n"])}</b><i>Vista previa<br>por WhatsApp</i></span></span>'
    return f'<span class="{cls}"><img src="{base}{x["s"]}.webp" alt="{e(x["n"])} — cuadro con marco negro"{ld}></span>'


def card(x, mini=False):
    tag = ('<span class="tag">Más pedido</span>' if x.get("t") else '<span class="tag tag--ghost">Nuevo</span>' if x.get("nw")
           else '<span class="tag tag--ghost">Personalizable</span>' if x.get("p") else "")
    add = "" if (x.get("q") or mini) else f'<button class="card__add" data-add="{x["s"]}" aria-label="Agregar a mi selección: {e(x["n"])}">+</button>'
    frase = "" if mini else f'<p>{e(x["f"])}</p>'
    return (f'<article class="card{"" if mini else " rv"}" data-s="{x["s"]}"><div class="card__stage">{tag}{pf(x, thumb=True)}{add}</div>'
            f'<h3>{e(x["n"])}</h3>{frase}<span class="card__price">{precio_txt(x)}</span>'
            f'<a class="card__open" href="{purl(x)}" aria-label="Ver {e(x["n"])}"></a></article>')


def jsonld(obj): return f'<script type="application/ld+json">{json.dumps(obj, ensure_ascii=False, separators=(",", ":"))}</script>'


def h(path=""): return SITE + path


# ---------- recursos con versión (caché larga) ----------
def ver(f):
    return hashlib.md5(open(os.path.join(ROOT, f), "rb").read()).hexdigest()[:8]


ORG = {
    "@type": ["Store", "LocalBusiness"], "@id": h("/#tienda"), "name": C["marca"], "url": h("/"),
    "image": h("/img/og/inicio.jpg"), "logo": h("/img/icon-512.png"),
    "telephone": "+" + C["whatsapp"], "priceRange": f"S/ {P['pieza']} – S/ {P['triptico']}",
    "currenciesAccepted": "PEN", "paymentAccepted": "Yape, Plin, transferencia, tarjeta",
    "address": {"@type": "PostalAddress", "addressLocality": "Lima", "addressRegion": "Lima", "addressCountry": "PE"},
    "areaServed": {"@type": "Country", "name": "Perú"},
    "description": "Cuadros en blanco y negro con marco negro, hechos a pedido en Lima y enviados a todo el Perú. Pedidos por WhatsApp.",
    "contactPoint": {"@type": "ContactPoint", "telephone": "+" + C["whatsapp"], "contactType": "sales", "availableLanguage": "es", "areaServed": "PE"},
}


def head(title, desc, path, og_img="/img/og/inicio.jpg", ld=(), preload="", og_type="website", robots="index,follow"):
    t = title if (C["marca"] in title or len(title) > 60) else f"{title} | {C['marca']}"
    return f'''<!doctype html>
<html lang="es-PE">
<head>
  <meta charset="utf-8">
  {f'<meta name="google-site-verification" content="{C["medicion"]["googleVerificacion"]}">' if C.get("medicion", {}).get("googleVerificacion") else ""}
  <script>if(location.hostname==="cuadrosfinos.pages.dev")location.replace("https://cuadrosfinos.plantify.pe"+location.pathname+location.search+location.hash)</script>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{e(t)}</title>
  <meta name="description" content="{e(desc)}">
  <meta name="robots" content="{robots},max-image-preview:large">
  <link rel="canonical" href="{h(path)}">
  <link rel="alternate" hreflang="es-PE" href="{h(path)}">
  <meta name="geo.region" content="PE-LIM"><meta name="geo.placename" content="Lima, Perú">
  <meta property="og:site_name" content="{C['marca']}">
  <meta property="og:locale" content="es_PE">
  <meta property="og:type" content="{og_type}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{h(path)}">
  <meta property="og:image" content="{h(og_img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#0b0b0b">
  <link rel="icon" href="/img/favicon.svg?v={ver('img/favicon.svg')}" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/img/icon-180.png?v={ver('img/icon-180.png')}">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@112,300;112,400;112,500&family=Cormorant+Garamond:ital,wght@0,500;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/styles.css?v={ver('styles.css')}">
  {preload}
  {"".join(jsonld(o) for o in ld)}
</head>'''


NAV = [("/cuadros-para-sala/", "Sala"), ("/cuadros-para-dormitorio/", "Dormitorio"), ("/cuadros-para-oficina/", "Oficina"), ("/cuadros-religiosos/", "Religiosos"), ("/cuadros-personalizados/", "Personalizados"), ("/#catalogo", "Todos")]


def header(page):
    links = "".join(f'<a href="{u}">{n}</a>' for u, n in NAV)
    return f'''<body data-page="{page["tipo"]}"{"".join(f' data-{k}="{e(v)}"' for k, v in page.get("data", {}).items())}>
  <a class="skip" href="#main">Saltar al contenido</a>
  <div class="topbar"><div class="wrap topbar__in"><span>Hechos a pedido en Lima · Envío a todo el Perú</span><span class="topbar__r">Si llega dañado, se repone</span></div></div>
  <header class="nav" id="nav">
    <div class="wrap nav__in">
      <a href="/" class="brand" aria-label="{C['marca']}, inicio"><img class="brand__logo" src="/img/marca/logo-blanco.svg?v={ver('img/marca/logo-blanco.svg')}" alt="" width="157" height="40"></a>
      <nav class="nav__links" id="navLinks" aria-label="Principal">{links}</nav>
      <div class="nav__actions">
        <button class="icon-btn" id="openSearch" aria-label="Buscar cuadro" aria-keyshortcuts="/"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button>
        <button class="icon-btn" id="openBag" aria-label="Mi selección" aria-controls="bag"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16"/><rect x="8" y="8" width="8" height="8"/></svg><span class="badge" id="bagCount" hidden>0</span></button>
        <button class="nav__toggle" id="navToggle" aria-label="Abrir menú" aria-expanded="false" aria-controls="navLinks"><span></span><span></span></button>
      </div>
    </div>
  </header>'''


def footer():
    cols = "".join(f'<a href="/{c["url"]}/">{e(c["nombre"])}</a>' for c in COLS)
    amb = "".join(f'<a href="/{a["url"]}/">Cuadros para {a["nombre"].lower()}</a>' for a in AMB)
    return f'''
  <footer class="footer">
    <div class="wrap footer__grid">
      <div class="footer__brand">
        <a href="/" class="brand"><img class="brand__logo" src="/img/marca/logo-blanco.svg?v={ver('img/marca/logo-blanco.svg')}" alt="{C['marca']}" width="157" height="40" loading="lazy"></a>
        <p>Cuadros en blanco y negro con marco, hechos a pedido en Lima y enviados a todo el Perú.</p>
      </div>
      <nav aria-label="Colecciones"><h2 class="footer__h">Colecciones</h2>{cols}<a href="/cuadros-personalizados/">Personalizados</a><a href="/mas-pedidos/">Más pedidos</a><a href="/nuevos/">Nuevos</a></nav>
      <nav aria-label="Ambientes"><h2 class="footer__h">Por ambiente</h2>{amb}</nav>
      <div><h2 class="footer__h">Ayuda</h2>
        <a href="/#como">Cómo se pide y envíos</a>
        <a href="/#faq">Preguntas frecuentes</a>
        <a href="#" data-wa="Hola, quiero cotizar cuadros para mi empresa u oficina.">Ventas corporativas</a>
        <a href="#" data-wa="Hola, quiero hacer un pedido de cuadros.">WhatsApp {C['whatsappVisible']}</a>
        <span>Lima, Perú · envíos a todo el país</span>
      </div>
    </div>
    <div class="wrap footer__bottom"><span>© {datetime.date.today().year} {C['marca']}</span><span class="pay"><b>Visa</b><b>Mastercard</b><b>Yape</b><b>Plin</b></span></div>
  </footer>'''


def room_for(x):
    """Ambiente inicial de la vista en pared según dónde va bien el cuadro."""
    for a in x["a"]:
        if a in PAREDES: return a
    return "estudio" if "oficina" in x["a"] else "sala"


def scene_html(x, room, lazy=True, ident=False, thumb=False):
    """Cuadro colocado a escala sobre una foto real de pared vacía."""
    w = PAREDES[room]
    art = pf(x, lazy=lazy, thumb=thumb, scene=True) if x else ""
    meas = ("" if not x else "≈ 98 cm de ancho" if x["o"] == "triptico" else "≈ 64 cm de ancho" if x["o"] == "diptico" else "37 × 30 cm" if es_h(x) else "30 × 37 cm")
    ids = (' id="pScene"', ' id="pSceneBg"', ' id="pSceneArt"', ' id="pMeasure"') if ident else ("", "", "", "")
    ld = ' loading="lazy"' if lazy else ""
    return (f'<div class="scene"{ids[0]} style="--cx:{w["cx"]};--cy:{w["cy"]};--cm:{w["cm"]};--gap:{w["gap"]}">'
            f'<img class="scene__bg"{ids[1]} src="/img/ambiente/{w["img"]}.webp" alt="Pared de {w["nombre"].lower()} con el cuadro a escala"{ld}>'
            f'<div class="scene__art"{ids[2]}>{art}</div><span class="scene__measure"{ids[3]}>{meas}</span></div>')


def fotos(x):
    return list(x.get("fotos") or []) + ([[f"detalle-{x['s']}", "El marco negro de cerca"]] if x.get("i") else [])


def views_html(x):
    """Miniaturas: la obra, la vista en pared y las fotos reales."""
    obra = f'/img/cuadros/t/{x["s"]}.webp' if piezas(x) == 1 else f'/img/cuadros/t/{x["s"]}-1.webp'
    thumb_obra = f'<img src="{obra}" alt="" loading="lazy">' if x.get("i") else '<span class="view__ph"></span>'
    out = [f'<button class="view is-on" role="tab" id="tabObra" aria-selected="true" aria-controls="pStage" data-tab="obra">{thumb_obra}<span>Obra</span></button>',
           f'<button class="view" role="tab" id="tabPared" aria-selected="false" aria-controls="pWall" data-tab="pared"><img src="/img/ambiente/t/pared-{room_for(x)}.webp" alt="" loading="lazy"><span>En tu pared</span></button>',
           f'<button class="view view--3d" role="tab" aria-selected="false" aria-controls="p3d" data-tab="3d"><span class="view__3d" aria-hidden="true">3D</span><span>3D · AR</span></button>']
    for f, alt in fotos(x):
        out.append(f'<button class="view" role="tab" aria-selected="false" aria-controls="pPhoto" data-tab="foto" data-src="/img/ambiente/{f}.webp" data-alt="{e(alt)}"><img src="/img/ambiente/t/{f}.webp" alt="" loading="lazy"><span class="sr">{e(alt)}</span></button>')
    return "".join(out)


def pd_markup(x=None, page=False):
    """Ficha del cuadro. Vacía dentro del diálogo; llena en /cuadro/<slug>/."""
    g = lambda f, d="": f(x) if x else d
    stage = g(lambda x: pf(x, lazy=False))
    scene_art = g(lambda x: pf(x, lazy=False, scene=True))
    measure = g(lambda x: "≈ 98 cm de ancho" if x["o"] == "triptico" else "≈ 64 cm de ancho" if x["o"] == "diptico" else "37 × 30 cm" if es_h(x) else "30 × 37 cm")
    col = g(lambda x: f"Colección {COL[x['c']]['nombre']}" + (f" · {sub_nombre(x)}" if sub_nombre(x) and len(COL[x['c']]['subs']) > 1 else ""))
    price = g(lambda x: "Cotiza por WhatsApp" if precio_total(x) is None else soles(precio_total(x)))
    note = g(lambda x: "Recuerdo de la visita del Papa: precio a consultar." if x.get("q") else
             (f"Incluye personalización (+ {soles(P['personalizar'])}). Marco negro y envío protegido." if x.get("p") else f"{medida(x)}. Listo para colgar."))
    fields = g(lambda x: "".join(
        f'<label class="field"><span>{e(l)}</span><input name="f{i}" data-label="{e(l)}" placeholder="{e(ph)}"{"" if "opcional" in l.lower() else " required"}></label>'
        for i, (l, ph) in enumerate(x.get("k") or [])))
    title_tag = "h1" if page else "h2"
    desc = g(lambda x: f'<p class="pd__desc">{e(descripcion(x))}</p>') if page else '<p class="pd__desc" id="pDesc" hidden></p>'
    return f'''
    <div class="pd">
      <div class="pd__media">
        <div class="pd__stage" id="pStage" role="tabpanel" aria-labelledby="tabObra">{stage}</div>
        <figure class="pd__photo" id="pPhoto" role="tabpanel" hidden><img id="pPhotoImg" alt=""><figcaption id="pPhotoCap"></figcaption></figure>
        <div class="pd__wall" id="pWall" role="tabpanel" aria-labelledby="tabPared" hidden>
          {scene_html(x, g(lambda x: room_for(x), "sala"), lazy=True, ident=True)}
          <div class="wall-ctrl">
            <div class="seg" id="sceneRoom" role="radiogroup" aria-label="Ambiente">{"".join(f'<button role="radio" aria-checked="{str(k == g(room_for, "sala")).lower()}" data-v="{k}">{e(v["nombre"])}</button>' for k, v in PAREDES.items())}</div>
            <p class="wall-note">Foto real a escala: cada cuadro mide {g(lambda x: "37 × 30" if es_h(x) else "30 × 37", "30 × 37")} cm.</p>
          </div>
        </div>
        <div class="pd__3d" id="p3d" role="tabpanel" aria-label="Cuadro en 3D" hidden>
          <div class="mv-wrap" id="mvWrap"><p class="mv-loading">Cargando el cuadro en 3D…</p></div>
          <p class="wall-note" id="p3dNote">Gíralo con el dedo o el mouse. En el celular, toca <b>Ver en mi pared</b> y apunta la cámara a la pared: aparece a tamaño real.</p>
        </div>
        <button class="zoom-btn" id="pZoom" aria-label="Ampliar imagen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>
        <div class="views" id="pViews" role="tablist" aria-label="Vistas del cuadro">{g(views_html)}</div>
      </div>
      <div class="pd__info">
        <p class="kicker" id="pCol">{e(col)}</p>
        <{title_tag} id="pTitle">{e(g(lambda x: x["n"]))}</{title_tag}>
        <p class="pd__phrase" id="pPhrase">{e(g(lambda x: x["f"]))}</p>
        <p class="pd__price" id="pPrice">{price}</p>
        <p class="muted small" id="pPriceNote">{e(note)}</p>
        <form class="pd__opt" id="pFields"{"" if (x and x.get("p")) else " hidden"}>
          <p class="label">Personalización <span class="muted">+ {soles(P["personalizar"])}</span></p>
          <div id="pFieldList">{fields}</div>
          <p class="muted small" id="pPersNote">Mira la vista previa mientras escribes. Te mandamos la final por WhatsApp antes de imprimir.</p>
        </form>
        <div class="pd__buy" id="pBuy">
          <button class="btn btn--light btn--block" id="pAdd"{" hidden" if (x and x.get("q")) else ""}>Agregar a mi selección</button>
          <a class="btn btn--wa btn--block" id="pWa" href="{e(wa_url(f"Hola, me interesa el cuadro {x['n']} ({h('/cuadro/' + x['s'] + '/')})." if x else "Hola, quiero hacer un pedido de cuadros."))}" target="_blank" rel="noopener">{"Cotizar por WhatsApp" if (x and x.get("q")) else "Pedir este por WhatsApp"}</a>
        </div>
        <div class="share" id="pShareBox">
          <p class="label">Compartir este cuadro</p>
          <div class="share__row">
            <a class="share__btn share__btn--wa" id="shWa" href="#" target="_blank" rel="noopener" aria-label="Compartir por WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true" class="fill"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 2 6.9L3 29l6.6-2.2c2 1.1 4.2 1.7 6.4 1.7 7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1.3 1.3-3.8-.3-.4a10.4 10.4 0 1 1 9 4.7z"/></svg>WhatsApp</a>
            <a class="share__btn" id="shFb" href="#" target="_blank" rel="noopener" aria-label="Compartir en Facebook"><svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M13.6 21v-7.4h2.5l.4-3h-2.9V8.8c0-.9.3-1.4 1.5-1.4h1.5V4.7c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.2H8.2v3h2.5V21z"/></svg>Facebook</a>
            <button class="share__btn" id="shCopy" type="button"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/></svg><span>Copiar enlace</span></button>
            <button class="share__btn" id="pShare" type="button" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v7h14v-7"/></svg>Más</button>
          </div>
        {desc}
        <dl class="pd__specs">
          <div><dt>Medida</dt><dd id="pSize">{e(g(medida, "30 × 37 cm con marco"))}</dd></div>
          <div><dt>Marco</dt><dd>Negro, listo para colgar</dd></div>
          <div><dt>Va bien en</dt><dd id="pRooms">{e(g(ambientes_txt))}</dd></div>
          <div><dt>Entrega</dt><dd>{C['entrega']}</dd></div>
          <div><dt>Garantía</dt><dd>Si llega dañado, se repone</dd></div>
        </dl>
        </div>
      </div>
    </div>'''


def overlays(with_product_dialog=False):
    pdlg = f'''
  <dialog class="modal" id="product" aria-labelledby="pTitle">
    <button class="modal__close" data-close aria-label="Cerrar">×</button>
    {pd_markup()}
    <div class="pd__related"><p class="kicker">Combinan con este</p><div class="cards cards--mini" id="pRelated"></div><a class="link-arrow" id="pPage" href="/">Ver la página del cuadro</a></div>
  </dialog>''' if with_product_dialog else ""
    return f'''
  <a class="wa-float" href="#" data-wa="Hola, quiero ayuda con un cuadro." aria-label="Escríbenos por WhatsApp"><svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true" class="fill"><path d="M16 3C9 3 3.3 8.7 3.3 15.7c0 2.5.7 4.8 2 6.9L3 29l6.6-2.2c2 1.1 4.2 1.7 6.4 1.7 7 0 12.7-5.7 12.7-12.7S23 3 16 3zm0 23.2c-2 0-4-.6-5.7-1.6l-.4-.2-3.9 1.3 1.3-3.8-.3-.4a10.4 10.4 0 1 1 9 4.7zm5.7-7.8c-.3-.2-1.8-.9-2.1-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.5 8.5 0 0 1-4.2-3.7c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1 2.1 3.2 5.1 4.5c1.9.8 2.6.9 3.6.7.6-.1 1.8-.7 2-1.4s.3-1.3.2-1.4l-.5-.3z"/></svg></a>
  {pdlg}
  <aside class="drawer" id="bag" aria-hidden="true" inert>
    <div class="drawer__panel" role="dialog" aria-modal="true" aria-labelledby="bagTitle">
      <header class="drawer__head"><h2 id="bagTitle">Mi selección</h2><button class="modal__close" data-close-bag aria-label="Cerrar selección">×</button></header>
      <div class="drawer__body" id="bagList"></div>
      <footer class="drawer__foot" id="bagFoot" hidden>
        <form class="bag-form" id="bagForm" autocomplete="on">
          <label class="field"><span>Distrito o ciudad de entrega</span><input name="lugar" id="bagLugar" placeholder="Ej.: Surco, Lima · Arequipa" autocomplete="address-level2"></label>
          <label class="field"><span>Forma de pago</span><select name="pago" id="bagPago"><option value="">Lo veo por WhatsApp</option><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Tarjeta</option></select></label>
          <label class="check"><input type="checkbox" id="bagRegalo"> <span>Es para regalo</span></label>
        </form>
        <div class="bag-total"><span>Total</span><strong id="bagTotal">S/ 0</strong></div>
        <p class="muted small">Envío y pago se confirman por WhatsApp. No pagas nada en la web.</p>
        <a class="btn btn--wa btn--block" id="bagWa" href="{e(wa_url("Hola, quiero hacer un pedido de cuadros."))}" target="_blank" rel="noopener">Enviar pedido por WhatsApp</a>
        <button class="link-btn small" id="bagShare">Compartir mi selección</button>
      </footer>
    </div>
    <div class="drawer__scrim" data-close-bag></div>
  </aside>
  <dialog class="modal modal--quiz" id="quiz" aria-labelledby="qTitle">
    <button class="modal__close" data-close aria-label="Cerrar">×</button>
    <div class="quiz"><p class="kicker" id="qStep">Paso 1 de 3</p><h2 id="qTitle">¿Para qué pared es?</h2><div class="quiz__opts" id="qOpts"></div><div class="quiz__res" id="qRes" hidden></div></div>
  </dialog>
  <dialog class="modal modal--search" id="search" aria-label="Buscar cuadros">
    <form class="search search--big" role="search" action="/" method="get">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <label class="sr" for="sq">Buscar</label><input type="search" id="sq" name="q" placeholder="¿Qué buscas? león, fe, mar, abogado…" autocomplete="off">
    </form>
    <div class="search__res" id="sRes" role="list"></div>
  </dialog>
  <dialog class="zoom" id="zoom" aria-label="Imagen ampliada"><button class="modal__close" data-close aria-label="Cerrar">×</button><div class="zoom__stage" id="zoomStage"><img id="zoomImg" alt=""></div><p class="zoom__hint">Toca la imagen para acercar</p></dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <script src="/data.js?v={ver('data.js')}-2" defer></script>
  <script src="/personaliza.js?v={ver('personaliza.js')}" defer></script>
  <script src="/medicion.js?v={ver('medicion.js')}" defer></script>
  <script src="/app.js?v={ver('app.js')}" defer></script>
</body>
</html>
'''


def catalog_section(title, kicker, items, preset_col="", preset_room="", h_tag="h2"):
    chips = [("", "Todos", len(PRODS))] + [(v["id"], v["nombre"], len([x for x in PRODS if VFILTRO[v["id"]](x)])) for v in VIRT] + \
            [(c["id"], c["nombre"], len([x for x in PRODS if x["c"] == c["id"]])) for c in COLS]
    chip_html = "".join(f'<button class="chip" role="tab" data-col="{i}" aria-selected="{"true" if i == preset_col else "false"}">{e(n)}<small>{k}</small></button>' for i, n, k in chips)
    opts = "".join(f'<option value="{a["id"]}"{" selected" if a["id"] == preset_room else ""}>{a["nombre"]}</option>' for a in AMB)
    items = sorted(items, key=rank)
    return f'''
    <section class="sec" id="catalogo" aria-labelledby="catTitle">
      <div class="wrap">
        <header class="sec__head"><div><p class="kicker">{kicker}</p><{h_tag} id="catTitle">{title}</{h_tag}></div><button class="btn btn--line btn--sm" data-open-quiz>Ayúdame a elegir</button></header>
        <div class="filters">
          <div class="filters__row" id="colFilters" role="tablist" aria-label="Colección">{chip_html}</div>
          <div class="filters__row filters__row--sub" id="subFilters" aria-label="Subcolección"></div>
          <div class="filters__bar">
            <label class="search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr">Buscar en el catálogo</span><input type="search" id="q" placeholder="Busca: león, Jesús, Machu Picchu…" autocomplete="off"></label>
            <label class="select"><span>Ambiente</span><select id="room"><option value="">Todos</option>{opts}</select></label>
            <label class="select"><span>Orden</span><select id="sort"><option value="">Recomendados</option><option value="nuevo">Nuevos primero</option><option value="az">A–Z</option><option value="precio">Precio</option></select></label>
          </div>
          <p class="filters__count" id="count" aria-live="polite">{len(items)} cuadros</p>
        </div>
        <div class="cards" id="grid">{"".join(card(x) for x in items)}</div>
        <p class="empty" id="empty" hidden>No encontramos ese cuadro. <button class="link-btn" id="clearFilters">Ver todos</button> o <a href="#" data-wa="Hola, busco un cuadro que no encuentro en el catálogo:">pídenos uno a medida</a>.</p>
      </div>
    </section>'''


FAQ = [
    ("¿Cuánto cuesta un cuadro con marco?", f"{soles(P['pieza'])} cada cuadro de 30 × 37 cm con marco negro incluido y {soles(P['triptico'])} el tríptico de 3 piezas. Personalizar con nombre, fecha o lugar suma {soles(P['personalizar'])}."),
    ("¿Cuánto demora?", "Se hace a pedido en 4 a 6 días hábiles en Lima. A provincia se suma el tiempo de la agencia."),
    ("¿Hacen envíos a provincia?", "Sí, a todo el Perú (Arequipa, Trujillo, Cusco, Piura, Chiclayo y más) por agencia, con esquineros. Si llega dañado, se repone."),
    ("¿Cómo se pide?", "Eliges uno o varios cuadros y los pides por WhatsApp; ahí confirmamos la dirección y el pago (Yape, Plin, transferencia o tarjeta). No pagas nada en la web."),
    ("¿Cómo funcionan los personalizados?", "Escribes los datos (apellido, ciudad, fecha) al pedir. Te enviamos la vista previa por WhatsApp y solo imprimimos cuando nos das el OK."),
    ("¿Qué tamaño tiene un cuadro?", "30 × 37 cm con marco (vertical) o 37 × 30 cm (horizontal). El tríptico son 3 piezas de esa medida: unos 98 cm de ancho, ideal sobre un sofá de 2 m."),
    ("¿Hacen pedidos para empresas u oficinas?", "Sí. Escríbenos con la cantidad y el tipo de ambiente y te armamos una propuesta."),
]


def faq_html(items, h="h2"):
    det = "".join(f'<details{" open" if i == 0 else ""}><summary>{e(q)}</summary><p>{e(a)}</p></details>' for i, (q, a) in enumerate(items))
    return f'''
    <section class="sec" id="faq" aria-labelledby="faqTitle">
      <div class="wrap faq">
        <header class="sec__head sec__head--stack"><p class="kicker">Preguntas frecuentes</p><{h} id="faqTitle">Lo que nos preguntan</{h}>
          <p class="muted">¿Otra duda? <a href="#" class="u" data-wa="Hola, tengo una consulta sobre los cuadros.">Escríbenos por WhatsApp</a>.</p></header>
        <div class="faq__list">{det}</div>
      </div>
    </section>'''


def faq_ld(items):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}


def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": h(u)} for i, (n, u) in enumerate(items)]}


def crumbs_html(items):
    lis = "".join((f'<li data-i="{i}"><a href="{u}">{e(n)}</a></li>' if i < len(items) - 1 else f'<li data-i="{i}" aria-current="page">{e(n)}</li>') for i, (n, u) in enumerate(items))
    return f'<nav class="crumbs wrap" aria-label="Ruta"><ol>{lis}</ol></nav>'


def itemlist_ld(items, name):
    return {"@context": "https://schema.org", "@type": "ItemList", "name": name, "numberOfItems": len(items),
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "url": h(purl(x)), "name": x["n"]} for i, x in enumerate(items)]}


def cta():
    return '''
    <section class="cta"><div class="wrap cta__in"><h2>¿No sabes cuál elegir?</h2><p>Dinos para qué pared es y te recomendamos seis en un minuto.</p>
      <div class="hero__cta"><button class="btn btn--light" data-open-quiz>Ayúdame a elegir</button><a class="btn btn--line" href="#" data-wa="Hola, quiero ayuda para elegir un cuadro.">Hablar con un asesor</a></div></div></section>'''


def cols_grid():
    out = []
    for i, c in enumerate(COLS):
        k = len([x for x in PRODS if x["c"] == c["id"]])
        media = (f'<img class="col__photo" src="/img/ambiente/t/{c["foto"]}.webp" alt="" loading="lazy">' if c.get("foto")
                 else f'<span class="col__img">{pf(BY[c["img"]], thumb=True)}</span>')
        out.append(f'<a class="col rv{" col--photo" if c.get("foto") else ""}" href="/{c["url"]}/"><span class="col__n">0{i + 1} · {k} cuadros</span>{media}'
                   f'<h3>{e(c["nombre"])}</h3><p>{e(c["bajada"])}</p><small>Ver colección →</small></a>')
    return "".join(out)


def wa_url(msg):
    return f"https://wa.me/{C['whatsapp']}?text={urllib.parse.quote(msg)}"


def wa_links(content):
    """Pone el enlace real de WhatsApp en cada <a data-wa> para que funcione aunque el JavaScript no cargue."""
    def fix(m):
        tag = m.group(0)
        msg = html.unescape(re.search(r'data-wa="([^"]*)"', tag).group(1))
        tag = tag.replace('href="#"', f'href="{e(wa_url(msg))}"', 1)
        if "target=" not in tag:
            tag = tag[:-1] + ' target="_blank" rel="noopener">'
        return tag
    return re.sub(r'<a [^>]*data-wa="[^"]*"[^>]*>', fix, content)


def write(path, content):
    content = wa_links(content)
    full = os.path.join(ROOT, path.lstrip("/"))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, "w", encoding="utf-8").write(content)


# ---------- páginas ----------
def build_home():
    top = [x for x in sorted(PRODS, key=lambda x: x["idx"]) if x.get("t")] + [x for x in PRODS if x.get("nw") and x.get("i")][:4]
    rail = "".join(f'<a href="/{c["url"]}/"><img src="/img/cuadros/t/{c["img"]}.webp" alt="" loading="lazy" width="68" height="68">{e(c["nombre"])}</a>' for c in VIRT + COLS)
    slides = "".join(f'<img class="hero__slide{" is-on" if i == 0 else ""}" src="/img/ambiente/{sl["img"]}.webp" alt="{e(sl["alt"])}" style="--pos:{sl["pos"]}" data-pie="{e(sl["pie"])}" data-url="{sl["url"]}"{" fetchpriority=\"high\"" if i == 0 else " loading=\"lazy\""}>' for i, sl in enumerate(PORTADA))
    dots = "".join(f'<button role="tab" aria-selected="{"true" if i == 0 else "false"}" aria-label="Foto {i + 1}: {e(sl["pie"])}" data-i="{i}"></button>' for i, sl in enumerate(PORTADA))
    en_casa = "".join(f'<a class="home-shot rv" href="/cuadro/foco-disciplina-ejecucion/"><img src="/img/ambiente/t/{f}.webp" alt="{e(dict((k, v) for k, v in BY["foco-disciplina-ejecucion"]["fotos"]).get(f, "Cuadros en una casa"))}" loading="lazy"></a>' for f in CAT["enCasa"])
    amb = "".join(f'<a class="amb rv" href="/{a["url"]}/"><span class="amb__img">{pf(BY[a["img"]], thumb=True)}</span><span><b>Cuadros para {a["nombre"].lower()}</b><small>{e(a["bajada"])}</small></span></a>' for a in AMB)
    website = {"@context": "https://schema.org", "@type": "WebSite", "@id": h("/#web"), "name": C["marca"], "url": h("/"), "inLanguage": "es-PE",
               "publisher": {"@id": h("/#tienda")},
               "potentialAction": {"@type": "SearchAction", "target": {"@type": "EntryPoint", "urlTemplate": h("/?q={search_term_string}")}, "query-input": "required name=search_term_string"}}
    body = f'''
  <main id="main">
    <section class="hero" aria-label="Portada">
      <div class="hero__slides" id="heroSlides">{slides}</div>
      <div class="hero__shade" aria-hidden="true"></div>
      <div class="wrap hero__in">
        <div class="hero__copy">
          <p class="kicker">Hechos en Lima, Perú</p>
          <h1><b class="l">Cuadros que dicen</b> <span class="l">quién vive aquí</span></h1>
          <p class="hero__lead">Cuadros en blanco y negro con marco para la sala, el despacho y el dormitorio. Hechos a pedido en Lima, listos para colgar y enviados a todo el Perú.</p>
          <div class="hero__cta"><a href="#catalogo" class="btn btn--light">Ver los {len(PRODS)} cuadros</a><button class="btn btn--line" data-open-quiz>Ayúdame a elegir</button></div>
        </div>
        <div class="hero__foot">
          <a class="hero__cap" id="heroCap" href="{PORTADA[0]["url"]}"><span>En la foto</span><b id="heroCapTxt">{e(PORTADA[0]["pie"])}</b> →</a>
          <div class="hero__dots" role="tablist" aria-label="Fotos de portada">{dots}</div>
        </div>
      </div>
    </section>
    <ul class="trust" aria-label="Por qué comprar aquí">
      <li><b>{soles(P['pieza'])}</b><span>con marco incluido</span></li>
      <li><b>4–6 días</b><span>hecho a pedido en Lima</span></li>
      <li><b>Todo el Perú</b><span>envío con esquineros</span></li>
      <li><b>Yape · Plin · tarjeta</b><span>pagas al confirmar</span></li>
      <li><b>Garantía</b><span>si llega dañado, se repone</span></li>
    </ul>
    <div class="wrap"><nav class="rail" aria-label="Colecciones">{rail}</nav></div>

    <section class="sec" id="top" aria-labelledby="topTitle">
      <div class="wrap">
        <header class="sec__head"><div><p class="kicker">Los más pedidos</p><h2 id="topTitle">Lo que más se cuelga</h2></div><a href="/mas-pedidos/" class="link-arrow">Ver los más pedidos</a></header>
        <div class="cards cards--scroll" id="topGrid">{"".join(card(x) for x in top)}</div>
      </div>
    </section>

    <section class="sec--wall" aria-labelledby="wallTitle">
      <div class="wrap wall-teaser">
        <div class="wall-teaser__copy">
          <p class="kicker">Antes de pedir</p><h2 id="wallTitle">Míralo en tu pared</h2>
          <p>Cada cuadro se coloca a escala real en fotos de una sala, un dormitorio, una oficina y un escritorio. Sin sorpresas al colgarlo: 30 × 37 cm se ven así.</p>
          <a class="btn btn--light" href="/cuadro/tigre-en-el-agua/" data-tab="pared">Probar con un cuadro</a>
        </div>
        <div class="wall-teaser__scene" aria-hidden="true">
          {scene_html(BY["triptico-fuerza-vision-lealtad"], "sala", thumb=True)}
        </div>
      </div>
    </section>
    <section class="sec sec--tight" aria-labelledby="casaTitle">
      <div class="wrap">
        <header class="sec__head"><div><p class="kicker">Así se ven en casa</p><h2 id="casaTitle">En salas, oficinas y dormitorios</h2></div><a class="link-arrow" href="/cuadro/foco-disciplina-ejecucion/">Ver el tríptico de las fotos</a></header>
        <div class="home-shots">{en_casa}</div>
      </div>
    </section>
{catalog_section("Todos los cuadros", "Catálogo completo", PRODS)}
    <section class="sec sec--alt" id="colecciones" aria-labelledby="colTitle">
      <div class="wrap">
        <header class="sec__head"><div><p class="kicker">Colecciones</p><h2 id="colTitle">Elige por lo que significa</h2></div></header>
        <div class="cols">{cols_grid()}</div>
        <h3 class="sub-h">O elige por ambiente</h3>
        <div class="ambs">{amb}</div>
      </div>
    </section>

    <section class="sec" id="personalizados" aria-labelledby="persTitle">
      <div class="wrap pers">
        <div class="pers__media"><span class="pf pf--tilt"><img src="/img/cuadros/t/tu-ciudad.webp" alt="Mapa de ciudad personalizado en cuadro" loading="lazy"></span><span class="pf pf--tilt2"><img src="/img/cuadros/t/bendice-este-hogar.webp" alt="Cuadro Bendice este hogar con el apellido de la familia" loading="lazy"></span></div>
        <div class="pers__copy">
          <p class="kicker">Personalizados · + {soles(P['personalizar'])}</p><h2 id="persTitle">El cuadro que solo puede ser tuyo</h2>
          <p>Tu ciudad, tu apellido, tu fecha o tu cielo. Escribes los datos y te mandamos la vista previa por WhatsApp <strong>antes de imprimir</strong>.</p>
          <ul class="ticks"><li>Mapa de tu ciudad o de cualquier lugar</li><li>“Bendice este hogar” con el apellido de tu familia</li><li>El cielo y la fecha de un día que importa</li></ul>
          <a class="btn btn--light" href="/cuadros-personalizados/">Ver personalizados</a>
        </div>
      </div>
    </section>

    <section class="sec craft" aria-labelledby="craftTitle">
      <div class="wrap craft__grid">
        <div class="craft__media">
          <img class="craft__big rv" src="/img/ambiente/taller.webp" alt="Armado a mano de un cuadro con marco negro en el taller" loading="lazy">
          <img class="craft__sm rv" src="/img/ambiente/t/foco-detalle-marco.webp" alt="Detalle del marco negro de cerca" loading="lazy">
          <img class="craft__sm2 rv" src="/img/ambiente/t/foco-esc-2.webp" alt="Cuadros recién llegados en su caja con esquineros" loading="lazy">
        </div>
        <div class="craft__copy">
          <p class="kicker">Hecho a mano en Lima</p><h2 id="craftTitle">Cada cuadro se arma a pedido</h2>
          <p>Imprimimos la obra, la montamos en su marco negro y la protegemos con esquineros para el viaje. Por eso tarda 4 a 6 días: no sale de un almacén, sale del taller.</p>
          <ul class="ticks"><li>Marco negro listo para colgar, con su colgador</li><li>Embalaje con esquineros, también a provincia</li><li>Si llega dañado, se repone</li></ul>
        </div>
      </div>
    </section>

    <section class="sec sec--alt" id="como" aria-labelledby="comoTitle">
      <div class="wrap">
        <header class="sec__head"><div><p class="kicker">Cómo se pide</p><h2 id="comoTitle">Tres pasos, sin registrarte</h2></div></header>
        <ol class="steps">
          <li><span>01</span><h3>Elige</h3><p>Guarda los cuadros que te gusten en tu selección. Míralos en tu pared, uno solo o en tríptico.</p></li>
          <li><span>02</span><h3>Pide por WhatsApp</h3><p>Te llega el pedido armado con nombres y precios. Ahí confirmamos la dirección y el pago: Yape, Plin, transferencia o tarjeta.</p></li>
          <li><span>03</span><h3>Recíbelo listo</h3><p>Lo imprimimos y enmarcamos en Lima en 4 a 6 días hábiles. A provincia va por agencia con esquineros.</p></li>
        </ol>
        <div class="spec">
          <div class="spec__item"><strong>30 × 37 cm</strong><span>Medida única con marco. Vertical u horizontal.</span></div>
          <div class="spec__item"><strong>Marco negro</strong><span>Impresión + marco, listo para colgar.</span></div>
          <div class="spec__item"><strong>Tríptico ≈ 98 cm</strong><span>3 piezas iguales con separación, ideal sobre un sofá.</span></div>
          <div class="spec__item"><strong>Garantía</strong><span>Si llega dañado, se repone.</span></div>
        </div>
      </div>
    </section>

    <section class="sec sec--tight recent" id="recent" hidden aria-labelledby="recentTitle"><div class="wrap">
      <header class="sec__head"><div><p class="kicker">Para retomar</p><h2 id="recentTitle">Vistos recientemente</h2></div><button class="link-btn small" id="recentClear">Borrar historial</button></header>
      <div class="cards cards--scroll" id="recentGrid"></div>
    </div></section>
{faq_html(FAQ)}
{cta()}
  </main>'''
    page = head(f"{C['marca']} · Cuadros en blanco y negro con marco en Lima",
                f"{len(PRODS)} cuadros en blanco y negro con marco, listos para colgar: {soles(P['pieza'])}, tríptico {soles(P['triptico'])}. Hechos a pedido en Lima, envío a todo el Perú.",
                "/", ld=[{"@context": "https://schema.org", **ORG}, website, faq_ld(FAQ), itemlist_ld(top, "Los cuadros más pedidos")],
                preload='<link rel="preload" as="image" href="/img/ambiente/hero.webp" fetchpriority="high">')
    write("index.html", page + header({"tipo": "home"}) + body + footer() + overlays())


def landing(kind, obj, items):
    path = f"/{obj['url']}/"
    crumbs = [("Inicio", "/"), (obj["h1"], path)]
    preset = {"col": obj["id"]} if kind in ("col", "virt") else {"room": obj["id"]}
    n = len(items)
    con_precio = [x for x in items if precio(x)]
    rango = f"desde {soles(min(precio(x) for x in con_precio))}" if con_precio else "a cotizar"
    ejemplos = ", ".join(x["n"] for x in sorted(items, key=rank)[:4])
    intro = (f"{n} cuadros con marco negro, {rango}, hechos a pedido en Lima en 4 a 6 días hábiles y enviados a todo el Perú. "
             f"Entre los más pedidos: {ejemplos}. Puedes verlos a escala en tu pared antes de pedir y armar tu selección para pedirla en un solo WhatsApp.")
    otros = [c for c in COLS if c["id"] != obj["id"]][:8]
    links = "".join(f'<a class="pill" href="/{c["url"]}/">{e(c["nombre"])}</a>' for c in otros) + \
            "".join(f'<a class="pill" href="/{a["url"]}/">Para {a["nombre"].lower()}</a>' for a in AMB if a["id"] != obj["id"])
    faqs = [FAQ[0], FAQ[1], FAQ[2], FAQ[3]]
    if kind == "virt" and obj["id"] == "personalizados": faqs = [FAQ[4]] + faqs
    hero_items = sorted(items, key=rank)[:3]
    body = f'''
  <main id="main">
    {crumbs_html(crumbs)}
    <section class="lhero">
      <div class="wrap lhero__grid">
        <div>
          <p class="kicker">{e(obj.get("titulo") or obj["nombre"])}</p>
          <h1>{e(obj["h1"])}</h1>
          <p class="hero__lead">{e(obj["bajada"])}</p>
          <p class="lhero__intro">{e(intro)}</p>
        </div>
        <div class="lhero__art" aria-hidden="true">{"".join(f'<span class="lhero__p">{pf(x, thumb=True, lazy=False)}</span>' for x in hero_items)}</div>
      </div>
    </section>
{catalog_section(f"{n} cuadros", obj["nombre"], PRODS, preset_col=preset.get("col", ""), preset_room=preset.get("room", ""))}
    <section class="sec sec--alt"><div class="wrap"><h2 class="sub-h">Sigue explorando</h2><div class="pills">{links}</div></div></section>
{faq_html(faqs)}
{cta()}
  </main>'''
    ld = [crumbs_ld(crumbs), {"@context": "https://schema.org", "@type": "CollectionPage", "name": obj["h1"], "url": h(path), "description": obj["seoDesc"],
                              "isPartOf": {"@id": h("/#web")}, "about": {"@id": h("/#tienda")}}, itemlist_ld(sorted(items, key=rank), obj["h1"]), faq_ld(faqs)]
    page = head(obj["seoTitle"], obj["seoDesc"], path, og_img=img_og(BY[obj["img"]]), ld=ld)
    # El catálogo arranca filtrado: se reemplaza la grilla completa por la de la colección.
    html_ = page + header({"tipo": "landing", "data": preset}) + body + footer() + overlays()
    grid_all = "".join(card(x) for x in sorted(PRODS, key=rank))
    html_ = html_.replace(grid_all, "".join(card(x) for x in sorted(items, key=rank)), 1)
    html_ = html_.replace(f'<p class="filters__count" id="count" aria-live="polite">{len(PRODS)} cuadros</p>', f'<p class="filters__count" id="count" aria-live="polite">{n} de {len(PRODS)} cuadros</p>', 1)
    write(path + "index.html", html_)
    return path


def build_product(x, robots="index,follow"):
    path = purl(x)
    col = COL[x["c"]]
    crumbs = [("Inicio", "/"), (col["nombre"], f"/{col['url']}/"), (x["n"], path)]
    rel = sorted([y for y in PRODS if y["c"] == x["c"] and y["s"] != x["s"] and y.get("i")], key=rank)[:4]
    if len(rel) < 4:
        rel += [y for y in sorted(PRODS, key=rank) if y not in rel and y["s"] != x["s"] and y.get("i")][:4 - len(rel)]
    otros_amb = "".join(f'<a class="pill" href="/{AMB_BY[a]["url"]}/">Cuadros para {a}</a>' for a in x["a"] if a in AMB_BY)
    images = [h(f"/img/cuadros/{x['s']}.webp")] if piezas(x) == 1 and x.get("i") else [h(f"/img/cuadros/{x['s']}-{i + 1}.webp") for i in range(piezas(x))] if piezas(x) > 1 else []
    prod = {"@context": "https://schema.org", "@type": "Product", "name": x["n"], "description": descripcion(x), "sku": x["s"],
            "url": h(path), "category": f"Cuadros decorativos > {col['nombre']}", "brand": {"@type": "Brand", "name": C["marca"]},
            "material": "Impresión con marco negro", "size": medida(x)}
    if images: prod["image"] = images + [h(img_og(x))]
    t = precio_total(x)
    if t is not None:
        prod["offers"] = {"@type": "Offer", "url": h(path), "priceCurrency": "PEN", "price": str(t), "availability": "https://schema.org/InStock",
                          "itemCondition": "https://schema.org/NewCondition", "seller": {"@id": h("/#tienda")},
                          "priceValidUntil": f"{datetime.date.today().year + 1}-12-31",
                          "shippingDetails": {"@type": "OfferShippingDetails", "shippingDestination": {"@type": "DefinedRegion", "addressCountry": "PE"},
                                              "deliveryTime": {"@type": "ShippingDeliveryTime",
                                                               "handlingTime": {"@type": "QuantitativeValue", "minValue": 4, "maxValue": 6, "unitCode": "DAY"},
                                                               "transitTime": {"@type": "QuantitativeValue", "minValue": 0, "maxValue": 4, "unitCode": "DAY"}}}}
    faqs = [("¿Qué medida tiene?", medida(x) + ". " + ("Unos 98 cm de ancho colgados con separación." if x["o"] == "triptico" else "Listo para colgar.")),
            ("¿Cuánto demora?", "Se hace a pedido en 4 a 6 días hábiles en Lima. A provincia se suma el tiempo de la agencia."),
            ("¿Cómo lo pido?", "Agrégalo a tu selección o pídelo directo por WhatsApp; ahí confirmamos dirección y pago (Yape, Plin, transferencia o tarjeta).")]
    body = f'''
  <main id="main">
    {crumbs_html(crumbs)}
    <article class="wrap pd-page" id="pdRoot" data-slug="{x["s"]}">{pd_markup(x, page=True)}</article>
    <section class="sec sec--tight"><div class="wrap">
      <header class="sec__head"><div><p class="kicker">Misma colección</p><h2>Combinan con este</h2></div><a class="link-arrow" href="/{col["url"]}/">Ver toda la colección {e(col["nombre"])}</a></header>
      <div class="cards">{"".join(card(y) for y in rel)}</div>
      <div class="pills pills--top">{otros_amb}<a class="pill" href="/cuadros-personalizados/">Personalizados</a><a class="pill" href="/#catalogo">Todos los cuadros</a></div>
    </div></section>

    <section class="sec sec--tight recent" id="recent" hidden aria-labelledby="recentTitle"><div class="wrap">
      <header class="sec__head"><div><p class="kicker">Para retomar</p><h2 id="recentTitle">Vistos recientemente</h2></div><button class="link-btn small" id="recentClear">Borrar historial</button></header>
      <div class="cards cards--scroll" id="recentGrid"></div>
    </div></section>
{faq_html(faqs)}
  </main>'''
    title = f"{x['n']} · Cuadro con marco" + (" · Visita del Papa León XIV" if x["c"] == "papa" else "")
    page = head(title, meta_desc(x), path, og_img=img_og(x), og_type="product", robots=robots,
                ld=[prod, crumbs_ld(crumbs), faq_ld(faqs)],
                preload=f'<link rel="preload" as="image" href="{img_main(x)}" fetchpriority="high">' if x.get("i") else "")
    write(path + "index.html", page + header({"tipo": "product", "data": {"slug": x["s"]}}) + body + footer() + overlays(with_product_dialog=False))
    return path


def build_404():
    top = [x for x in PRODS if x.get("t")][:8]
    body = f'''
  <main id="main" class="nf">
    <div class="wrap">
      <p class="kicker">Error 404</p><h1>Este cuadro ya no cuelga aquí</h1>
      <p class="hero__lead">La página que buscas no existe o cambió de lugar. Busca otro cuadro o mira los más pedidos.</p>
      <div class="hero__cta"><a class="btn btn--light" href="/#catalogo">Ver todos los cuadros</a><button class="btn btn--line" id="nfSearch">Buscar</button></div>
      <div class="cards" style="margin-top:56px">{"".join(card(x) for x in top)}</div>
    </div>
  </main>'''
    write("404.html", head("Página no encontrada", "La página no existe. Mira los cuadros más pedidos de Cuadros Finos.", "/404", robots="noindex,follow") + header({"tipo": "404"}) + body + footer() + overlays())


def build_data_js():
    out = {"config": C, "colecciones": COLS, "virtuales": VIRT, "ambientes": AMB, "paredes": PAREDES,
           "productos": [{k: v for k, v in x.items() if k != "idx"} for x in PRODS]}
    write("data.js", "/* Generado por tools/build.py desde data/catalogo.json: no editar a mano. */\nwindow.CATALOGO=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")


def build_seo(paths):
    urls = []
    for p, imgs in paths:
        im = "".join(f"<image:image><image:loc>{h(i)}</image:loc></image:image>" for i in imgs)
        pr = "1.0" if p == "/" else "0.8" if not p.startswith("/cuadro/") else "0.7"
        urls.append(f"<url><loc>{h(p)}</loc><lastmod>{HOY}</lastmod><priority>{pr}</priority>{im}</url>")
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' + "\n".join(urls) + "\n</urlset>\n")
    write("robots.txt", f"""# {C['marca']}
User-agent: *
Allow: /
Disallow: /tools/
Disallow: /admin/
Disallow: /cuadro/_plantilla/
Disallow: /api/

# Asistentes de IA bienvenidos (GEO)
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /

Sitemap: {h('/sitemap.xml')}
""")
    facts = f"""# {C['marca']}

> Tienda peruana de cuadros decorativos en blanco y negro con marco negro, hechos a pedido en Lima y enviados a todo el Perú. Los pedidos se hacen por WhatsApp (+51 {C['whatsappVisible']}).

## Datos clave
- Precio: {soles(P['pieza'])} por cuadro de 30 × 37 cm con marco negro (medida única, vertical u horizontal).
- Tríptico (3 piezas, unos 98 cm de ancho): {soles(P['triptico'])}. Díptico: {soles(P['diptico'])}.
- Personalización con nombre, fecha, apellido o mapa: + {soles(P['personalizar'])}, con vista previa por WhatsApp antes de imprimir.
- Producción: 4 a 6 días hábiles en Lima. Envío a provincias por agencia, con esquineros.
- Garantía: si llega dañado, se repone.
- Pago: Yape, Plin, transferencia o tarjeta (se coordina por WhatsApp; no se paga en la web).
- Catálogo: {len(PRODS)} cuadros. Sitio: {h('/')}

## Colecciones
""" + "\n".join(f"- [{c['h1']}]({h('/' + c['url'] + '/')}): {c['seoDesc']}" for c in COLS) + "\n" + \
        "\n".join(f"- [{v['h1']}]({h('/' + v['url'] + '/')}): {v['seoDesc']}" for v in VIRT) + "\n\n## Por ambiente\n" + \
        "\n".join(f"- [{a['h1']}]({h('/' + a['url'] + '/')}): {a['seoDesc']}" for a in AMB) + "\n"
    write("llms.txt", facts + f"\n## Más\n- [Catálogo completo con descripciones]({h('/llms-full.txt')})\n- [Preguntas frecuentes]({h('/#faq')})\n")
    full = facts + "\n## Catálogo completo\n" + "\n".join(
        f"- [{x['n']}]({h(purl(x))}) — {'Cotizar' if precio_total(x) is None else soles(precio_total(x))} — {descripcion(x)}" for x in sorted(PRODS, key=rank)) + \
        "\n\n## Preguntas frecuentes\n" + "\n".join(f"### {q}\n{a}\n" for q, a in FAQ)
    write("llms-full.txt", full)
    write("manifest.webmanifest", json.dumps({"name": C["marca"], "short_name": C["marca"], "lang": "es-PE", "start_url": "/", "display": "standalone",
                                              "background_color": "#0b0b0b", "theme_color": "#0b0b0b",
                                              "icons": [{"src": "/img/icon-192.png", "sizes": "192x192", "type": "image/png"},
                                                        {"src": "/img/icon-512.png", "sizes": "512x512", "type": "image/png"}]}, ensure_ascii=False, indent=1))
    write("_headers", """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: SAMEORIGIN

/img/*
  Cache-Control: public, max-age=2592000, stale-while-revalidate=86400

/styles.css
  Cache-Control: public, max-age=31536000, immutable
/app.js
  Cache-Control: public, max-age=31536000, immutable
/personaliza.js
  Cache-Control: public, max-age=31536000, immutable
/medicion.js
  Cache-Control: public, max-age=31536000, immutable
/data.js
  Cache-Control: public, max-age=30, stale-while-revalidate=600
/vendor/*
  Cache-Control: public, max-age=31536000, immutable
/3d/*
  Content-Type: model/gltf-binary
  Cache-Control: public, max-age=2592000

/tools/*
  X-Robots-Tag: noindex
/admin/*
  X-Robots-Tag: noindex, nofollow
  Cache-Control: no-store
  X-Frame-Options: DENY
/data/*
  X-Robots-Tag: noindex
/feeds/*
  X-Robots-Tag: noindex
  Cache-Control: public, max-age=3600
""")
    write("_redirects", "/todos/ /#catalogo 301\n/cuadros-de-leon/ /cuadros-motivacionales/ 301\n/cuadros-de-ciudades/ /cuadros-de-peru-y-ciudades/ 301\n/cuadros-para-oficina-y-profesionales/ /cuadros-para-profesionales/ 301\n")


def build_feeds():
    """Catálogos de productos para anuncios: Meta (CSV) y Google Merchant Center (XML)."""
    import csv, io
    prods = [x for x in sorted(PRODS, key=rank) if x.get("i") and not x.get("q")]
    cat_google = "Home & Garden > Decor > Artwork > Posters, Prints, & Visual Artwork"
    rows = []
    for x in prods:
        col = COL[x["c"]]
        desc = descripcion(x)
        rows.append({
            "id": x["s"], "title": f"{x['n']} · Cuadro con marco"[:150], "description": desc[:5000],
            "availability": "in stock", "condition": "new", "price": f"{precio_total(x):.2f} PEN",
            "link": h(purl(x)), "image_link": h(f"/img/feed/{x['s']}.jpg"),
            "additional_image_link": h(f"/img/og/{x['s']}.jpg"),
            "brand": C["marca"], "google_product_category": cat_google, "fb_product_category": "home decor > wall art",
            "product_type": f"Cuadros > {col['nombre']}" + (f" > {sub_nombre(x)}" if sub_nombre(x) else ""),
            "custom_label_0": col["nombre"], "custom_label_1": "mas_pedido" if x.get("t") else "nuevo" if x.get("nw") else "catalogo",
            "custom_label_2": "personalizado" if x.get("p") else "triptico" if x["o"] == "triptico" else "pieza",
            "custom_label_3": ",".join(x["a"]),
        })
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys())); w.writeheader(); w.writerows(rows)
    write("feeds/meta.csv", buf.getvalue())
    items = []
    for r in rows:
        x = BY[r["id"]]
        link = r["link"] + "?utm_source=google&utm_medium=shopping&utm_campaign=catalogo"
        items.append(f"""<item><g:id>{e(r['id'])}</g:id><title>{e(r['title'])}</title><description>{e(r['description'])}</description>
<link>{e(link)}</link><g:image_link>{e(r['image_link'])}</g:image_link>{''.join(f'<g:additional_image_link>{e(u)}</g:additional_image_link>' for u in r['additional_image_link'].split(','))}
<g:availability>in_stock</g:availability><g:condition>new</g:condition><g:price>{e(r['price'])}</g:price><g:brand>{e(r['brand'])}</g:brand>
<g:identifier_exists>no</g:identifier_exists><g:google_product_category>{e(cat_google)}</g:google_product_category><g:product_type>{e(r['product_type'])}</g:product_type>
<g:custom_label_0>{e(r['custom_label_0'])}</g:custom_label_0><g:custom_label_1>{e(r['custom_label_1'])}</g:custom_label_1><g:custom_label_2>{e(r['custom_label_2'])}</g:custom_label_2>
<g:shipping><g:country>PE</g:country><g:service>Agencia o delivery</g:service><g:price>0.00 PEN</g:price></g:shipping></item>""")
    write("feeds/google.xml", f"""<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>{e(C['marca'])}</title><link>{h('/')}</link>
<description>Cuadros con marco hechos a pedido en Lima</description>
{chr(10).join(items)}
</channel></rss>
""")
    return len(rows)


def main():
    if os.path.isdir(os.path.join(ROOT, "cuadro")):
        shutil.rmtree(os.path.join(ROOT, "cuadro"))
    build_data_js()
    paths = [("/", [h("/img/cuadros/leon-fuerza.webp")])]
    build_home()
    for c in COLS:
        paths.append((landing("col", c, [x for x in PRODS if x["c"] == c["id"]]), [h(img_main(BY[c["img"]]))]))
    for v in VIRT:
        paths.append((landing("virt", v, [x for x in PRODS if VFILTRO[v["id"]](x)]), [h(img_main(BY[v["img"]]))]))
    for a in AMB:
        paths.append((landing("amb", a, [x for x in PRODS if a["id"] in x["a"]]), [h(img_main(BY[a["img"]]))]))
    for x in PRODS:
        paths.append((build_product(x), [h(img_main(x))] if x.get("i") else []))
    build_404()
    # Plantilla que usa el servidor para los cuadros creados en el panel (no se indexa)
    build_product({"s": "_plantilla", "c": COLS[0]["id"], "u": COLS[0]["subs"][0][0] if COLS[0]["subs"] else "", "n": "Cuadro", "f": "",
                   "a": ["sala"], "o": "vertical", "i": 1, "idx": len(PRODS)}, robots="noindex,nofollow")
    build_seo(paths)
    nf = build_feeds()
    print(f"OK: {len(paths)} páginas · {nf} productos en los catálogos de anuncios · sitio {SITE}")


if __name__ == "__main__":
    main()
