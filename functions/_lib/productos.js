// Catálogo dinámico: cuadros creados o cambiados desde el panel (tabla `productos` en D1).

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+){0,8}$/;
export const AMBIENTES = ["sala", "dormitorio", "oficina", "comedor"];

// Lee el catálogo estático (data.js) que genera tools/build.py
export async function catalogoBase(env, request) {
  const r = await env.ASSETS.fetch(new URL("/data.js", request.url));
  const t = await r.text();
  const i = t.indexOf("window.CATALOGO="), j = t.lastIndexOf(";");
  return JSON.parse(t.slice(i + "window.CATALOGO=".length, j));
}

// Filas publicadas u ocultas (los borradores no salen en la web)
export async function cambiosPublicados(env) {
  const rs = await env.DB.prepare("SELECT slug, datos, estado, base FROM productos WHERE estado IN ('publicado','oculto')").all();
  return rs.results.map(r => ({ ...r, datos: JSON.parse(r.datos) }));
}

// Aplica los cambios del panel sobre el catálogo base
export function fusionar(cat, cambios) {
  const porSlug = new Map(cat.productos.map((x, i) => [x.s, i]));
  const ocultos = new Set();
  for (const c of cambios) {
    if (c.estado === "oculto") { ocultos.add(c.slug); continue; }
    const d = { ...c.datos, s: c.slug, panel: 1 };
    if (porSlug.has(c.slug)) cat.productos[porSlug.get(c.slug)] = { ...cat.productos[porSlug.get(c.slug)], ...d };
    else cat.productos.push(d);
  }
  cat.productos = cat.productos.filter(x => !ocultos.has(x.s));
  cat.panel = { cambios: cambios.length, ocultos: [...ocultos] };
  return cat;
}

// Valida y normaliza los datos de un cuadro que llegan del panel
export function limpiarDatos(d, colecciones) {
  const t = (v, m) => (typeof v === "string" ? v.trim().slice(0, m) : "");
  const out = {
    n: t(d.n, 80), f: t(d.f, 160), c: t(d.c, 30), u: t(d.u, 30) || undefined,
    a: Array.isArray(d.a) ? d.a.filter(a => AMBIENTES.includes(a)).slice(0, 4) : [],
    o: ["vertical", "horizontal", "triptico", "diptico", "panoramico"].includes(d.o) ? d.o : "vertical",
    i: d.i ? 1 : undefined, t: d.t ? 1 : undefined, nw: d.nw ? 1 : undefined, q: d.q ? 1 : undefined,
    m: d.m ? t(String(d.m), 20) : undefined,                 // versión de las imágenes subidas desde el panel
    pr: Number.isFinite(+d.pr) && +d.pr > 0 ? Math.round(+d.pr) : undefined,   // precio especial (opcional)
    d: t(d.d, 600) || undefined,                             // descripción propia (opcional)
    p: t(d.p, 80) || undefined,
    k: Array.isArray(d.k) ? d.k.slice(0, 4).map(([a, b]) => [t(a, 60), t(b, 80)]) : undefined,
  };
  if (!out.n) throw new Error("Falta el nombre");
  if (!colecciones.some(c => c.id === out.c)) throw new Error("Colección inválida");
  if (!out.a.length) out.a = ["sala"];
  Object.keys(out).forEach(k => out[k] === undefined && delete out[k]);
  return out;
}
