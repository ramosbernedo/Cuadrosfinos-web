// GET /api/mapa?q=<lugar> — mapa de calles listo para «Tu ciudad», guardado 30 días en la caché de Cloudflare.
// El servidor hace la búsqueda y la descarga (más rápido que el celular) y devuelve ~20 veces menos datos.
// El dibujo vive en /mapa.js, el mismo archivo que usa el respaldo del celular.
import { armarMapa } from "../../mapa.js";

const UA = { "User-Agent": "CuadrosFinos/1.0 (+https://cuadrosfinos.plantify.pe)" };
const norm = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const res = (data, status, cache) => new Response(JSON.stringify(data), { status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": cache ? "public, max-age=2592000" : "no-store", "access-control-allow-origin": "*" } });

export async function onRequestGet({ request, waitUntil }) {
  const q = norm(new URL(request.url).searchParams.get("q") || "").slice(0, 120);
  if (q.length < 3) return res({ ok: false, error: "lugar muy corto" }, 400);
  // Clave de caché normalizada: «París» y «paris » comparten el mismo mapa (v2: lugar delimitado)
  const clave = new Request("https://cuadrosfinos-mapa.cache/v2?q=" + encodeURIComponent(q));
  const cache = caches.default, hit = await cache.match(clave);
  if (hit) return hit;
  try {
    const r = res(await armarMapa(q, UA), 200, true);
    waitUntil(cache.put(clave, r.clone()).catch(() => {}));
    return r;
  } catch (e) {
    const msg = e && e.errors ? "servidores de calles ocupados" : String((e && e.message) || e);
    return res({ ok: false, error: msg }, msg === "no encontrado" ? 404 : 502);
  }
}
