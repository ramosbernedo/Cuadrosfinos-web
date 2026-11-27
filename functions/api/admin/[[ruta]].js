// API privada del panel: /api/admin/...
import { json, error, txt, num, hashPassword, safeEqual, crearSesion, cerrarSesion, leerSesion, sha256, randomId,
  ESTADOS, ESTADO_NOMBRE, CODIGO_RE, sinDB } from "../../_lib/comun.js";
import { SLUG_RE, catalogoBase, limpiarDatos } from "../../_lib/productos.js";

// Estilos para las imágenes generadas con IA. Cada uno: tipo de imagen, fondo, luz y acabado.
// El fondo y el «no text» van aparte para que nunca contradigan lo que pide la idea.
const ESTILOS_IA = {
  oscuro: { tipo: "black and white fine art photograph", tipoColor: "fine art photograph with muted earthy colors",
    luz: "dramatic chiaroscuro lighting, deep blacks", fondo: "negro", acabado: "museum quality, extremely detailed, sharp focus, minimalist composition" },
  claro: { tipo: "minimalist black and white fine art print, thin fine black lines", tipoColor: "minimalist fine art print, thin fine lines with subtle muted earthy color accents",
    luz: "soft even light, high contrast, generous negative space", fondo: "blanco", acabado: "clean simple elegant composition, sharp crisp details" },
  tipografico: { tipo: "minimalist typographic poster, thin black elements, elegant modern sans-serif lettering", tipoColor: "minimalist typographic poster, thin elements in muted earthy tones, elegant modern sans-serif lettering",
    luz: "flat clean design, generous negative space", fondo: "blanco", acabado: "graphic design print, crisp vector-like edges, perfectly spelled text" },
};
const FONDOS_IA = { negro: "pitch black background", blanco: "pure white background" };
// Arma el prompt final en inglés. escena: idea traducida; texto: letras exactas a escribir; fondo: el que pidió la idea (si pidió alguno).
function promptIA({ escena, texto, fondo, estilo, color }) {
  const e = ESTILOS_IA[estilo] || ESTILOS_IA.oscuro;
  const f = FONDOS_IA[fondo] ? fondo : e.fondo;
  // Fondo blanco en el estilo oscuro: el claroscuro y los negros profundos ya no tienen sentido
  const luz = estilo === "oscuro" && f === "blanco" ? "soft even studio light, high contrast" : e.luz;
  const letras = texto ? `with the text "${texto}" written clearly in elegant capital letters, spelled exactly "${texto}"` : "";
  return [`${escena}${letras ? ", " + letras : ""}.`, color ? e.tipoColor : e.tipo, luz, FONDOS_IA[f], e.acabado,
    "vertical poster artwork", texto ? "" : "no text", "no watermark, no frame"].filter(Boolean).join(", ").replace(".,", ".");
}
// Mensaje claro cuando se acaba la cuota gratis de Workers AI (se reinicia a las 00:00 UTC = 7 p. m. en Lima)
const errorIA = (e, que) => /daily free allocation|neurons/i.test(String(e && e.message || e))
  ? error("Se acabó la cuota gratis de IA de hoy. Se renueva a las 7 p. m. (hora de Lima).", 429)
  : error(`La IA no pudo ${que}: ` + String(e && e.message || e).slice(0, 120), 502);
const aBase64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const SLUGIFY = t => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

const AVANZADOS = ["pagado", "produccion", "listo", "enviado", "entregado"];
const EN_CURSO = ["pagado", "produccion", "listo", "enviado"];
const CAMPOS = { cliente: 120, telefono: 30, direccion: 240, notas: 2000, envio_tipo: 20, agencia: 80, guia: 80, lugar: 120, pago: 30,
  fecha_prometida: 10, fecha_envio: 10, fecha_entrega: 10 };
const NUMS = { total_final: [0, 100000], costo_envio: [0, 5000] };
const ETIQUETA = { cliente: "Cliente", telefono: "Teléfono", direccion: "Dirección", notas: "Notas", envio_tipo: "Tipo de envío", agencia: "Agencia",
  guia: "Guía", lugar: "Lugar", pago: "Pago", fecha_prometida: "Fecha prometida", fecha_envio: "Fecha de envío", fecha_entrega: "Fecha de entrega",
  total_final: "Total cobrado", costo_envio: "Costo de envío" };

const rango = url => Math.min(365, Math.max(1, Number(new URL(url).searchParams.get("dias")) || 30));
const parsePedido = p => p && ({ ...p, items: JSON.parse(p.items || "[]"), regalo: !!p.regalo });
async function historial(env, codigo, usuario, accion) {
  await env.DB.prepare("INSERT INTO pedido_historial (codigo, usuario, accion) VALUES (?1, ?2, ?3)").bind(codigo, usuario, accion).run();
}

