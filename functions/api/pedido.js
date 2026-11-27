// POST /api/pedido — la web registra cada pedido en el momento en que el cliente toca «Enviar por WhatsApp».
import { json, error, txt, num, CODIGO_RE, mismoOrigen, sinDB } from "../_lib/comun.js";

export async function onRequestPost({ request, env }) {
  if (sinDB(env)) return error("Base de datos no configurada", 503);
  if (!mismoOrigen(request)) return error("Origen no permitido", 403);
  let d;
  try { d = await request.json(); } catch { return error("JSON inválido"); }
  const codigo = txt(d.codigo, 12);
  if (!codigo || !CODIGO_RE.test(codigo)) return error("Código inválido");
  if (!Array.isArray(d.items) || !d.items.length || d.items.length > 30) return error("Sin cuadros");
  const items = d.items.map(i => ({
    s: txt(i.s, 80), n: txt(i.n, 120), qty: num(i.qty, 1, 50) || 1, precio: num(i.precio, 0, 10000) || 0,
    f: Array.isArray(i.f) ? i.f.slice(0, 5).map(([k, v]) => [txt(k, 60), txt(v, 120)]) : null,
  })).filter(i => i.s);
  if (!items.length) return error("Sin cuadros");
  const total = Math.max(0, items.reduce((a, i) => a + i.precio * i.qty, 0) - (num(d.descuento, 0, 100000) || 0));
  const o = d.origen || {};
  const region = [request.cf && request.cf.city, request.cf && request.cf.region].filter(Boolean).join(", ") || null;
  try {
    await env.DB.prepare(`INSERT OR IGNORE INTO pedidos (codigo, via, items, piezas, total, lugar, pago, regalo, fuente, medio, campana, origen, region)
      VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`)
      .bind(codigo, txt(d.via, 20), JSON.stringify(items), items.reduce((a, i) => a + i.qty, 0), total, txt(d.lugar, 120), txt(d.pago, 30),
        d.regalo ? 1 : 0, txt(o.utm_source, 80), txt(o.utm_medium, 80), txt(o.utm_campaign, 120), JSON.stringify(o).slice(0, 500), region)
      .run();
    await env.DB.prepare("INSERT INTO pedido_historial (codigo, usuario, accion) VALUES (?1, 'web', ?2)")
      .bind(codigo, `Pedido enviado por WhatsApp desde la web (${items.length} cuadro${items.length > 1 ? "s" : ""}, S/ ${total})`).run();
  } catch (e) { return error("No se pudo guardar", 500); }
  return json({ ok: true, codigo });
}
