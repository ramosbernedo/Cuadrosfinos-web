// /cuadro/<slug>/ — páginas de cuadros creados o cambiados en el panel.
// Si el cuadro no tiene cambios, se sirve la página estática tal cual.
import { SLUG_RE, catalogoBase } from "../_lib/productos.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
class Attr { constructor(attr, val) { this.attr = attr; this.val = val; } element(e) { e.setAttribute(this.attr, this.val); } }
class Texto { constructor(t) { this.t = t; } element(e) { e.setInnerContent(this.t); } }
class Quitar { element(e) { e.remove(); } }

export async function onRequestGet(ctx) {
  const { request, env, params } = ctx;
  const slug = (params.ruta || [])[0];
  if (!env.DB || !slug || !SLUG_RE.test(slug)) return ctx.next();
  let row;
  try { row = await env.DB.prepare("SELECT datos, estado, base FROM productos WHERE slug = ?1 AND estado IN ('publicado','oculto')").bind(slug).first(); } catch { return ctx.next(); }
  if (!row) return ctx.next();
  const url = new URL(request.url);
  if (!url.pathname.endsWith("/")) return Response.redirect(url.origin + `/cuadro/${slug}/`, 301);
  if (row.estado === "oculto") {
    const nf = await env.ASSETS.fetch(new URL("/404.html", url));
    return new Response(nf.body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const cat = await catalogoBase(env, request);
  const base = cat.productos.find(x => x.s === slug) || {};
  const x = { ...base, ...JSON.parse(row.datos), s: slug };
  const col = cat.colecciones.find(c => c.id === x.c) || cat.colecciones[0];
  const P = cat.config.precio, sitio = cat.config.sitio.replace(/\/$/, "");
  const piezas = x.o === "triptico" ? 3 : x.o === "diptico" ? 2 : 1;
  const precio = x.q ? null : (x.pr || (piezas === 3 ? P.triptico : piezas === 2 ? P.diptico : P.pieza)) + (x.p ? P.personalizar : 0);
  const medida = piezas === 3 ? "Tríptico 3 × (30 × 37 cm) con marco" : piezas === 2 ? "Díptico 2 × (30 × 37 cm) con marco" : x.o === "horizontal" ? "37 × 30 cm con marco (horizontal)" : "30 × 37 cm con marco";
  const desc = x.d || `${x.f || ""} Cuadro de ${x.o === "horizontal" ? "37 × 30" : "30 × 37"} cm con marco negro, impreso y armado a pedido en Lima, listo para colgar. De la colección ${col.nombre}. ${precio ? "Precio: S/ " + precio + ". " : ""}Envío a todo el Perú.`.trim();
  const titulo = `${x.n} · Cuadro con marco | ${cat.config.marca}`;
  const meta = `${x.n}: ${x.f ? x.f + " " : ""}${medida}. ${precio ? "S/ " + precio : "Cotiza por WhatsApp"}. Hecho a pedido en Lima, envío a todo el Perú.`.slice(0, 165);
  const canon = `${sitio}/cuadro/${slug}/`;
  const v = x.m ? `?v=${encodeURIComponent(x.m)}` : "";
  const nuevo = !row.base || !cat.productos.some(y => y.s === slug);
  const og = x.m ? `${sitio}/media/${slug}/og.jpg${v}` : `${sitio}/img/og/${slug}.jpg`;
  const img = x.m ? `${sitio}/media/${slug}/obra.webp${v}` : `${sitio}/img/cuadros/${slug}.webp`;
  const ld = [{ "@context": "https://schema.org", "@type": "Product", name: x.n, description: desc, sku: slug, url: canon, image: [img, og],
      category: `Cuadros decorativos > ${col.nombre}`, brand: { "@type": "Brand", name: cat.config.marca }, size: medida,
      ...(precio ? { offers: { "@type": "Offer", url: canon, priceCurrency: "PEN", price: String(precio), availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" } } : {}) },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: sitio + "/" }, { "@type": "ListItem", position: 2, name: col.nombre, item: `${sitio}/${col.url}/` },
      { "@type": "ListItem", position: 3, name: x.n, item: canon }] }];

  const origen = await env.ASSETS.fetch(new URL(nuevo ? "/cuadro/_plantilla/" : `/cuadro/${slug}/`, url));
  const rw = new HTMLRewriter()
    .on("title", new Texto(titulo))
    .on('meta[name="description"]', new Attr("content", meta))
    .on('meta[name="robots"]', new Attr("content", "index,follow,max-image-preview:large"))
    .on('link[rel="canonical"]', new Attr("href", canon))
    .on('link[rel="alternate"]', new Attr("href", canon))
    .on('meta[property="og:title"]', new Attr("content", `${x.n} · Cuadro con marco`))
    .on('meta[property="og:description"]', new Attr("content", meta))
    .on('meta[property="og:url"]', new Attr("content", canon))
    .on('meta[property="og:image"]', new Attr("content", og))
    .on('script[type="application/ld+json"]', new Quitar())
    .on('link[rel="preload"][as="image"]', new Quitar())
    .on("head", { element(e) { e.append(ld.map(o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`).join(""), { html: true }); } })
    .on("body", new Attr("data-slug", slug))
    .on("#pdRoot", new Attr("data-slug", slug))
    .on("#pTitle", new Texto(x.n))
    .on("#pPhrase", new Texto(x.f || ""))
    .on("#pCol", new Texto(`Colección ${col.nombre}`))
    .on("#pPrice", new Texto(precio ? `S/ ${precio}` : "Cotiza por WhatsApp"))
    .on(".pd__desc", new Texto(desc))
    .on("#pSize", new Texto(medida))
    .on('.crumbs li[aria-current="page"]', new Texto(x.n))
    .on('.crumbs li[data-i="1"] a', { element(e) { e.setAttribute("href", `/${col.url}/`); e.setInnerContent(col.nombre); } });
  if (nuevo) {
    rw.on("body", new Attr("data-dinamico", "1"))
      .on("#pStage", new Texto(""))
      .on("#pSceneArt", new Texto(""))
      .on("#pViews", new Texto(""))
      .on("#pFieldList", new Texto(""))
      .on("section.sec--tight", new Quitar());
  }
  const res = rw.transform(origen);
  return new Response(res.body, { status: 200, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=60" } });
}
