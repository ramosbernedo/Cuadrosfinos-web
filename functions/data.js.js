// GET /data.js — catálogo de la web = catálogo estático + cuadros del panel (publicados).
import { catalogoBase, cambiosPublicados, fusionar } from "./_lib/productos.js";

export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  if (!env.DB) return ctx.next();
  try {
    const cat = await catalogoBase(env, request);
    const cambios = await cambiosPublicados(env);
    if (!cambios.length) return ctx.next();   // sin cambios: el archivo estático (caché larga)
    const js = "/* Catálogo de Cuadros Finos (web + panel) */\nwindow.CATALOGO=" + JSON.stringify(fusionar(cat, cambios)) + ";\n";
    return new Response(js, { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "public, max-age=30, stale-while-revalidate=600" } });
  } catch { return ctx.next(); }
}