export async function onRequest(ctx) {
  const { request, env, params } = ctx;
  if (sinDB(env)) return error("Base de datos no configurada", 503);
  if (!env.SESSION_SECRET) return error("Falta SESSION_SECRET", 503);
  const ruta = (params.ruta || []).join("/");
  const m = request.method;
  const body = async () => { try { return await request.json(); } catch { return {}; } };

  // ---------- públicos del panel (sin sesión) ----------
  if (ruta === "estado") {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM usuarios").first("n");
    const u = await leerSesion(request, env);
    return json({ ok: true, necesitaSetup: !n, usuario: u });
  }
  if (ruta === "setup" && m === "POST") {
    const n = await env.DB.prepare("SELECT COUNT(*) n FROM usuarios").first("n");
    if (n) return error("El panel ya tiene usuarios", 409);
    const d = await body();
    if (!env.SETUP_KEY || !safeEqual(String(d.clave || ""), env.SETUP_KEY)) return error("Clave de instalación incorrecta", 403);
    const email = txt(d.email, 120)?.toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error("Correo inválido");
    if (!d.password || String(d.password).length < 10) return error("La contraseña debe tener al menos 10 caracteres");
    const { hash, sal } = await hashPassword(String(d.password));
    await env.DB.prepare("INSERT INTO usuarios (email, nombre, hash, sal, rol) VALUES (?1, ?2, ?3, ?4, 'admin')").bind(email, txt(d.nombre, 80), hash, sal).run();
    return json({ ok: true }, 200, { "set-cookie": await crearSesion(env, { email, nombre: txt(d.nombre, 80), rol: "admin" }) });
  }
  if (ruta === "login" && m === "POST") {
    const d = await body();
    const email = (txt(d.email, 120) || "").toLowerCase();
    const clave = await sha256((request.headers.get("cf-connecting-ip") || "local") + "|" + email);
    const intentos = await env.DB.prepare("SELECT COUNT(*) n FROM intentos WHERE clave = ?1 AND fecha > datetime('now','-15 minutes')").bind(clave).first("n");
    if (intentos >= 8) return error("Demasiados intentos. Espera 15 minutos.", 429);
    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE email = ?1").bind(email).first();
    const ok = u && safeEqual((await hashPassword(String(d.password || ""), u.sal)).hash, u.hash);
    if (!ok) {
      await env.DB.prepare("INSERT INTO intentos (clave) VALUES (?1)").bind(clave).run();
      return error("Correo o contraseña incorrectos", 401);
    }
    await env.DB.prepare("DELETE FROM intentos WHERE clave = ?1 OR fecha < datetime('now','-1 day')").bind(clave).run();
    return json({ ok: true, usuario: { email: u.email, nombre: u.nombre, rol: u.rol } }, 200, { "set-cookie": await crearSesion(env, u) });
  }
  if (ruta === "logout") return json({ ok: true }, 200, { "set-cookie": cerrarSesion() });

  // ---------- requieren sesión ----------
  const yo = await leerSesion(request, env);
  if (!yo) return error("Inicia sesión", 401);
  const quien = yo.nombre || yo.email;

  if (ruta === "sistema") {
    const r = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM pedidos) pedidos, (SELECT COUNT(*) FROM productos) productos, (SELECT COUNT(*) FROM eventos) eventos, (SELECT MAX(fecha) FROM eventos) ultimo`).first();
    return json({ ok: true, db: true, ia: !!env.AI, sesion: !!env.SESSION_SECRET, pedidos: r.pedidos, productos: r.productos, eventos: r.eventos, ultimoEvento: r.ultimo || null });
  }
  if (ruta === "pulso") {
    const r = await env.DB.prepare(`SELECT SUM(estado='nuevo') nuevos, SUM(estado IN ('pagado','produccion','listo') AND fecha_prometida < date('now')) atrasados,
      MAX(creado) ultimo FROM pedidos`).first();
    return json({ ok: true, nuevos: r.nuevos || 0, atrasados: r.atrasados || 0, ultimo: r.ultimo });
  }

  // Resumen de ventas, entregas y embudo
  if (ruta === "resumen") {
    const dias = rango(request.url), desde = `-${dias} days`;
    const av = AVANZADOS.map(e => `'${e}'`).join(",");
    const [k, porEstado, top, fuentes, serie, entregas, embudo, vistos] = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) pedidos,
          SUM(estado NOT IN ('nuevo','cancelado')) confirmados,
          SUM(estado IN (${av})) pagados,
          COALESCE(SUM(CASE WHEN estado IN (${av}) THEN COALESCE(total_final, total) END),0) ventas,
          COALESCE(SUM(total),0) cotizado
        FROM pedidos WHERE creado >= datetime('now', ?1)`).bind(desde),
      env.DB.prepare("SELECT estado, COUNT(*) n FROM pedidos GROUP BY estado"),
      env.DB.prepare(`SELECT json_extract(j.value,'$.s') s, json_extract(j.value,'$.n') n, SUM(json_extract(j.value,'$.qty')) piezas, COUNT(DISTINCT p.codigo) pedidos,
          SUM(CASE WHEN p.estado IN (${av}) THEN json_extract(j.value,'$.qty') ELSE 0 END) vendidos
        FROM pedidos p, json_each(p.items) j WHERE p.creado >= datetime('now', ?1) GROUP BY s ORDER BY pedidos DESC, piezas DESC LIMIT 10`).bind(desde),
      env.DB.prepare(`SELECT COALESCE(fuente,'directo') fuente, COUNT(*) pedidos, SUM(estado IN (${av})) pagados,
          COALESCE(SUM(CASE WHEN estado IN (${av}) THEN COALESCE(total_final,total) END),0) ventas
        FROM pedidos WHERE creado >= datetime('now', ?1) GROUP BY 1 ORDER BY pedidos DESC LIMIT 10`).bind(desde),
      env.DB.prepare(`SELECT date(creado) dia, COUNT(*) pedidos, SUM(estado IN (${av})) pagados FROM pedidos
        WHERE creado >= datetime('now', ?1) GROUP BY dia ORDER BY dia`).bind(desde),
      env.DB.prepare(`SELECT SUM(estado IN (${EN_CURSO.map(e => `'${e}'`).join(",")})) en_curso,
          SUM(estado IN ('pagado','produccion','listo') AND fecha_prometida < date('now')) atrasados,
          SUM(estado = 'enviado') enviados, SUM(estado = 'entregado' AND fecha_entrega >= date('now','-7 days')) entregados_7d FROM pedidos`),
      env.DB.prepare(`SELECT nombre, COUNT(DISTINCT sesion) sesiones FROM eventos WHERE fecha >= datetime('now', ?1)
          AND nombre IN ('page_view','view_item','add_to_cart','view_cart','begin_checkout','generate_lead') GROUP BY nombre`).bind(desde),
      env.DB.prepare(`SELECT slug s, COUNT(*) vistas, COUNT(DISTINCT sesion) personas FROM eventos WHERE nombre='view_item' AND fecha >= datetime('now', ?1)
          GROUP BY slug ORDER BY vistas DESC LIMIT 10`).bind(desde),
    ]);
    const r = k.results[0] || {};
    const hasta2 = desde, desde2 = `-${dias * 2} days`;
    const [kp, embp, nuevos, atrasados, listos, resp] = await env.DB.batch([
      env.DB.prepare(`SELECT COUNT(*) pedidos, SUM(estado IN (${av})) pagados,
          COALESCE(SUM(CASE WHEN estado IN (${av}) THEN COALESCE(total_final, total) END),0) ventas
        FROM pedidos WHERE creado >= datetime('now', ?1) AND creado < datetime('now', ?2)`).bind(desde2, hasta2),
      env.DB.prepare(`SELECT nombre, COUNT(DISTINCT sesion) sesiones FROM eventos WHERE fecha >= datetime('now', ?1) AND fecha < datetime('now', ?2)
          AND nombre IN ('page_view','add_to_cart','generate_lead') GROUP BY nombre`).bind(desde2, hasta2),
      env.DB.prepare(`SELECT codigo, creado, total, cliente, lugar, items, fuente FROM pedidos WHERE estado = 'nuevo' ORDER BY creado ASC LIMIT 8`),
      env.DB.prepare(`SELECT codigo, creado, total, cliente, lugar, items, estado, fecha_prometida FROM pedidos
          WHERE estado IN ('pagado','produccion','listo') AND fecha_prometida < date('now') ORDER BY fecha_prometida ASC LIMIT 8`),
      env.DB.prepare(`SELECT codigo, creado, total, cliente, lugar, items, estado, fecha_prometida, envio_tipo FROM pedidos WHERE estado = 'listo' ORDER BY fecha_prometida ASC LIMIT 8`),
      env.DB.prepare(`SELECT AVG((julianday(h.fecha) - julianday(p.creado)) * 1440) minutos, COUNT(*) n FROM pedidos p
          JOIN (SELECT codigo, MIN(fecha) fecha FROM pedido_historial WHERE accion LIKE 'Estado: Nuevo →%' GROUP BY codigo) h ON h.codigo = p.codigo
          WHERE p.creado >= datetime('now', ?1)`).bind(desde),
    ]);
    const prev = kp.results[0] || {};
    const corto = rs => rs.results.map(x => ({ ...x, items: JSON.parse(x.items || "[]").map(i => i.n) }));
    return json({ ok: true, dias,
      previo: { ...prev, ticket: prev.pagados ? prev.ventas / prev.pagados : 0, cierre: prev.pedidos ? prev.pagados / prev.pedidos : 0,
        embudo: Object.fromEntries(embp.results.map(x => [x.nombre, x.sesiones])) },
      pendientes: corto(nuevos), atrasadosLista: corto(atrasados), listos: corto(listos),
      respuesta: { minutos: resp.results[0] && resp.results[0].minutos, n: resp.results[0] ? resp.results[0].n : 0 },
      kpi: { ...r, ticket: r.pagados ? r.ventas / r.pagados : 0, cierre: r.pedidos ? r.pagados / r.pedidos : 0 },
      porEstado: Object.fromEntries(porEstado.results.map(x => [x.estado, x.n])), top: top.results, fuentes: fuentes.results,
      serie: serie.results, entregas: entregas.results[0] || {}, embudo: Object.fromEntries(embudo.results.map(x => [x.nombre, x.sesiones])),
      vistos: vistos.results });
  }

  // Marketing: tráfico, fuentes, productos, búsquedas e interacciones
  if (ruta === "marketing") {
    const dias = rango(request.url), desde = `-${dias} days`;
    const q = (sql, ...b) => env.DB.prepare(sql).bind(desde, ...b);
    const [dia, fuentes, disp, regiones, productos, busquedas, inter, compartir, paginas, listas, embudoFuente] = await env.DB.batch([
      q(`SELECT date(fecha) dia, COUNT(DISTINCT sesion) sesiones, SUM(nombre='generate_lead') pedidos FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY dia ORDER BY dia`),
      q(`SELECT COALESCE(fuente,'directo') fuente, COALESCE(medio,'') medio, COALESCE(campana,'') campana, COUNT(DISTINCT sesion) sesiones,
          COUNT(DISTINCT CASE WHEN nombre='add_to_cart' THEN sesion END) agregaron, COUNT(DISTINCT CASE WHEN nombre='generate_lead' THEN sesion END) pedidos
        FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY 1,2,3 ORDER BY sesiones DESC LIMIT 25`),
      q(`SELECT disp, COUNT(DISTINCT sesion) sesiones, COUNT(DISTINCT CASE WHEN nombre='generate_lead' THEN sesion END) pedidos FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY disp ORDER BY sesiones DESC`),
      q(`SELECT COALESCE(region,'—') region, COUNT(DISTINCT sesion) sesiones, COUNT(DISTINCT CASE WHEN nombre='generate_lead' THEN sesion END) pedidos FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY 1 ORDER BY sesiones DESC LIMIT 12`),
      q(`SELECT slug s, COUNT(DISTINCT CASE WHEN nombre='view_item' THEN sesion END) vieron,
          COUNT(DISTINCT CASE WHEN nombre IN ('ver_pared','personalizar') THEN sesion END) probaron,
          COUNT(DISTINCT CASE WHEN nombre='add_to_cart' THEN sesion END) agregaron
        FROM eventos WHERE fecha >= datetime('now', ?1) AND slug IS NOT NULL GROUP BY slug HAVING vieron > 0 ORDER BY vieron DESC LIMIT 40`),
      q(`SELECT lower(termino) termino, COUNT(*) veces, MIN(COALESCE(valor, 1)) min_resultados FROM eventos WHERE nombre='search' AND fecha >= datetime('now', ?1) AND termino IS NOT NULL
        GROUP BY 1 ORDER BY veces DESC LIMIT 25`),
      q(`WITH s AS (SELECT sesion, MAX(nombre='view_item') vio, MAX(nombre = 'ver_pared') probo, MAX(nombre='generate_lead') pidio
          FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY sesion)
        SELECT probo, COUNT(*) sesiones, SUM(pidio) pedidos FROM s WHERE vio = 1 GROUP BY probo`),
      q(`SELECT COALESCE(termino,'—') metodo, COUNT(*) veces FROM eventos WHERE nombre='share' AND fecha >= datetime('now', ?1) GROUP BY 1 ORDER BY veces DESC`),
      q(`SELECT pagina, COUNT(*) vistas, COUNT(DISTINCT sesion) personas FROM eventos WHERE nombre='page_view' AND fecha >= datetime('now', ?1) GROUP BY pagina ORDER BY vistas DESC LIMIT 20`),
      q(`SELECT nombre, COUNT(*) n FROM eventos WHERE fecha >= datetime('now', ?1) AND nombre IN ('ver_pared','personalizar','zoom','ver_foto','ayuda_inicio','ayuda_resultado','contacto_whatsapp','search','filtrar') GROUP BY nombre`),
      q(`SELECT COALESCE(fuente,'directo') fuente, COUNT(DISTINCT sesion) visitas, COUNT(DISTINCT CASE WHEN nombre='view_item' THEN sesion END) vieron,
          COUNT(DISTINCT CASE WHEN nombre='add_to_cart' THEN sesion END) agregaron, COUNT(DISTINCT CASE WHEN nombre='generate_lead' THEN sesion END) pidieron
        FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY 1 ORDER BY visitas DESC LIMIT 8`),
    ]);
    // pedidos y ventas reales por cuadro (desde la tabla de pedidos)
    const av = AVANZADOS.map(e => `'${e}'`).join(",");
    const ventas = await env.DB.prepare(`SELECT json_extract(j.value,'$.s') s, COUNT(DISTINCT p.codigo) pedidos,
        SUM(CASE WHEN p.estado IN (${av}) THEN json_extract(j.value,'$.qty') ELSE 0 END) vendidos,
        SUM(CASE WHEN p.estado IN (${av}) THEN json_extract(j.value,'$.qty') * json_extract(j.value,'$.precio') ELSE 0 END) ventas
      FROM pedidos p, json_each(p.items) j WHERE p.creado >= datetime('now', ?1) GROUP BY s`).bind(desde).all();
    const vmap = Object.fromEntries(ventas.results.map(v => [v.s, v]));
    const prods = productos.results.map(x => ({ ...x, ...(vmap[x.s] || { pedidos: 0, vendidos: 0, ventas: 0 }) }));
    for (const v of ventas.results) if (!prods.some(x => x.s === v.s)) prods.push({ s: v.s, vieron: 0, probaron: 0, agregaron: 0, ...v });
    return json({ ok: true, dias, dia: dia.results, fuentes: fuentes.results, disp: disp.results, regiones: regiones.results, productos: prods,
      busquedas: busquedas.results, interaccion: inter.results, compartir: compartir.results, paginas: paginas.results,
      uso: Object.fromEntries(listas.results.map(x => [x.nombre, x.n])), embudoFuente: embudoFuente.results });
  }

  // Lista de pedidos
  if (ruta === "pedidos" && m === "GET") {
    const u = new URL(request.url).searchParams;
    const where = [], bind = [];
    const estado = u.get("estado");
    if (estado === "activos") where.push("estado NOT IN ('entregado','cancelado')");
    else if (estado === "entregas") where.push(`estado IN (${EN_CURSO.map(e => `'${e}'`).join(",")})`);
    else if (ESTADOS.includes(estado)) { where.push(`estado = ?${bind.length + 1}`); bind.push(estado); }
    const q = txt(u.get("q"), 80);
    if (q) { where.push(`(codigo LIKE ?${bind.length + 1} OR cliente LIKE ?${bind.length + 1} OR telefono LIKE ?${bind.length + 1} OR lugar LIKE ?${bind.length + 1} OR items LIKE ?${bind.length + 1})`); bind.push(`%${q}%`); }
    const orden = estado === "entregas" ? "COALESCE(fecha_prometida,'9999') ASC, creado ASC" : "creado DESC";
    const lim = Math.min(200, Number(u.get("limite")) || 100);
    const rs = await env.DB.prepare(`SELECT * FROM pedidos ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${orden} LIMIT ${lim}`).bind(...bind).all();
    const cnt = await env.DB.prepare("SELECT estado, COUNT(*) n FROM pedidos GROUP BY estado").all();
    return json({ ok: true, pedidos: rs.results.map(parsePedido), conteo: Object.fromEntries(cnt.results.map(x => [x.estado, x.n])) });
  }

  // Crear un pedido a mano (ventas por Instagram, tienda, etc.)
  if (ruta === "pedidos" && m === "POST") {
    const d = await body();
    const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let codigo; do { codigo = "CF-" + Array.from(crypto.getRandomValues(new Uint8Array(4)), b => A[b % A.length]).join(""); }
    while (await env.DB.prepare("SELECT 1 FROM pedidos WHERE codigo = ?1").bind(codigo).first());
    const items = (Array.isArray(d.items) ? d.items : []).slice(0, 30).map(i => ({ s: txt(i.s, 80), n: txt(i.n, 120), qty: num(i.qty, 1, 50) || 1, precio: num(i.precio, 0, 10000) || 0, f: null })).filter(i => i.s || i.n);
    if (!items.length) return error("Agrega al menos un cuadro");
    const total = items.reduce((a, i) => a + i.precio * i.qty, 0);
    await env.DB.prepare(`INSERT INTO pedidos (codigo, via, estado, items, piezas, total, cliente, telefono, lugar, fuente, notas)
      VALUES (?1,'panel','confirmado',?2,?3,?4,?5,?6,?7,?8,?9)`).bind(codigo, JSON.stringify(items), items.reduce((a, i) => a + i.qty, 0), total,
      txt(d.cliente, 120), txt(d.telefono, 30), txt(d.lugar, 120), txt(d.fuente, 80) || "panel", txt(d.notas, 2000)).run();
    await historial(env, codigo, quien, "Pedido creado en el panel");
    return json({ ok: true, codigo });
  }

  // Un pedido
  const mp = ruta.match(/^pedidos\/(CF-[2-9A-Z]{4,8})$/);
  if (mp) {
    const codigo = mp[1];
    const p = await env.DB.prepare("SELECT * FROM pedidos WHERE codigo = ?1").bind(codigo).first();
    if (!p) return error("No existe ese pedido", 404);
    if (m === "GET") {
      const h = await env.DB.prepare("SELECT fecha, usuario, accion FROM pedido_historial WHERE codigo = ?1 ORDER BY id DESC").bind(codigo).all();
      return json({ ok: true, pedido: parsePedido(p), historial: h.results });
    }
    if (m === "PATCH") {
      const d = await body(), sets = [], vals = [], cambios = [];
      for (const [k, max] of Object.entries(CAMPOS)) if (k in d) {
        const v = txt(d[k], max); if ((p[k] || null) !== v) { sets.push(k); vals.push(v); cambios.push(`${ETIQUETA[k]}: ${v || "—"}`); }
      }
      for (const [k, [a, b]] of Object.entries(NUMS)) if (k in d) {
        const v = d[k] === "" || d[k] == null ? null : num(d[k], a, b); if (p[k] !== v) { sets.push(k); vals.push(v); cambios.push(`${ETIQUETA[k]}: ${v == null ? "—" : "S/ " + v}`); }
      }
      if ("estado" in d && d.estado !== p.estado) {
        if (!ESTADOS.includes(d.estado)) return error("Estado inválido");
        sets.push("estado"); vals.push(d.estado); cambios.unshift(`Estado: ${ESTADO_NOMBRE[p.estado]} → ${ESTADO_NOMBRE[d.estado]}`);
        const hoy = new Date().toISOString().slice(0, 10);
        if (d.estado === "pagado" && !p.fecha_prometida && !("fecha_prometida" in d)) { sets.push("fecha_prometida"); vals.push(new Date(Date.now() + 8 * 864e5).toISOString().slice(0, 10)); }
        if (d.estado === "enviado" && !p.fecha_envio && !("fecha_envio" in d)) { sets.push("fecha_envio"); vals.push(hoy); }
        if (d.estado === "entregado" && !p.fecha_entrega && !("fecha_entrega" in d)) { sets.push("fecha_entrega"); vals.push(hoy); }
      }
      if (!sets.length) return json({ ok: true, pedido: parsePedido(p) });
      await env.DB.prepare(`UPDATE pedidos SET ${sets.map((k, i) => `${k} = ?${i + 1}`).join(", ")}, actualizado = datetime('now') WHERE codigo = ?${sets.length + 1}`)
        .bind(...vals, codigo).run();
      await historial(env, codigo, quien, cambios.join(" · "));
      const n = await env.DB.prepare("SELECT * FROM pedidos WHERE codigo = ?1").bind(codigo).first();
      return json({ ok: true, pedido: parsePedido(n) });
    }
  }

  // ---------- Productos (cuadros creados o cambiados desde el panel) ----------
  if (ruta === "productos" && m === "GET") {
    const rs = await env.DB.prepare("SELECT slug, datos, estado, base, creado, actualizado, autor FROM productos ORDER BY actualizado DESC").all();
    return json({ ok: true, productos: rs.results.map(r => ({ ...r, datos: JSON.parse(r.datos) })) });
  }
  if (ruta === "productos" && m === "POST") {
    const d = await body();
    const cat = await catalogoBase(env, request);
    let datos; try { datos = limpiarDatos(d.datos || {}, cat.colecciones); } catch (e) { return error(e.message); }
    const existeWeb = cat.productos.some(x => x.s === d.slug);
    let slug = d.slug && SLUG_RE.test(d.slug) ? d.slug : SLUGIFY(datos.n);
    if (!slug) return error("No se pudo crear la dirección del cuadro");
    const previo = await env.DB.prepare("SELECT slug, base FROM productos WHERE slug = ?1").bind(slug).first();
    if (d.nuevo && (existeWeb || previo)) {
      let i = 2; while (cat.productos.some(x => x.s === `${slug}-${i}`) || await env.DB.prepare("SELECT 1 FROM productos WHERE slug = ?1").bind(`${slug}-${i}`).first()) i++;
      slug = `${slug}-${i}`;
    }
    const estado = ["borrador", "publicado", "oculto"].includes(d.estado) ? d.estado : "borrador";
    const base = !d.nuevo && existeWeb ? 1 : 0;
    await env.DB.prepare(`INSERT INTO productos (slug, datos, estado, base, autor) VALUES (?1, ?2, ?3, ?4, ?5)
      ON CONFLICT(slug) DO UPDATE SET datos = ?2, estado = ?3, actualizado = datetime('now'), autor = ?5`).bind(slug, JSON.stringify(datos), estado, base, quien).run();
    return json({ ok: true, slug, estado });
  }
  const mpr = ruta.match(/^productos\/([a-z0-9-]+)$/);
  if (mpr && m === "PATCH") {
    const d = await body();
    if (!["borrador", "publicado", "oculto"].includes(d.estado)) return error("Estado inválido");
    const r = await env.DB.prepare("UPDATE productos SET estado = ?1, actualizado = datetime('now'), autor = ?2 WHERE slug = ?3").bind(d.estado, quien, mpr[1]).run();
    if (!r.meta.changes) {   // ocultar un cuadro de la web que aún no tiene fila
      const cat = await catalogoBase(env, request);
      const x = cat.productos.find(y => y.s === mpr[1]); if (!x) return error("No existe ese cuadro", 404);
      const { s: _s, ...datos } = x;
      await env.DB.prepare("INSERT INTO productos (slug, datos, estado, base, autor) VALUES (?1, ?2, ?3, 1, ?4)").bind(mpr[1], JSON.stringify(datos), d.estado, quien).run();
    }
    return json({ ok: true });
  }
  if (mpr && m === "DELETE") {
    await env.DB.prepare("DELETE FROM productos WHERE slug = ?1").bind(mpr[1]).run();   // vuelve a como está en la web (o borra el borrador)
    await env.DB.prepare("DELETE FROM media WHERE clave LIKE ?1").bind(mpr[1] + "/%").run();
    return json({ ok: true });
  }
  // Subir una imagen (cuerpo binario): PUT /api/admin/media/<slug>/<archivo>
  const mme = ruta.match(/^media\/([a-z0-9-]+\/[a-z0-9.-]+)$/);
  if (mme && m === "PUT") {
    const tipo = request.headers.get("content-type") || "";
    if (!/^image\/(webp|jpeg|png)$/.test(tipo)) return error("Formato de imagen no permitido");
    const buf = await request.arrayBuffer();
    if (buf.byteLength > 1.8 * 1024 * 1024) return error("Imagen muy pesada (máx. 1,8 MB)");
    await env.DB.prepare("INSERT INTO media (clave, tipo, datos) VALUES (?1, ?2, ?3) ON CONFLICT(clave) DO UPDATE SET tipo = ?2, datos = ?3, creado = datetime('now')")
      .bind(mme[1], tipo, buf).run();
    return json({ ok: true, url: "/media/" + mme[1] });
  }
  // IA: entender la idea una sola vez (antes de las 4 imágenes): traducirla al inglés y separar el texto a escribir y el fondo pedido
  if (ruta === "ia/prompt" && m === "POST") {
    if (!env.AI) return error("La IA no está conectada", 503);
    const d = await body();
    const idea = txt(d.idea, 400); if (!idea) return error("Escribe la idea del cuadro");
    const sys = `You turn a Spanish description of a wall art print into instructions for an image model. Reply ONLY with valid JSON: {"escena": "...", "texto": "...", "fondo": "..."}.
- escena: faithful English translation of the visual description, concrete and literal (e.g. "cruz" = "a simple Latin cross", NOT a crucifix with Jesus unless asked). Keep every detail (thin, minimalist, colors, layout). Do not mention the background color here and do not add a style.
- texto: the exact words that must appear written in the image, in their original language and capitalization (e.g. "JESUCRISTO"), or "" if no text is requested.
- fondo: "blanco" if a white or light background is requested, "negro" if a black or dark one is requested, otherwise "".`;
    try {
      const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: idea }], max_tokens: 300, temperature: 0.2 });
      const j = typeof r.response === "object" && r.response ? r.response : (t => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)))(String(r.response || ""));
      return json({ ok: true, escena: txt(j.escena, 600) || idea, texto: txt(j.texto, 60), fondo: FONDOS_IA[j.fondo] ? j.fondo : "" });
    } catch (e) {
      // Sin traducción también se puede generar: se usa la idea tal cual y el texto entre comillas, si lo hay
      const q = idea.match(/[«"“]([^»"”]{1,60})[»"”]/);
      return json({ ok: true, escena: idea, texto: q ? q[1] : "", fondo: /fondo (blanco|claro)/i.test(idea) ? "blanco" : /fondo (negro|oscuro)/i.test(idea) ? "negro" : "", aviso: "Sin traducir" });
    }
  }
  // IA: imagen a partir de la idea ya entendida (o de la idea cruda, si no pasó por ia/prompt)
  if (ruta === "ia/imagen" && m === "POST") {
    if (!env.AI) return error("La IA no está conectada", 503);
    const d = await body();
    const idea = txt(d.idea, 400); const escena = txt(d.escena, 600) || idea;
    if (!escena) return error("Escribe la idea del cuadro");
    const estilo = ESTILOS_IA[d.estilo] ? d.estilo : "oscuro";
    const prompt = promptIA({ escena, texto: txt(d.texto, 60), fondo: d.fondo, estilo, color: !!d.color });
    try {
      if (estilo === "tipografico") {
        // Phoenix 1.0 (Leonardo) escribe letras mucho mejor que FLUX schnell, pero cuesta más cuota
        const r = await env.AI.run("@cf/leonardo/phoenix-1.0", { prompt, width: 768, height: 1152, num_steps: 20, guidance: 4,
          seed: Math.floor(Math.random() * 2 ** 31), negative_prompt: "misspelled text, extra letters, gibberish, blurry, watermark, frame, photo" });
        return json({ ok: true, imagen: "data:image/jpeg;base64," + aBase64(await new Response(r).arrayBuffer()), prompt });
      }
      const r = await env.AI.run("@cf/black-forest-labs/flux-1-schnell", { prompt, steps: 8 });
      return json({ ok: true, imagen: "data:image/jpeg;base64," + r.image, prompt });
    } catch (e) { return errorIA(e, "generar la imagen"); }
  }
  // IA: nombre, frase, colección y ambientes
  if (ruta === "ia/textos" && m === "POST") {
    if (!env.AI) return error("La IA no está conectada", 503);
    const d = await body();
    const idea = txt(d.idea, 400); if (!idea) return error("Escribe la idea del cuadro");
    const cat = await catalogoBase(env, request);
    const cols = cat.colecciones.map(c => `${c.id} (${c.nombre}: ${c.bajada})`).join("; ");
    const ejemplos = cat.productos.filter(x => x.i).slice(0, 12).map(x => `«${x.n}» — ${x.f}`).join(" | ");
    const sys = `Eres el redactor de Cuadros Finos, tienda peruana de cuadros en blanco y negro con marco. Estilo: nombres cortos con «·» (ej. «León · Fuerza»), frases breves, poéticas y con fuerza, en español de Perú, sin emojis. Responde SOLO un JSON válido.`;
    const user = `Idea del cuadro: ${idea}\nEjemplos de la tienda: ${ejemplos}\nColecciones posibles: ${cols}\nAmbientes posibles: sala, dormitorio, oficina, comedor.\nDevuelve: {"nombre": "...", "frase": "... (máx. 9 palabras)", "coleccion": "id", "ambientes": ["..."], "descripcion": "2 oraciones para la ficha (sin precio)"}`;
    try {
      const r = await env.AI.run("@cf/meta/llama-3.3-70b-instruct-fp8-fast", { messages: [{ role: "system", content: sys }, { role: "user", content: user }], max_tokens: 350, temperature: 0.7 });
      const j = typeof r.response === "object" && r.response ? r.response : (t => JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1)))(String(r.response || ""));
      const col = cat.colecciones.some(c => c.id === j.coleccion) ? j.coleccion : cat.colecciones[0].id;
      return json({ ok: true, nombre: txt(j.nombre, 80), frase: txt(j.frase, 160), coleccion: col,
        ambientes: (Array.isArray(j.ambientes) ? j.ambientes : []).filter(a => ["sala", "dormitorio", "oficina", "comedor"].includes(a)), descripcion: txt(j.descripcion, 600) });
    } catch (e) { if (/daily free allocation|neurons/i.test(String(e.message || e))) return errorIA(e, "proponer textos");
      return error("La IA no pudo proponer textos. Escríbelos tú. (" + String(e.message || e).slice(0, 140) + ")", 502); }
  }

  // Usuarios del panel
  if (ruta === "usuarios" && m === "GET") {
    const rs = await env.DB.prepare("SELECT email, nombre, rol, creado FROM usuarios ORDER BY creado").all();
    return json({ ok: true, usuarios: rs.results });
  }
  if (ruta === "usuarios" && m === "POST") {
    if (yo.rol !== "admin") return error("Solo un administrador puede agregar usuarios", 403);
    const d = await body();
    const email = txt(d.email, 120)?.toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return error("Correo inválido");
    const temporal = randomId(5);
    const { hash, sal } = await hashPassword(temporal);
    try { await env.DB.prepare("INSERT INTO usuarios (email, nombre, hash, sal, rol) VALUES (?1,?2,?3,?4,?5)").bind(email, txt(d.nombre, 80), hash, sal, d.rol === "admin" ? "admin" : "equipo").run(); }
    catch { return error("Ese correo ya tiene acceso", 409); }
    return json({ ok: true, temporal });
  }
  const mu = ruta.match(/^usuarios\/(.+)$/);
  if (mu && m === "DELETE") {
    if (yo.rol !== "admin") return error("Solo un administrador puede quitar usuarios", 403);
    const email = decodeURIComponent(mu[1]).toLowerCase();
    if (email === yo.email) return error("No puedes quitarte a ti mismo");
    await env.DB.prepare("DELETE FROM usuarios WHERE email = ?1").bind(email).run();
    return json({ ok: true });
  }
  if (ruta === "clave" && m === "POST") {
    const d = await body();
    const u = await env.DB.prepare("SELECT * FROM usuarios WHERE email = ?1").bind(yo.email).first();
    if (!u || !safeEqual((await hashPassword(String(d.actual || ""), u.sal)).hash, u.hash)) return error("La contraseña actual no es correcta", 403);
    if (!d.nueva || String(d.nueva).length < 10) return error("La nueva contraseña debe tener al menos 10 caracteres");
    const { hash, sal } = await hashPassword(String(d.nueva));
    await env.DB.prepare("UPDATE usuarios SET hash = ?1, sal = ?2 WHERE email = ?3").bind(hash, sal, yo.email).run();
    return json({ ok: true });
  }
  return error("Ruta no encontrada", 404);
}
