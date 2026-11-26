// POST /api/ev — eventos de la web para el panel de marketing (sin cookies, sin IP).
import { json, error, txt, num, mismoOrigen, sinDB } from "../_lib/comun.js";

const PERMITIDOS = new Set(["page_view", "view_item", "select_item", "ver_pared", "ver_3d", "ver_foto", "realidad_aumentada", "personalizar",
  "add_to_cart", "remove_from_cart", "view_cart", "add_shipping_info", "add_payment_info", "begin_checkout", "generate_lead", "search", "share",
  "contacto_whatsapp", "ayuda_inicio", "ayuda_resultado", "filtrar", "zoom"]);

export async function onRequestPost({ request, env }) {
  if (sinDB(env)) return json({ ok: false }, 202);
  if (!mismoOrigen(request)) return error("Origen no permitido", 403);
  let lote;
  try { lote = JSON.parse(await request.text()); } catch { return error("JSON inválido"); }
  if (!Array.isArray(lote)) lote = [lote];
  lote = lote.slice(0, 25).filter(e => e && PERMITIDOS.has(e.n));
  if (!lote.length) return json({ ok: true, n: 0 });
  const ua = request.headers.get("user-agent") || "";
  const disp = /Mobi|Android|iPhone/i.test(ua) ? "celular" : /iPad|Tablet/i.test(ua) ? "tablet" : "computadora";
  if (/bot|crawl|spider|headless|lighthouse|preview/i.test(ua)) return json({ ok: true, n: 0 });
  const region = [request.cf && request.cf.city, request.cf && request.cf.region].filter(Boolean).join(", ") || null;
  const st = env.DB.prepare(`INSERT INTO eventos (nombre, slug, valor, termino, sesion, pagina, fuente, medio, campana, disp, region)
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`);
  await env.DB.batch(lote.map(e => st.bind(txt(e.n, 40), txt(e.s, 80), num(e.v, 0, 100000), txt(e.t, 80), txt(e.sid, 40), txt(e.p, 160),
    txt(e.fu, 80), txt(e.me, 80), txt(e.ca, 120), disp, region)));
  return json({ ok: true, n: lote.length });
}
