// GET /media/<slug>/<archivo> — imágenes subidas o generadas desde el panel (guardadas en D1).
export async function onRequestGet({ request, env, params }) {
  const clave = (params.clave || []).join("/");
  if (!/^[a-z0-9-]+\/[a-z0-9.-]+$/.test(clave) || !env.DB) return new Response("No encontrado", { status: 404 });
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const r = await env.DB.prepare("SELECT tipo, datos FROM media WHERE clave = ?1").bind(clave).first();
  if (!r) return new Response("No encontrado", { status: 404 });
  const res = new Response(new Uint8Array(r.datos), { headers: { "content-type": r.tipo, "cache-control": "public, max-age=31536000, immutable" } });
  await cache.put(request, res.clone()).catch(() => {});
  return res;
}
