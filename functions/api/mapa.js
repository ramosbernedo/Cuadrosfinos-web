// GET /api/mapa?q=<lugar> — mapa de calles listo para «Tu ciudad», guardado 30 días en la caché de Cloudflare.
// El servidor hace la búsqueda y la descarga (más rápido que el celular) y devuelve ~10 veces menos datos.
import { buscarLugar, bajarCalles, dibujar } from "../_lib/mapa.js";

const norm = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const res = (data, status, cache) => new Response(JSON.stringify(data), { status, headers: {
  "content-type": "application/json; charset=utf-8", "cache-control": cache ? "public, max-age=2592000" : "no-store", "access-control-allow-origin": "*" } });

export async function onRequestGet({ request, waitUntil }) {
  const q = norm(new URL(request.url).searchParams.get("q") || "").slice(0, 120);
  if (q.length < 3) return res({ ok: false, error: "lugar muy corto" }, 400);
  // Clave de caché normalizada: «París» y «paris » comparten el mismo mapa
  const clave = new Request("https://cuadrosfinos-mapa.cache/v1?q=" + encodeURIComponent(q));
  const cache = caches.default, hit = await cache.match(clave);
  if (hit) return hit;
  try {
    const loc = await buscarLugar(q);
    const ways = await bajarCalles(loc);
    const r = res({ ok: true, lat: loc.lat, lon: loc.lon, nombre: loc.nombre, pais: loc.pais, svg: dibujar(ways, loc) }, 200, true);
    waitUntil(cache.put(clave, r.clone()).catch(() => {}));
    return r;
  } catch (e) {
    const msg = e && e.errors ? "servidores de calles ocupados" : String((e && e.message) || e);
    return res({ ok: false, error: msg }, msg === "no encontrado" ? 404 : 502);
  }
}
