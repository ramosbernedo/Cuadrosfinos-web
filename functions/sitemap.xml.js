// GET /sitemap.xml — mapa estático + cuadros publicados desde el panel (y sin los ocultos).
export async function onRequestGet(ctx) {
  const { request, env } = ctx;
  if (!env.DB) return ctx.next();
  try {
    const rs = await env.DB.prepare("SELECT slug, estado, base, actualizado FROM productos WHERE estado IN ('publicado','oculto')").all();
    if (!rs.results.length) return ctx.next();
    const base = await (await env.ASSETS.fetch(new URL("/sitemap.xml", request.url))).text();
    const sitio = (base.match(/<loc>(https?:\/\/[^/<]+)/) || [])[1] || new URL(request.url).origin;
    let xml = base;
    for (const r of rs.results) {
      const loc = `${sitio}/cuadro/${r.slug}/`;
      const re = new RegExp(`<url><loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>.*?</url>\\n?`);
      if (r.estado === "oculto") { xml = xml.replace(re, ""); continue; }
      if (!re.test(xml)) xml = xml.replace("</urlset>", `<url><loc>${loc}</loc><lastmod>${r.actualizado.slice(0, 10)}</lastmod><priority>0.7</priority><image:image><image:loc>${sitio}/media/${r.slug}/obra.webp</image:loc></image:image></url>\n</urlset>`);
    }
    return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=300" } });
  } catch { return ctx.next(); }
}
