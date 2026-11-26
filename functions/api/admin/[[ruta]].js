// API privada del panel: /api/admin/...
import { json, error, txt, num, hashPassword, safeEqual, crearSesion, cerrarSesion, leerSesion, sha256, randomId,
  ESTADOS, ESTADO_NOMBRE, CODIGO_RE, sinDB } from "../../_lib/comun.js";

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
    return json({ ok: true, dias, kpi: { ...r, ticket: r.pagados ? r.ventas / r.pagados : 0, cierre: r.pedidos ? r.pagados / r.pedidos : 0 },
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
          COUNT(DISTINCT CASE WHEN nombre IN ('ver_pared','ver_3d','realidad_aumentada','personalizar') THEN sesion END) probaron,
          COUNT(DISTINCT CASE WHEN nombre='add_to_cart' THEN sesion END) agregaron
        FROM eventos WHERE fecha >= datetime('now', ?1) AND slug IS NOT NULL GROUP BY slug HAVING vieron > 0 ORDER BY vieron DESC LIMIT 40`),
      q(`SELECT lower(termino) termino, COUNT(*) veces, MIN(COALESCE(valor, 1)) min_resultados FROM eventos WHERE nombre='search' AND fecha >= datetime('now', ?1) AND termino IS NOT NULL
        GROUP BY 1 ORDER BY veces DESC LIMIT 25`),
      q(`WITH s AS (SELECT sesion, MAX(nombre='view_item') vio, MAX(nombre IN ('ver_pared','ver_3d','realidad_aumentada')) probo, MAX(nombre='generate_lead') pidio
          FROM eventos WHERE fecha >= datetime('now', ?1) GROUP BY sesion)
        SELECT probo, COUNT(*) sesiones, SUM(pidio) pedidos FROM s WHERE vio = 1 GROUP BY probo`),
      q(`SELECT COALESCE(termino,'—') metodo, COUNT(*) veces FROM eventos WHERE nombre='share' AND fecha >= datetime('now', ?1) GROUP BY 1 ORDER BY veces DESC`),
      q(`SELECT pagina, COUNT(*) vistas, COUNT(DISTINCT sesion) personas FROM eventos WHERE nombre='page_view' AND fecha >= datetime('now', ?1) GROUP BY pagina ORDER BY vistas DESC LIMIT 20`),
      q(`SELECT nombre, COUNT(*) n FROM eventos WHERE fecha >= datetime('now', ?1) AND nombre IN ('ver_pared','ver_3d','realidad_aumentada','personalizar','zoom','ver_foto','ayuda_inicio','ayuda_resultado','contacto_whatsapp','search','filtrar') GROUP BY nombre`),
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
    return json({ ok: true, pedidos: rs.results.map(parsePedido) });
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
