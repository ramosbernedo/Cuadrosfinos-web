/* Panel de Cuadros Finos: resumen, pedidos, entregas y ajustes. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const soles = n => "S/ " + Math.round(Number(n) || 0).toLocaleString("es-PE");
const pct = n => (n * 100).toFixed(n && n < .1 ? 1 : 0) + "%";
const CAT = window.CATALOGO || { productos: [], config: {} };
const BY = Object.fromEntries(CAT.productos.map(x => [x.s, x]));
const thumb = s => { const x = BY[s]; if (!x || !x.i) return "/img/favicon.svg";
  const pz = x.o === "triptico" || x.o === "diptico" ? "-1" : "";
  return x.m ? `/media/${s}/t${pz}.webp?v=${encodeURIComponent(x.m)}` : `/img/cuadros/t/${s}${pz}.webp`; };
const ESTADOS = [["nuevo", "Nuevo"], ["confirmado", "Confirmado"], ["pagado", "Pagado"], ["produccion", "En producción"], ["listo", "Listo"], ["enviado", "Enviado"], ["entregado", "Entregado"], ["cancelado", "Cancelado"]];
const EN = Object.fromEntries(ESTADOS);
const est = e => `<span class="est est--${esc(e)}">${esc(EN[e] || e)}</span>`;
const hace = f => {
  const d = (Date.now() - new Date(f.replace(" ", "T") + "Z")) / 1000;
  return d < 60 ? "hace un momento" : d < 3600 ? `hace ${Math.floor(d / 60)} min` : d < 86400 ? `hace ${Math.floor(d / 3600)} h` : d < 172800 ? "ayer" : `hace ${Math.floor(d / 86400)} días`;
};
const fecha = f => f ? new Date(f.length === 10 ? f + "T12:00:00" : f.replace(" ", "T") + "Z").toLocaleDateString("es-PE", { day: "numeric", month: "short" }) : "—";
const hoy = () => new Date().toISOString().slice(0, 10);
let toastT;
const toast = m => { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 2600); };

async function api(ruta, opt = {}) {
  const r = await fetch("/api/admin/" + ruta, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opt, body: opt.body ? JSON.stringify(opt.body) : undefined });
  const d = await r.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor" }));
  if (r.status === 401 && ruta !== "login") { YO = null; render(); throw new Error("Sesión vencida"); }
  if (!d.ok) throw new Error(d.error || "Error");
  return d;
}

let YO = null, DIAS = 30, FILTRO = "activos", BUSCA = "";
const app = $("#app");

/* ---------- ingreso ---------- */
function vistaIngreso(setup) {
  app.innerHTML = `<div class="login"><form id="f">
    <div class="marca"><span class="wm"><i></i></span><h1>Panel</h1></div>
    <p class="muted small">${setup ? "Primera vez: crea la cuenta de administrador con la clave de instalación." : "Cuadros Finos · solo para el equipo."}</p>
    ${setup ? `<label class="f"><span>Clave de instalación</span><input name="clave" required autocomplete="off"></label>
    <label class="f"><span>Tu nombre</span><input name="nombre" required></label>` : ""}
    <label class="f"><span>Correo</span><input name="email" type="email" required autocomplete="username"></label>
    <label class="f"><span>Contraseña${setup ? " (mínimo 10 caracteres)" : ""}</span><input name="password" type="password" required minlength="${setup ? 10 : 1}" autocomplete="${setup ? "new-password" : "current-password"}"></label>
    <p class="err" id="err" hidden></p>
    <button class="btn btn--p btn--block">${setup ? "Crear cuenta y entrar" : "Entrar"}</button></form></div>`;
  $("#f").addEventListener("submit", async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    try { await api(setup ? "setup" : "login", { method: "POST", body: d }); await arrancar(); }
    catch (er) { $("#err").hidden = false; $("#err").textContent = er.message; }
  });
}

/* ---------- estructura ---------- */
const ICO = {
  resumen: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  pedidos: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  entregas: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  marketing: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>',
  productos: '<rect x="4" y="3" width="16" height="18" rx="1"/><rect x="8" y="7" width="8" height="10"/>',
  generador: '<path d="m12 3 1.9 5.8L20 10l-5 3.8L16.6 20 12 16.5 7.4 20 9 13.8 4 10l6.1-1.2z"/>',
  ajustes: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  ventas: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  logistica: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  desarrollo: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
  mas: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  buscar: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  luna: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  web: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>',
  ok: '<path d="M20 6 9 17l-5-5"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  caja: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  tablero: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>',
  copiar: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
};
const ic = (k, extra = "") => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true" ${extra}>${ICO[k] || ""}</svg>`;
const SECCIONES = [["dashboard", "Dashboard"], ["marketing", "Marketing"], ["ventas", "Ventas"], ["logistica", "Logística"], ["productos", "Productos"], ["desarrollo", "Desarrollo"]];
const BADGE = { ventas: ["nuevos", "Pedidos nuevos sin responder"], logistica: ["atrasados", "Entregas atrasadas"] };
// pestañas internas de cada área
const PESTANAS = {
  marketing: [["analisis", "Análisis"], ["kit", "Kit de campaña"], ["anuncios", "Anuncios"]],
  productos: [["catalogo", "Catálogo"], ["nuevo", "Nuevo cuadro"]],
  desarrollo: [["equipo", "Equipo"], ["cuenta", "Mi cuenta"], ["integraciones", "Integraciones"]],
};
const pestanas = (area, activa) => `<nav class="tabs" aria-label="Secciones de ${area}">${PESTANAS[area].map(([k, n], i) => `<a href="#/${area}${i ? "/" + k : ""}" class="${k === activa ? "on" : ""}" ${k === activa ? 'aria-current="page"' : ""}>${n}</a>`).join("")}</nav>`;
let PULSO = { nuevos: 0, atrasados: 0 };
const tema = () => document.documentElement.dataset.theme;
function aplicarTema(t) { document.documentElement.dataset.theme = t; try { localStorage.setItem("cf_panel_tema", t); } catch {} }
(() => { let t = null; try { t = localStorage.getItem("cf_panel_tema"); } catch {} aplicarTema(t || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")); })();
function shell(activa, contenido) {
  const ini = (YO.nombre || YO.email || "?").trim()[0].toUpperCase();
  app.innerHTML = `<div class="shell"><nav class="side" aria-label="Secciones">
    <div class="marca"><span class="wm"><i></i></span>Cuadros Finos</div>
    ${SECCIONES.map(([k, n]) => { const b = BADGE[k] ? PULSO[BADGE[k][0]] : 0;
      return `<a href="#/${k}" class="${k === activa ? "on" : ""}" ${k === activa ? 'aria-current="page"' : ""}>${ic(k)}<span class="lbl">${n}</span>${b ? `<span class="badge" title="${BADGE[k][1]}">${b}</span>` : ""}</a>`; }).join("")}
    <div class="yo"><span class="avatar">${esc(ini)}</span><div>${esc(YO.nombre || "")}<br><span class="muted small">${esc(YO.rol === "admin" ? "Administrador" : "Equipo")}</span></div></div>
  </nav><main class="main" id="main">
    <div class="bar"><button class="buscar" id="abrirBusca" type="button">${ic("buscar")}<span style="flex:1;text-align:left;padding:8px 0">Buscar pedido, cliente o teléfono…</span><kbd>Ctrl K</kbd></button>
      <span class="sp"></span>
      <a class="icon-btn" href="/" target="_blank" rel="noopener" title="Ver la tienda">${ic("web")}</a>
      <button class="icon-btn" id="tema" title="Modo ${tema() === "dark" ? "claro" : "oscuro"}">${ic(tema() === "dark" ? "sol" : "luna")}</button></div>
    <div class="cont">${contenido}</div></main></div>`;
  $("#tema").addEventListener("click", () => { aplicarTema(tema() === "dark" ? "light" : "dark"); render(); });
  $("#abrirBusca").addEventListener("click", paleta);
  titulo();
}
function titulo() { document.title = `${PULSO.nuevos ? `(${PULSO.nuevos}) ` : ""}Panel · Cuadros Finos`; }
const RANGOS = [[1, "Hoy"], [7, "7 días"], [30, "30 días"], [90, "90 días"], [365, "1 año"]];
const rangoSeg = () => `<div class="seg" id="rango" role="group" aria-label="Periodo">${RANGOS.map(([d, n]) => `<button data-d="${d}" class="${d === DIAS ? "on" : ""}">${n}</button>`).join("")}</div>`;
const bindRango = fn => $$("#rango button").forEach(b => b.addEventListener("click", () => { DIAS = +b.dataset.d; fn(); }));
const esqueleto = (n = 4) => `<div class="kpis">${'<div class="sk" style="height:96px"></div>'.repeat(4)}</div>${'<div class="sk" style="height:180px;margin-bottom:18px"></div>'.repeat(n - 2)}`;
const vacio = (t, i = "caja") => `<div class="vacio">${ic(i)}${t}</div>`;
const espera = f => { const m = (Date.now() - new Date(f.replace(" ", "T") + "Z")) / 60000; const cls = m > 120 ? "mal" : m > 30 ? "reg" : "bien";
  return `<span class="esp ${cls}">${m < 60 ? Math.max(1, Math.round(m)) + " min" : m < 1440 ? Math.round(m / 60) + " h" : Math.round(m / 1440) + " d"}</span>`; };
const delta = (a, b, inv = false) => { if (!b && !a) return ""; if (!b) return `<span class="delta up">nuevo</span>`;
  const d = (a - b) / b; const cls = Math.abs(d) < .02 ? "eq" : (d > 0) !== inv ? "up" : "down";
  return `<span class="delta ${cls}" title="vs periodo anterior">${d > 0 ? "▲" : d < 0 ? "▼" : "="} ${Math.abs(Math.round(d * 100))}%</span>`; };

/* Búsqueda global (Ctrl+K) */
async function paleta() {
  if ($(".paleta")) return;
  const d = document.createElement("div"); d.className = "paleta";
  d.innerHTML = `<div role="dialog" aria-label="Buscar"><input placeholder="Código CF-…, nombre, celular, distrito o cuadro" autofocus><div class="res"><p class="muted small" style="padding:10px">Escribe para buscar en todos los pedidos.</p></div></div>`;
  document.body.append(d);
  const inp = $("input", d), res = $(".res", d); inp.focus();
  let t, sel = 0, items = [];
  const cerrar = () => d.remove();
  d.addEventListener("click", e => { if (e.target === d) cerrar(); });
  const pintar = () => { res.innerHTML = items.length ? items.map((p, i) => `<button class="${i === sel ? "sel" : ""}" data-cod="${esc(p.codigo)}"><b>${esc(p.codigo)}</b> ${est(p.estado)}<span class="muted" style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">${esc(p.cliente || "")} ${esc(p.items.map(i => i.n).join(", "))}</span><span>${soles(p.total_final ?? p.total)}</span></button>`).join("") : `<p class="muted small" style="padding:10px">Sin resultados.</p>`;
    $$("[data-cod]", res).forEach(b => b.addEventListener("click", () => { cerrar(); location.hash = "#/pedido/" + b.dataset.cod; })); };
  inp.addEventListener("input", () => { clearTimeout(t); t = setTimeout(async () => { if (!inp.value.trim()) return; const r = await api("pedidos?" + new URLSearchParams({ q: inp.value.trim(), limite: 12 })); items = r.pedidos; sel = 0; pintar(); }, 200); });
  inp.addEventListener("keydown", e => {
    if (e.key === "Escape") cerrar();
    if (e.key === "ArrowDown") { sel = Math.min(items.length - 1, sel + 1); pintar(); e.preventDefault(); }
    if (e.key === "ArrowUp") { sel = Math.max(0, sel - 1); pintar(); e.preventDefault(); }
    if (e.key === "Enter" && items[sel]) { cerrar(); location.hash = "#/pedido/" + items[sel].codigo; }
  });
}
document.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k" && YO) { e.preventDefault(); paleta(); } });

/* Pulso: aviso de pedidos nuevos cada minuto */
async function pulso(primera = false) {
  if (!YO) return;
  try {
    const r = await api("pulso");
    const nuevo = !primera && r.ultimo && PULSO.ultimo && r.ultimo > PULSO.ultimo;
    PULSO = r; titulo();
    $$(".side a").forEach(a => {
      const k = a.getAttribute("href").slice(2), n = BADGE[k] ? r[BADGE[k][0]] : 0;
      let b = $(".badge", a); if (n) { if (!b) { b = document.createElement("span"); b.className = "badge"; a.querySelector("small")?.remove(); a.append(b); } b.textContent = n; } else b?.remove();
    });
    if (nuevo) { toast("🛍️ ¡Llegó un pedido nuevo!"); if (["", "#/dashboard", "#/ventas"].includes(location.hash)) render(); }
  } catch {}
}
setInterval(() => document.visibilityState === "visible" && pulso(), 60000);

/* ---------- inicio ---------- */
async function vistaResumen() {
  shell("dashboard", esqueleto(5));
  const r = await api("resumen?dias=" + DIAS);
  const k = r.kpi, e = r.entregas, f = r.embudo, pv = r.previo, fp = pv.embudo || {};
  const nombre = s => (BY[s] && BY[s].n) || s;
  const pasos = [["page_view", "Visitas"], ["view_item", "Vieron un cuadro"], ["add_to_cart", "Agregaron a su selección"], ["view_cart", "Abrieron la selección"], ["generate_lead", "Enviaron el pedido"]];
  const max = Math.max(1, ...pasos.map(([n]) => f[n] || 0));
  let peor = -1, peorTasa = 2;
  pasos.forEach(([n], i) => { if (!i) return; const prev = f[pasos[i - 1][0]] || 0, v = f[n] || 0; if (prev >= 5 && v / prev < peorTasa) { peorTasa = v / prev; peor = i; } });
  const smax = Math.max(1, ...r.serie.map(d => d.pedidos));
  // Semáforo de las 6 cifras clave
  const vis = f.page_view || 0, add = f.add_to_cart || 0, lead = f.generate_lead || 0;
  const tAdd = vis ? add / vis : null, tLead = vis ? lead / vis : null, cierre = k.pedidos ? k.pagados / k.pedidos : null;
  const resp = r.respuesta.minutos;
  const luz = (v, verde, amar, inv = false) => v == null ? "g" : (inv ? v <= verde : v >= verde) ? "v" : (inv ? v <= amar : v >= amar) ? "a" : "r";
  const IND = [
    ["Visitas", vis, luz(vis, fp.page_view ? fp.page_view : 1, fp.page_view ? fp.page_view * .8 : 1), vis + "", fp.page_view ? `Antes: ${fp.page_view}` : "Comparación con el periodo anterior", "Si bajan: publica más (kit de campaña) o activa anuncios."],
    ["Agregan un cuadro", tAdd, luz(tAdd, .05, .03), tAdd == null ? "—" : pct(tAdd), "Meta: 5–10 % de las visitas", "Si está bajo: revisa los cuadros con «mucho interés, pocas ventas» en Marketing."],
    ["Envían el pedido", tLead, luz(tLead, .02, .01), tLead == null ? "—" : pct(tLead), "Meta: 2–4 % de las visitas", "Si agregan pero no envían: mira en Clarity dónde se traban."],
    ["Cierre en WhatsApp", cierre, luz(cierre, .4, .25), cierre == null ? "—" : pct(cierre), "Meta: 40–60 % de los pedidos", "Si está bajo: responde más rápido y usa los mensajes rápidos."],
    ["Tiempo de respuesta", resp, luz(resp, 15, 60, true), resp == null ? "—" : resp < 60 ? Math.round(resp) + " min" : (resp / 60).toFixed(1) + " h", "Meta: menos de 15 min", "Responde primero los pedidos «Nuevos» con más espera."],
    ["Ticket promedio", k.pagados ? k.ticket : null, luz(k.pagados ? k.ticket : null, 110, 85), k.pagados ? soles(k.ticket) : "—", "Meta: S/ 110 o más", "Para subirlo: ofrece el tríptico o un segundo cuadro."],
  ];
  const tarea = (p, extra) => `<button class="tarea" data-cod="${esc(p.codigo)}"><b>${esc(p.codigo)}</b><span class="t">${esc(p.cliente || p.items.join(", "))}${p.lugar ? " · " + esc(p.lugar) : ""}</span>${extra}</button>`;
  shell("dashboard", `
    <div class="top"><div><h1>Hola${YO.nombre ? ", " + esc(YO.nombre.split(" ")[0]) : ""} 👋</h1><p>${new Date().toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" })}</p></div>${rangoSeg()}</div>
    <div class="hoy">
      <div class="rojo"><h2>${ic("reloj")} Responder ya<span class="n">${r.pendientes.length}</span></h2>${r.pendientes.length ? r.pendientes.map(p => tarea(p, espera(p.creado))).join("") : `<p class="listo-ok">${ic("ok")} No hay pedidos esperando respuesta.</p>`}</div>
      <div class="amb"><h2>${ic("alerta")} Atrasados<span class="n">${r.atrasadosLista.length}</span></h2>${r.atrasadosLista.length ? r.atrasadosLista.map(p => tarea(p, `<span class="esp mal">${fecha(p.fecha_prometida)}</span>`)).join("") : `<p class="listo-ok">${ic("ok")} Todo a tiempo.</p>`}</div>
      <div class="azul"><h2>${ic("entregas")} Listos para enviar<span class="n">${r.listos.length}</span></h2>${r.listos.length ? r.listos.map(p => tarea(p, `<span class="muted small">${esc(p.envio_tipo || "")}</span>`)).join("") : `<p class="listo-ok">${ic("ok")} Nada pendiente de envío.</p>`}</div>
    </div>
    <div class="kpis">
      <div class="kpi"><span>Ventas cobradas</span><b>${soles(k.ventas)}</b>${delta(k.ventas, pv.ventas)}</div>
      <div class="kpi"><span>Pedidos recibidos</span><b>${k.pedidos || 0}</b>${delta(k.pedidos, pv.pedidos)}</div>
      <div class="kpi"><span>Pedidos pagados</span><b>${k.pagados || 0}</b>${delta(k.pagados, pv.pagados)}</div>
      <div class="kpi ${e.atrasados ? "alerta" : ""}"><span>Entregas en curso</span><b>${e.en_curso || 0}</b><span class="small">${e.atrasados ? e.atrasados + " atrasados" : "sin atrasos"}</span></div>
    </div>
    <div class="panel"><h2>Salud del negocio <span class="muted">· verde = bien, amarillo = ojo, rojo = actuar</span></h2>
      <div class="salud">${IND.map(([t, v, l, txt, meta, accion]) => `<div class="ind"><i class="luz ${l}"></i><span>${t}</span><b>${txt}</b><p>${meta}${l === "r" || l === "a" ? `<br><strong style="color:var(--fg2)">${accion}</strong>` : ""}</p></div>`).join("")}</div></div>
    <div class="panel"><h2>¿Dónde se cae la venta?</h2>
      ${f.page_view ? `<div class="embudo">${pasos.map(([n, t], i) => { const v = f[n] || 0, prev = i ? f[pasos[i - 1][0]] || 0 : 0;
        return `<div class="paso ${i === peor ? "peor" : ""}"><span>${t}</span><div class="barra"><i style="width:${Math.max(2, (v / max) * 100)}%"></i></div><em>${v}${i && prev ? `<small>${pct(Math.min(1, v / prev))} pasan</small>` : ""}</em></div>`; }).join("")}</div>
      ${peor > 0 ? `<p class="small" style="margin-top:12px">🔴 La mayor caída está en <b>${pasos[peor][1].toLowerCase()}</b>: solo pasa el ${pct(peorTasa)} del paso anterior.</p>` : ""}`
      : vacio("Aún no hay visitas registradas en este periodo.", "marketing")}
    </div>
    <div class="cols">
      <div class="panel"><h2>Cuadros más pedidos</h2>${r.top.length ? `<table class="tabla"><tr><th>Cuadro</th><th class="n">Pedidos</th><th class="n">Vendidos</th></tr>
        ${r.top.map(t => `<tr><td>${esc(nombre(t.s) || t.n)}</td><td class="n">${t.pedidos}</td><td class="n">${t.vendidos || 0}</td></tr>`).join("")}</table>` : vacio("Sin pedidos todavía.")}</div>
      <div class="panel"><h2>Cuadros más vistos</h2>${r.vistos.length ? `<table class="tabla"><tr><th>Cuadro</th><th class="n">Vistas</th><th class="n">Personas</th></tr>
        ${r.vistos.map(t => `<tr><td>${esc(nombre(t.s))}</td><td class="n">${t.vistas}</td><td class="n">${t.personas}</td></tr>`).join("")}</table>` : vacio("Sin visitas todavía.", "marketing")}</div>
      <div class="panel"><h2>De dónde vienen los pedidos</h2>${r.fuentes.length ? `<table class="tabla"><tr><th>Fuente</th><th class="n">Pedidos</th><th class="n">Pagados</th><th class="n">Ventas</th></tr>
        ${r.fuentes.map(t => `<tr><td>${esc(t.fuente)}</td><td class="n">${t.pedidos}</td><td class="n">${t.pagados}</td><td class="n">${soles(t.ventas)}</td></tr>`).join("")}</table>` : vacio("Sin pedidos todavía.")}</div>
      <div class="panel"><h2>Pedidos por día <span class="muted">· verde = pagados</span></h2>${r.serie.length ? `<div class="serie">${r.serie.map(d => `<div title="${esc(d.dia)}: ${d.pedidos} pedidos, ${d.pagados} pagados" style="height:${(d.pedidos / smax) * 100}%"><i style="height:${d.pedidos ? (d.pagados / d.pedidos) * 100 : 0}%"></i></div>`).join("")}</div>` : vacio("Sin pedidos todavía.")}</div>
    </div>`);
  bindRango(vistaResumen);
  $$(".hoy [data-cod]").forEach(b => b.addEventListener("click", () => location.hash = "#/pedido/" + b.dataset.cod));
}

/* ---------- pedidos ---------- */
const FILTROS = [["activos", "Activos"], ...ESTADOS, ["todos", "Todos"]];
let VISTA = (() => { try { return localStorage.getItem("cf_panel_vista") || "lista"; } catch { return "lista"; } })();
async function vistaPedidos() {
  shell("ventas", `<div class="top"><div><h1>Ventas</h1><p>Toca un pedido para ver el detalle. ${VISTA === "tablero" ? "Arrastra las tarjetas para cambiar el estado." : ""}</p></div>
      <div style="display:flex;gap:8px;align-items:center"><div class="seg" role="group" aria-label="Vista"><button data-v="lista" class="${VISTA === "lista" ? "on" : ""}" title="Lista">${ic("lista")}</button><button data-v="tablero" class="${VISTA === "tablero" ? "on" : ""}" title="Tablero">${ic("tablero")}</button></div>
      <button class="btn btn--p btn--sm" id="nuevo">+ Pedido manual</button></div></div>
    ${VISTA === "lista" ? `<div class="filtros" id="filtros">${FILTROS.map(([k, n]) => `<button class="chip ${k === FILTRO ? "on" : ""}" data-f="${k}">${n}<small data-c="${k}"></small></button>`).join("")}</div>
    <input type="search" id="busca" placeholder="Filtrar por código, cliente, teléfono, distrito o cuadro" value="${esc(BUSCA)}" style="margin-bottom:12px">` : ""}
    <div id="lista" class="${VISTA === "lista" ? "lista" : ""}">${'<div class="sk" style="height:70px;margin-bottom:8px"></div>'.repeat(5)}</div>`);
  $$(".top .seg button").forEach(b => b.addEventListener("click", () => { VISTA = b.dataset.v; try { localStorage.setItem("cf_panel_vista", VISTA); } catch {} vistaPedidos(); }));
  $$("#filtros .chip").forEach(b => b.addEventListener("click", () => { FILTRO = b.dataset.f; vistaPedidos(); }));
  let t; $("#busca")?.addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { BUSCA = e.target.value; cargarLista(); }, 250); });
  $("#nuevo").addEventListener("click", pedidoManual);
  cargarLista();
}
async function cargarLista() {
  if (VISTA === "tablero") return cargarTablero();
  const q = new URLSearchParams({ estado: FILTRO === "todos" ? "" : FILTRO, q: BUSCA });
  const { pedidos, conteo } = await api("pedidos?" + q);
  if (!$("#lista")) return;
  const act = Object.entries(conteo).filter(([k]) => !["entregado", "cancelado"].includes(k)).reduce((a, [, n]) => a + n, 0);
  $$("#filtros [data-c]").forEach(sm => { const k = sm.dataset.c; const n = k === "activos" ? act : k === "todos" ? Object.values(conteo).reduce((a, b) => a + b, 0) : conteo[k] || 0; sm.textContent = n || ""; });
  $("#lista").innerHTML = pedidos.length ? pedidos.map(filaPedido).join("") : vacio(`No hay pedidos ${FILTRO !== "todos" ? "en este estado" : "todavía"}.`);
  $$("#lista [data-cod]").forEach(b => b.addEventListener("click", () => location.hash = "#/pedido/" + b.dataset.cod));
}
function filaPedido(p) {
  const nombres = p.items.map(i => `${i.qty > 1 ? i.qty + "× " : ""}${i.n}`).join(", ");
  const atrasado = ["pagado", "produccion", "listo"].includes(p.estado) && p.fecha_prometida && p.fecha_prometida < hoy();
  return `<button class="ped" data-cod="${esc(p.codigo)}">
    <span class="thumbs">${p.items.slice(0, 3).map(i => `<img src="${thumb(i.s)}" alt="" loading="lazy">`).join("")}</span>
    <span class="det"><span class="cod">${esc(p.codigo)}</span> ${est(p.estado)} ${atrasado ? '<span class="atraso">ATRASADO</span>' : ""} ${p.estado === "nuevo" ? espera(p.creado) : ""}
      <p>${esc(p.cliente ? p.cliente + " · " : "")}${esc(nombres)}</p>
      <small>${hace(p.creado)} · ${esc(p.lugar || "sin distrito")} · ${esc(p.fuente || "directo")}${p.pago ? " · " + esc(p.pago) : ""}</small></span>
    <span class="tot">${soles(p.total_final ?? p.total)}</span><span class="muted">›</span></button>`;
}
const COLS_TABLERO = ["nuevo", "confirmado", "pagado", "produccion", "listo", "enviado", "entregado"];
async function cargarTablero() {
  const { pedidos } = await api("pedidos?" + new URLSearchParams({ estado: "", limite: 200 }));
  if (!$("#lista")) return;
  const recientes = p => p.estado !== "entregado" || (Date.now() - new Date(p.actualizado.replace(" ", "T") + "Z")) < 14 * 864e5;
  $("#lista").innerHTML = `<div class="kanban">${COLS_TABLERO.map(c => { const l = pedidos.filter(p => p.estado === c && recientes(p));
    return `<div class="kcol" data-col="${c}"><h3>${EN[c]}<span>${l.length}</span></h3>${l.map(p => `<div class="kcard" draggable="true" data-cod="${esc(p.codigo)}" tabindex="0">
      <b>${esc(p.codigo)}</b> ${p.estado === "nuevo" ? espera(p.creado) : ""}<span class="t">${esc(p.cliente || p.items.map(i => i.n).join(", "))}</span>
      <span class="m"><span>${esc(p.lugar || "—")}</span><span>${soles(p.total_final ?? p.total)}</span></span></div>`).join("")}</div>`; }).join("")}</div>`;
  let arr = null;
  $$(".kcard").forEach(c => {
    c.addEventListener("click", () => location.hash = "#/pedido/" + c.dataset.cod);
    c.addEventListener("keydown", e => { if (e.key === "Enter") location.hash = "#/pedido/" + c.dataset.cod; });
    c.addEventListener("dragstart", e => { arr = c.dataset.cod; c.classList.add("arrastrando"); e.dataTransfer.effectAllowed = "move"; });
    c.addEventListener("dragend", () => c.classList.remove("arrastrando"));
  });
  $$(".kcol").forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("sobre"); });
    col.addEventListener("dragleave", () => col.classList.remove("sobre"));
    col.addEventListener("drop", async e => {
      e.preventDefault(); col.classList.remove("sobre");
      if (!arr) return; const cod = arr; arr = null;
      try { await api("pedidos/" + cod, { method: "PATCH", body: { estado: col.dataset.col } }); toast(`${cod} → ${EN[col.dataset.col]}`); cargarTablero(); pulso(); } catch (er) { toast(er.message); }
    });
  });
}

/* ---------- detalle de un pedido ---------- */
const PLANTILLAS = [
  ["Confirmar pedido", p => `Hola${p.cliente ? " " + p.cliente.split(" ")[0] : ""} 👋 Recibimos tu pedido ${p.codigo} en Cuadros Finos. ¡Gracias! Te confirmo el total de ${soles(p.total_final ?? p.total)}${p.lugar ? " con entrega en " + p.lugar : ""}. ¿Te paso los datos para el pago?`],
  ["Pago recibido", p => `¡Pago recibido! 🙌 Tu pedido ${p.codigo} ya entra a producción. Lo tendrás listo${p.fecha_prometida ? " para el " + fecha(p.fecha_prometida) : " en 4 a 6 días hábiles"}.`],
  ["Vista previa", p => `Te comparto la vista previa de tu cuadro personalizado (${p.codigo}). ¿Lo aprobamos para imprimir?`],
  ["En camino", p => `Tu pedido ${p.codigo} va en camino 🚚${p.agencia ? " por " + p.agencia : ""}${p.guia ? ". Número de guía: " + p.guia : ""}. ¡Avísame cuando llegue!`],
  ["Gracias", p => `¡Gracias por tu compra! 🖤 Si te gustó, nos ayudas mucho con una foto de tu cuadro colgado. Etiquétanos y te damos un descuento en el próximo.`],
];
async function vistaPedido(codigo) {
  if (!$("#main")) await vistaPedidos();
  const { pedido: p, historial } = await api("pedidos/" + codigo);
  const tel = (p.telefono || "").replace(/\D/g, ""), telWa = tel.length === 9 ? "51" + tel : tel;
  const SIG = { nuevo: "confirmado", confirmado: "pagado", pagado: "produccion", produccion: "listo", listo: "enviado", enviado: "entregado" };
  const VERBO = { confirmado: "Confirmar pedido", pagado: "Marcar como pagado", produccion: "Pasar a producción", listo: "Marcar como listo", enviado: "Marcar como enviado", entregado: "Marcar como entregado" };
  const orden = COLS_TABLERO.indexOf(p.estado);
  const resumenTxt = `Pedido ${p.codigo}\n${p.items.map(i => `• ${i.qty} × ${i.n} — ${soles(i.precio * i.qty)}${(i.f || []).map(([a, b]) => `\n   ${a}: ${b}`).join("")}`).join("\n")}\nTotal: ${soles(p.total_final ?? p.total)}${p.cliente ? "\nCliente: " + p.cliente : ""}${p.telefono ? " · " + p.telefono : ""}${p.direccion ? "\nDirección: " + p.direccion : ""}${p.lugar ? "\n" + p.lugar : ""}`;
  const d = document.createElement("div"); d.className = "drawer";
  d.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Pedido ${esc(p.codigo)}">
    <div class="dhead"><div class="fila"><div><h1>${esc(p.codigo)} ${est(p.estado)}</h1><p class="muted small">${hace(p.creado)} · vía ${esc(p.via || "web")} · ${esc(p.fuente || "directo")}${p.campana ? " / " + esc(p.campana) : ""}${p.region ? " · " + esc(p.region) : ""}</p></div>
      <button class="cerrar" aria-label="Cerrar">×</button></div>
      <div class="progreso ${p.estado === "cancelado" ? "cancel" : ""}" aria-hidden="true">${COLS_TABLERO.map((c, i) => `<i class="${i <= orden ? "on" : ""}" title="${EN[c]}"></i>`).join("")}</div>
      <div class="acciones">${SIG[p.estado] ? `<button class="btn btn--p" data-e="${SIG[p.estado]}">${ic("ok")} ${VERBO[SIG[p.estado]]}</button>` : ""}
        ${tel ? `<a class="btn btn--wa" target="_blank" rel="noopener" href="https://wa.me/${telWa}">WhatsApp</a>` : ""}
        <button class="btn" id="copiarRes" title="Copiar resumen del pedido">${ic("copiar")} Copiar</button>
        <details class="mas-estados"><summary class="btn">Cambiar estado ▾</summary><div class="menu" id="pasos">${ESTADOS.map(([k, n]) => `<button data-e="${k}" class="${k === p.estado ? "on" : ""}">${k === p.estado ? "✓ " : ""}${n}</button>`).join("")}</div></details></div>
    </div><div class="dbody">
    <div class="sec"><h3>Cuadros · ${soles(p.total)}</h3>
      ${p.items.map(i => `<div class="item"><img src="${thumb(i.s)}" alt=""><div>${esc(i.n || i.s)}${i.qty > 1 ? ` <b>× ${i.qty}</b>` : ""}
        ${(i.f || []).map(([a, b]) => `<small>${esc(a)}: <b>${esc(b)}</b></small>`).join("")}
        ${BY[i.s] ? `<small><a href="/cuadro/${esc(i.s)}/" target="_blank" rel="noopener">Ver en la web ↗</a></small>` : ""}</div><span>${soles(i.precio * i.qty)}</span></div>`).join("")}
      ${p.regalo ? `<p class="small" style="margin-top:8px">🎁 Es para regalo</p>` : ""}</div>
    <form id="fp">
      <div class="sec"><h3>Cliente</h3><div class="grid2">
        <label class="f"><span>Nombre</span><input name="cliente" value="${esc(p.cliente)}"></label>
        <label class="f"><span>Celular / WhatsApp</span><input name="telefono" inputmode="tel" value="${esc(p.telefono)}" placeholder="9XXXXXXXX"></label>
        <label class="f"><span>Distrito / ciudad</span><input name="lugar" value="${esc(p.lugar)}"></label>
        <label class="f"><span>Pago</span><select name="pago">${["", "Yape", "Plin", "Transferencia", "Tarjeta", "Efectivo"].map(o => `<option ${o === (p.pago || "") ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      </div><label class="f" style="margin-top:10px"><span>Dirección de entrega</span><input name="direccion" value="${esc(p.direccion)}"></label></div>
      <div class="sec"><h3>Cobro y entrega</h3><div class="grid2">
        <label class="f"><span>Total cobrado (S/)</span><input name="total_final" type="number" step="1" min="0" value="${p.total_final ?? ""}" placeholder="${p.total}"></label>
        <label class="f"><span>Costo de envío (S/)</span><input name="costo_envio" type="number" step="1" min="0" value="${p.costo_envio ?? ""}"></label>
        <label class="f"><span>Tipo de envío</span><select name="envio_tipo">${[["", "—"], ["lima", "Lima (delivery)"], ["provincia", "Provincia (agencia)"], ["recojo", "Recojo"]].map(([v, n]) => `<option value="${v}" ${v === (p.envio_tipo || "") ? "selected" : ""}>${n}</option>`).join("")}</select></label>
        <label class="f"><span>Agencia / courier</span><input name="agencia" value="${esc(p.agencia)}" placeholder="Shalom, Olva, Marvisur…"></label>
        <label class="f"><span>N.º de guía</span><input name="guia" value="${esc(p.guia)}"></label>
        <label class="f"><span>Fecha prometida</span><input name="fecha_prometida" type="date" value="${esc(p.fecha_prometida)}"></label>
        <label class="f"><span>Fecha de envío</span><input name="fecha_envio" type="date" value="${esc(p.fecha_envio)}"></label>
        <label class="f"><span>Fecha de entrega</span><input name="fecha_entrega" type="date" value="${esc(p.fecha_entrega)}"></label>
      </div></div>
      <div class="sec"><h3>Notas internas</h3><textarea name="notas" placeholder="Ej.: quiere el colgador horizontal, pagó la mitad…">${esc(p.notas)}</textarea></div>
      <div class="guardar"><button class="btn btn--p">Guardar cambios</button><span class="muted small" style="align-self:center">Los cambios quedan en el historial.</span></div>
    </form>
    ${tel ? `<div class="sec"><h3>Mensajes rápidos por WhatsApp</h3><div class="wa-plantillas">${PLANTILLAS.map(([n, f], i) => `<a class="btn btn--sm" target="_blank" rel="noopener" href="https://wa.me/${telWa}?text=${encodeURIComponent(f(p))}">${n}</a>`).join("")}</div></div>`
      : `<p class="muted small sec">Escribe el celular del cliente para enviarle mensajes rápidos (confirmación, pago, en camino…).</p>`}
    <div class="sec"><h3>Historial</h3><div class="hist">${historial.map(h => `<div><time>${esc(h.fecha)} UTC · ${esc(h.usuario || "")}</time>${esc(h.accion)}</div>`).join("")}</div></div>
  </div></section>`;
  document.body.append(d);
  const cerrar = () => { d.remove(); if (location.hash.startsWith("#/pedido/")) history.back(); };
  d.addEventListener("click", e => { if (e.target === d || e.target.closest(".cerrar")) cerrar(); });
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { document.removeEventListener("keydown", k); cerrar(); } });
  $("#copiarRes", d).addEventListener("click", async () => { try { await navigator.clipboard.writeText(resumenTxt); toast("Resumen copiado"); } catch { toast("No se pudo copiar"); } });
  $$(".acciones [data-e]", d).forEach(b => b.addEventListener("click", async () => {
    await api("pedidos/" + p.codigo, { method: "PATCH", body: { estado: b.dataset.e } });
    toast(`${p.codigo}: ${EN[b.dataset.e]}`); d.remove(); vistaPedido(p.codigo); if ($("#lista")) cargarLista(); pulso();
  }));
  $("#fp", d).addEventListener("submit", async e => {
    e.preventDefault();
    try { await api("pedidos/" + p.codigo, { method: "PATCH", body: Object.fromEntries(new FormData(e.target)) }); toast("Guardado"); d.remove(); vistaPedido(p.codigo); if ($("#lista")) cargarLista(); }
    catch (er) { toast(er.message); }
  });
}
function pedidoManual() {
  const d = document.createElement("div"); d.className = "drawer";
  const opts = CAT.productos.filter(x => !x.q).map(x => `<option value="${esc(x.s)}">${esc(x.n)}</option>`).join("");
  d.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Pedido manual"><header><h1>Pedido manual</h1><button class="cerrar" aria-label="Cerrar">×</button></header>
    <p class="muted small">Para ventas que llegaron por Instagram, en persona o por recomendación.</p>
    <form id="fm" style="display:grid;gap:12px;margin-top:16px">
      <div id="its"></div><button type="button" class="btn btn--sm" id="mas">+ Otro cuadro</button>
      <div class="grid2"><label class="f"><span>Cliente</span><input name="cliente"></label><label class="f"><span>Celular</span><input name="telefono"></label>
        <label class="f"><span>Distrito / ciudad</span><input name="lugar"></label>
        <label class="f"><span>¿De dónde llegó?</span><select name="fuente">${["instagram", "facebook", "tiktok", "recomendacion", "tienda", "otro"].map(o => `<option>${o}</option>`).join("")}</select></label></div>
      <label class="f"><span>Notas</span><textarea name="notas"></textarea></label>
      <button class="btn btn--p">Crear pedido</button></form></section>`;
  document.body.append(d);
  const fila = () => { const r = document.createElement("div"); r.className = "grid2"; r.style.marginBottom = "8px";
    r.innerHTML = `<label class="f"><span>Cuadro</span><select name="s">${opts}</select></label><div class="grid2"><label class="f"><span>Cant.</span><input name="qty" type="number" min="1" value="1"></label><label class="f"><span>Precio S/</span><input name="precio" type="number" min="0" value="${CAT.config.precio ? CAT.config.precio.pieza : 84}"></label></div>`;
    $("#its", d).append(r); };
  fila(); $("#mas", d).addEventListener("click", fila);
  d.addEventListener("click", e => { if (e.target === d || e.target.closest(".cerrar")) d.remove(); });
  $("#fm", d).addEventListener("submit", async e => {
    e.preventDefault();
    const items = $$("#its > div", d).map(r => { const s = $("[name=s]", r).value; return { s, n: BY[s] ? BY[s].n : s, qty: +$("[name=qty]", r).value, precio: +$("[name=precio]", r).value }; });
    const f = Object.fromEntries(new FormData(e.target));
    try { const r = await api("pedidos", { method: "POST", body: { ...f, items } }); d.remove(); toast("Pedido " + r.codigo + " creado"); location.hash = "#/pedido/" + r.codigo; }
    catch (er) { toast(er.message); }
  });
}

/* ---------- entregas ---------- */
async function vistaEntregas() {
  shell("logistica", `<p class="cargando">Cargando…</p>`);
  const { pedidos } = await api("pedidos?estado=entregas&limite=200");
  const atr = p => p.fecha_prometida && p.fecha_prometida < hoy() && p.estado !== "enviado";
  const grupos = [["Atrasados", pedidos.filter(atr)], ["Por producir", pedidos.filter(p => ["pagado", "produccion"].includes(p.estado) && !atr(p))],
    ["Listos para enviar", pedidos.filter(p => p.estado === "listo" && !atr(p))], ["En camino", pedidos.filter(p => p.estado === "enviado")]];
  const sig = { pagado: "produccion", produccion: "listo", listo: "enviado", enviado: "entregado" };
  shell("logistica", `<div class="top"><h1>Logística</h1><p class="muted small">Ordenado por fecha prometida</p></div>
    <div class="col-ent">${grupos.map(([t, l]) => `<div><h3>${t}<span>${l.length}</span></h3>${l.map(p => `
      <div class="ent"><button data-cod="${esc(p.codigo)}" style="text-align:left;width:100%"><b>${esc(p.codigo)}</b> ${est(p.estado)}<br>
        ${esc(p.cliente || "Sin nombre")} · ${esc(p.lugar || "—")}<br>
        <span class="muted small">${p.items.map(i => esc(i.n)).join(", ")}</span><br>
        <span class="${atr(p) ? "atraso" : "muted small"}">Prometido: ${fecha(p.fecha_prometida)}</span>${p.guia ? `<br><span class="muted small">${esc(p.agencia || "")} · guía ${esc(p.guia)}</span>` : ""}</button>
        <button class="btn btn--sm" data-sig="${esc(p.codigo)}" data-e="${sig[p.estado]}" style="margin-top:8px">→ ${EN[sig[p.estado]]}</button></div>`).join("") || `<p class="muted small">Nada por aquí.</p>`}</div>`).join("")}</div>`);
  $$("[data-cod]").forEach(b => b.addEventListener("click", () => location.hash = "#/pedido/" + b.dataset.cod));
  $$("[data-sig]").forEach(b => b.addEventListener("click", async () => {
    await api("pedidos/" + b.dataset.sig, { method: "PATCH", body: { estado: b.dataset.e } }); toast(`${b.dataset.sig}: ${EN[b.dataset.e]}`); vistaEntregas();
  }));
}

/* ---------- kit de campaña ---------- */
const SITIO = location.origin;
const PRECIO = x => x.q ? null : (x.o === "triptico" ? CAT.config.precio.triptico : x.o === "diptico" ? CAT.config.precio.diptico : CAT.config.precio.pieza) + (x.p ? CAT.config.precio.personalizar : 0);
function destinos() {
  const o = [["/", "Inicio (toda la tienda)", null]];
  (CAT.virtuales || []).forEach(v => o.push([`/${v.url}/`, `Colección · ${v.nombre}`, null, v.id]));
  CAT.colecciones.forEach(c => o.push([`/${c.url}/`, `Colección · ${c.nombre}`, null, c.id]));
  (CAT.ambientes || []).forEach(a => o.push([`/${a.url}/`, `Ambiente · ${a.nombre}`, null, "amb:" + a.id]));
  CAT.productos.filter(x => x.i).sort((a, b) => a.n.localeCompare(b.n, "es")).forEach(x => o.push([`/cuadro/${x.s}/`, `Cuadro · ${x.n}`, x.s]));
  return o;
}
const slugify = t => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
function productosDe(dest) {
  if (dest[2]) return [BY[dest[2]]];
  const id = dest[3]; const P = CAT.productos.filter(x => x.i && !x.q);
  const rank = x => (x.t ? 0 : 10) + (x.nw ? 0 : 3);
  let l = !id ? P.filter(x => x.t) : id === "top" ? P.filter(x => x.t) : id === "nuevos" ? P.filter(x => x.nw) : id === "personalizados" ? P.filter(x => x.p)
    : id.startsWith("amb:") ? P.filter(x => x.a.includes(id.slice(4))) : P.filter(x => x.c === id);
  return l.sort((a, b) => rank(a) - rank(b)).slice(0, 3);
}
function textos(dest, link) {
  const ps = productosDe(dest), x = ps[0];
  const hash = x ? "#" + slugify((CAT.colecciones.find(c => c.id === x.c) || {}).nombre || "cuadros").replace(/-/g, "") : "";
  if (dest[2]) {
    const pr = PRECIO(x), amb = x.a[0] || "sala";
    return [
      ["Publicación de Instagram / Facebook", `${x.n} 🖤\n${x.f}\n\nCuadro de ${x.o === "triptico" ? "3 piezas de 30 × 37 cm (≈ 98 cm de ancho)" : "30 × 37 cm"} con marco negro, listo para colgar. Hecho a pedido en Lima, con envío a todo el Perú.\n${pr ? "💰 S/ " + pr + "\n" : ""}📲 Míralo en tu pared y pídelo por WhatsApp: ${link}\n\n#cuadrosdecorativos #decoracionperu #cuadrosconmarco #lima ${hash}`],
      ["Anuncio (Meta) · texto principal", `${x.f} ${x.n} con marco negro${pr ? ", a S/ " + pr : ""}. Míralo en tu pared antes de pedirlo y recíbelo en 4 a 6 días. Hecho en Lima, envío a todo el Perú.`],
      ["Anuncio · título", `${x.n}${pr ? " · S/ " + pr : ""}`],
      ["Estado de WhatsApp", `Nuevo en Cuadros Finos: ${x.n} 🖤${pr ? " S/ " + pr : ""}. ¿Lo imaginas en tu ${amb}? Míralo aquí 👉 ${link}`],
      ["Respuesta para comentarios / DM", `¡Hola! 🙌 El ${x.n} cuesta ${pr ? "S/ " + pr : "a cotizar"} con marco negro incluido. Aquí puedes verlo en tu pared y pedirlo: ${link}`],
    ];
  }
  const nom = dest[1].replace(/^(Colección|Ambiente) · /, "");
  return [
    ["Publicación de Instagram / Facebook", `${nom === "Inicio (toda la tienda)" ? "Cuadros que dicen quién vive aquí 🖤" : "Cuadros · " + nom + " 🖤"}\n${ps.map(p => "· " + p.n).join("\n")}\n\nCon marco negro desde S/ ${CAT.config.precio.pieza}, tríptico S/ ${CAT.config.precio.triptico}. Hechos a pedido en Lima, envío a todo el Perú.\n📲 Elige el tuyo y míralo en tu pared: ${link}\n\n#cuadrosdecorativos #decoracionperu #cuadrosconmarco #lima`],
    ["Anuncio (Meta) · texto principal", `${nom === "Inicio (toda la tienda)" ? "Más de 80 cuadros" : "Cuadros " + nom.toLowerCase()} con marco negro desde S/ ${CAT.config.precio.pieza}. Míralos en tu pared antes de pedir. Hechos en Lima, envío a todo el Perú.`],
    ["Estado de WhatsApp", `¿Buscas un cuadro para tu casa u oficina? 🖤 Mira la colección ${nom.toLowerCase()} 👉 ${link}`],
  ];
}
const cargarImg = src => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });
function envolver(g, t, maxW) { const w = t.split(" "), l = []; let c = ""; for (const p of w) { const z = c ? c + " " + p : p; if (g.measureText(z).width > maxW && c) { l.push(c); c = p; } else c = z; } l.push(c); return l; }
async function imagenSocial(dest, formato) {
  const W = 1080, H = formato === "historia" ? 1920 : 1350;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  await document.fonts.load("400 60px Archivo"); await document.fonts.load("500 30px Inter");
  g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(W / 2, H * .38, 50, W / 2, H * .38, W * .9); rg.addColorStop(0, "#2b2823"); rg.addColorStop(1, "#0b0b0b"); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const ps = productosDe(dest);
  const piezas = dest[2] && (ps[0].o === "triptico" || ps[0].o === "diptico") ? Array.from({ length: ps[0].o === "triptico" ? 3 : 2 }, (_, i) => `/img/cuadros/${ps[0].s}-${i + 1}.webp`)
    : ps.map(x => `/img/cuadros/${x.s}${x.o === "triptico" || x.o === "diptico" ? "-1" : ""}.webp`);
  const imgs = await Promise.all(piezas.map(cargarImg));
  const n = imgs.length, gap = 30, horiz = n === 1 && dest[2] && ["horizontal", "panoramico"].includes(ps[0].o);
  const ratio = horiz ? 37.4 / 29.8 : 29.8 / 37.4;
  let fh = n === 1 ? (horiz ? 560 : (formato === "historia" ? 960 : 720)) : (formato === "historia" ? 560 : 440);
  const maxW = W - 150; if (n * fh * ratio + (n - 1) * gap > maxW) fh = (maxW - (n - 1) * gap) / (n * ratio);
  const fw = Math.round(fh * ratio); fh = Math.round(fh);
  const total = n * fw + (n - 1) * gap, x0 = (W - total) / 2, y0 = formato === "historia" ? (n === 1 ? 300 : 520) : (n === 1 ? 170 : 300);
  imgs.forEach((im, i) => {
    const x = x0 + i * (fw + gap);
    g.save(); g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = 50; g.shadowOffsetY = 26; g.fillStyle = "#0e0e0e"; g.fillRect(x, y0, fw, fh); g.restore();
    const mx = fw * (horiz ? .044 : .055), my = fh * (horiz ? .055 : .044), iw = fw - 2 * mx, ih = fh - 2 * my;
    const cw = im.naturalWidth * .97, ch = im.naturalHeight;   // recorta el borde claro de algunos paneles
    const s = Math.max(iw / cw, ih / ch), sw = iw / s, sh = ih / s;
    g.drawImage(im, (im.naturalWidth - sw) / 2, (ch - sh) / 2, sw, sh, x + mx, y0 + my, iw, ih);
  });
  let y = y0 + fh + (formato === "historia" ? 130 : 100);
  g.textAlign = "center"; g.fillStyle = "#f3f1ec";
  const titulo = dest[2] ? ps[0].n : dest[1].replace(/^(Colección|Ambiente) · /, "").replace("Inicio (toda la tienda)", "Cuadros Finos");
  g.font = "400 58px Archivo"; g.letterSpacing = "6px";
  envolver(g, titulo.toUpperCase(), W - 140).slice(0, 2).forEach(l => { g.fillText(l, W / 2, y); y += 70; });
  g.letterSpacing = "0px"; g.font = "400 32px Inter"; g.fillStyle = "#b9b5ad";
  const sub = dest[2] ? ps[0].f : `Con marco desde S/ ${CAT.config.precio.pieza} · hechos en Lima`;
  envolver(g, sub, W - 200).slice(0, 2).forEach(l => { g.fillText(l, W / 2, y + 10); y += 44; });
  const pr = dest[2] ? PRECIO(ps[0]) : null;
  if (pr) { g.font = "500 64px Inter"; g.fillStyle = "#f3f1ec"; g.fillText("S/ " + pr, W / 2, y + 90); y += 90; }
  g.font = "500 26px Inter"; g.fillStyle = "#25d366"; g.fillText("Pídelo por WhatsApp · envío a todo el Perú", W / 2, H - (formato === "historia" ? 210 : 90));
  g.font = "500 24px Inter"; g.fillStyle = "#85817a"; g.letterSpacing = "8px"; g.fillText("CUADROS FINOS", W / 2, formato === "historia" ? 200 : 100); g.letterSpacing = "0px";
  return new Promise(ok => c.toBlob(ok, "image/jpeg", .92));
}
function kitHTML() {
  const ds = destinos();
  return `<div class="panel" id="kit"><h2>Kit de campaña</h2>
    <p class="muted small" style="margin:-6px 0 14px">Elige qué promocionar y dónde. Te armo el enlace con seguimiento, el QR, los textos y las imágenes.</p>
    <div class="grid2" style="grid-template-columns:2fr 1fr 1fr 1fr">
      <label class="f"><span>¿Qué promocionas?</span><select id="kDest">${ds.map((d, i) => `<option value="${i}">${esc(d[1])}</option>`).join("")}</select></label>
      <label class="f"><span>¿Dónde?</span><select id="kSrc">${["instagram", "facebook", "tiktok", "whatsapp", "google", "pinterest", "email", "otro"].map(o => `<option>${o}</option>`).join("")}</select></label>
      <label class="f"><span>Formato</span><select id="kMed">${["post", "historia", "reel", "anuncio", "bio", "estado", "grupo", "volante"].map(o => `<option>${o}</option>`).join("")}</select></label>
      <label class="f"><span>Nombre de campaña</span><input id="kCamp" value="${new Date().toLocaleDateString("es-PE", { month: "long" }).toLowerCase()}-${new Date().getFullYear()}"></label>
    </div>
    <div class="kit-out" id="kOut"></div></div>`;
}
function bindKit() {
  const ds = destinos();
  const upd = () => {
    const d = ds[+$("#kDest").value];
    const camp = slugify($("#kCamp").value) || "campana";
    const link = `${SITIO}${d[0]}?utm_source=${$("#kSrc").value}&utm_medium=${$("#kMed").value}&utm_campaign=${camp}`;
    let qrSvg = "";
    try { const q = qrcode(0, "M"); q.addData(link); q.make(); qrSvg = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch {}
    const tx = textos(d, link);
    $("#kOut").innerHTML = `<div class="kit-link"><input readonly value="${esc(link)}" id="kLink"><button class="btn btn--sm btn--p" data-copy="${esc(link)}">Copiar enlace</button></div>
      <div class="kit-grid"><div class="kit-qr">${qrSvg}<button class="btn btn--sm" id="kQr">Descargar QR</button></div>
        <div class="kit-txt">${tx.map(([t, v]) => `<div><h3>${esc(t)}</h3><textarea readonly rows="${Math.min(9, v.split("\n").length + 1)}">${esc(v)}</textarea><button class="btn btn--sm" data-copy="${esc(v)}">Copiar</button></div>`).join("")}</div></div>
      <div class="kit-img"><button class="btn btn--sm" data-img="post">Descargar imagen para post (4:5)</button><button class="btn btn--sm" data-img="historia">Descargar imagen para historia (9:16)</button></div>`;
    $$("#kOut [data-copy]").forEach(b => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast("Copiado"); } catch { toast("No se pudo copiar"); } }));
    $("#kQr").addEventListener("click", () => { const blob = new Blob([$("#kOut .kit-qr svg").outerHTML], { type: "image/svg+xml" }); bajar(blob, `qr-${camp}.svg`); });
    $$("#kOut [data-img]").forEach(b => b.addEventListener("click", async () => {
      b.disabled = true; b.textContent = "Generando…";
      try { const blob = await imagenSocial(d, b.dataset.img); bajar(blob, `cuadrosfinos-${slugify(d[1])}-${b.dataset.img}.jpg`); } catch (e) { toast("No se pudo generar la imagen"); }
      b.disabled = false; b.textContent = b.dataset.img === "post" ? "Descargar imagen para post (4:5)" : "Descargar imagen para historia (9:16)";
    }));
  };
  ["#kDest", "#kSrc", "#kMed"].forEach(s => $(s).addEventListener("change", upd)); $("#kCamp").addEventListener("input", upd);
  upd();
}
function bajar(blob, nombre) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }

/* ---------- marketing ---------- */
function vistaKit() {
  shell("marketing", `<div class="top"><div><h1>Marketing</h1><p>Arma el enlace y la imagen de cada publicación o anuncio.</p></div></div>${pestanas("marketing", "kit")}${kitHTML()}`);
  bindKit();
}
function vistaAnuncios() {
  const feed = (url, t, paso) => `<div class="panel"><h2>${t}</h2><div class="kit-link" style="margin-bottom:8px"><input readonly value="${url}"><button class="btn btn--sm" data-feed="${url}">${ic("copiar")} Copiar</button></div><p class="muted small">${paso}</p></div>`;
  shell("marketing", `<div class="top"><div><h1>Marketing</h1><p>Catálogos para anuncios: conéctalos una vez y se actualizan solos con tus cuadros y precios.</p></div></div>${pestanas("marketing", "anuncios")}
    <div class="cols">${feed(`${SITIO}/feeds/meta.csv`, "Meta · Instagram y Facebook", "Administrador de ventas → Catálogo → Orígenes de datos → «Feed de datos» → «Programado» → pega este enlace (cada día).")}
    ${feed(`${SITIO}/feeds/google.xml`, "Google Shopping", "Merchant Center → Productos → Fuentes de datos → «Recuperación programada» → pega este enlace.")}</div>`);
  $$("[data-feed]").forEach(b => b.addEventListener("click", async () => { try { await navigator.clipboard.writeText(b.dataset.feed); toast("Enlace copiado"); } catch {} }));
}
async function vistaMarketing() {
  shell("marketing", `<div class="top"><h1>Marketing</h1></div>${pestanas("marketing", "analisis")}<p class="cargando">Cargando…</p>`);
  const r = await api("marketing?dias=" + DIAS);
  const nombre = s => (BY[s] && BY[s].n) || s;
  const tasa = (a, b) => b ? pct(a / b) : "—";
  const vis = r.dia.reduce((a, d) => a + d.sesiones, 0), ped = r.dia.reduce((a, d) => a + d.pedidos, 0);
  const smax = Math.max(1, ...r.dia.map(d => d.sesiones));
  const inter = Object.fromEntries(r.interaccion.map(x => [x.probo, x]));
  const conP = inter[1] || { sesiones: 0, pedidos: 0 }, sinP = inter[0] || { sesiones: 0, pedidos: 0 };
  const U = r.uso;
  const bloque = (t, html, nota = "") => `<div class="panel"><h2>${t}</h2>${html}${nota ? `<p class="muted small" style="margin-top:8px">${nota}</p>` : ""}</div>`;
  const vacio = `<p class="vacio">Aún no hay datos en este periodo.</p>`;
  // productos: ordenar por vistas, marcar oportunidades
  const prods = r.productos.slice().sort((a, b) => b.vieron - a.vieron);
  shell("marketing", `
    <div class="top"><h1>Marketing</h1>${rangoSeg()}</div>${pestanas("marketing", "analisis")}
    <div class="kpis">
      <div class="kpi"><b>${vis}</b><span>Visitas (personas por día)</span></div>
      <div class="kpi"><b>${ped}</b><span>Pedidos enviados desde la web</span></div>
      <div class="kpi"><b>${tasa(ped, vis)}</b><span>Conversión visita → pedido</span></div>
      <div class="kpi"><b>${tasa(conP.pedidos, conP.sesiones)}</b><span>Conversión de quien probó pared / 3D / AR <small class="muted">(vs ${tasa(sinP.pedidos, sinP.sesiones)} sin probar)</small></span></div>
    </div>
    ${bloque("Visitas por día", r.dia.length ? `<div class="serie">${r.dia.map(d => `<div title="${esc(d.dia)}: ${d.sesiones} visitas, ${d.pedidos} pedidos" style="height:${(d.sesiones / smax) * 100}%"><i style="height:${d.sesiones ? (d.pedidos / d.sesiones) * 100 : 0}%;min-height:${d.pedidos ? 3 : 0}px"></i></div>`).join("")}</div>` : vacio,
      "Gris: visitas · Verde: la parte de esas visitas que envió un pedido")}
    <div class="panel"><h2>Embudo por fuente</h2>${r.embudoFuente.length ? `<table class="tabla"><tr><th>Fuente</th><th class="n">Visitas</th><th class="n">Vieron cuadro</th><th class="n">Agregaron</th><th class="n">Pidieron</th><th class="n">Conversión</th></tr>
      ${r.embudoFuente.map(f => `<tr><td>${esc(f.fuente)}</td><td class="n">${f.visitas}</td><td class="n">${f.vieron}</td><td class="n">${f.agregaron}</td><td class="n">${f.pidieron}</td><td class="n">${tasa(f.pidieron, f.visitas)}</td></tr>`).join("")}</table>` : vacio}
      <p class="muted small" style="margin-top:8px">Usa enlaces con <code>?utm_source=instagram&amp;utm_campaign=…</code> en tus publicaciones y anuncios para verlos separados aquí.</p></div>
    <div class="panel"><h2>Cuadros: interés vs. ventas</h2>${prods.length ? `<div style="overflow-x:auto"><table class="tabla"><tr><th>Cuadro</th><th class="n">Lo vieron</th><th class="n">Probaron pared/3D</th><th class="n">Agregaron</th><th class="n">Pedidos</th><th class="n">Vendidos</th><th class="n">Vista → pedido</th><th></th></tr>
      ${prods.map(x => { const conv = x.vieron ? x.pedidos / x.vieron : 0;
        const flag = x.vieron >= 10 && conv < .02 ? '<span class="est est--pagado">Mucho interés, pocas ventas</span>' : x.pedidos >= 2 && conv >= .1 ? '<span class="est est--entregado">Estrella</span>' : "";
        return `<tr><td>${esc(nombre(x.s))}</td><td class="n">${x.vieron}</td><td class="n">${x.probaron}</td><td class="n">${x.agregaron}</td><td class="n">${x.pedidos}</td><td class="n">${x.vendidos || 0}</td><td class="n">${x.vieron ? pct(conv) : "—"}</td><td>${flag}</td></tr>`; }).join("")}</table></div>` : vacio}
      <p class="muted small" style="margin-top:8px">«Mucho interés, pocas ventas»: revisa precio, fotos o descripción. «Estrella»: úsalo en anuncios.</p></div>
    <div class="cols">
      ${bloque("Fuentes y campañas", r.fuentes.length ? `<table class="tabla"><tr><th>Fuente / medio / campaña</th><th class="n">Visitas</th><th class="n">Agregaron</th><th class="n">Pedidos</th></tr>
        ${r.fuentes.map(f => `<tr><td>${esc(f.fuente)}${f.medio ? ` <span class="muted">/ ${esc(f.medio)}</span>` : ""}${f.campana ? `<br><span class="muted small">${esc(f.campana)}</span>` : ""}</td><td class="n">${f.sesiones}</td><td class="n">${f.agregaron}</td><td class="n">${f.pedidos}</td></tr>`).join("")}</table>` : vacio)}
      ${bloque("Lo que buscan", r.busquedas.length ? `<table class="tabla"><tr><th>Búsqueda</th><th class="n">Veces</th><th></th></tr>
        ${r.busquedas.map(b => `<tr><td>${esc(b.termino)}</td><td class="n">${b.veces}</td><td>${b.min_resultados === 0 ? '<span class="est est--pagado">Sin resultados</span>' : ""}</td></tr>`).join("")}</table>` : vacio,
        "«Sin resultados» = lo buscan y no lo tienes: ideas para el generador de productos.")}
      ${bloque("Dispositivos", r.disp.length ? `<table class="tabla"><tr><th>Dispositivo</th><th class="n">Visitas</th><th class="n">Pedidos</th><th class="n">Conversión</th></tr>
        ${r.disp.map(d => `<tr><td>${esc(d.disp)}</td><td class="n">${d.sesiones}</td><td class="n">${d.pedidos}</td><td class="n">${tasa(d.pedidos, d.sesiones)}</td></tr>`).join("")}</table>` : vacio)}
      ${bloque("Ciudades (aproximado)", r.regiones.length ? `<table class="tabla"><tr><th>Ciudad / región</th><th class="n">Visitas</th><th class="n">Pedidos</th></tr>
        ${r.regiones.map(d => `<tr><td>${esc(d.region)}</td><td class="n">${d.sesiones}</td><td class="n">${d.pedidos}</td></tr>`).join("")}</table>` : vacio)}
      ${bloque("Herramientas de la web", `<table class="tabla">${[["ver_pared", "Vieron «En tu pared»"], ["ver_3d", "Abrieron el 3D"], ["realidad_aumentada", "Usaron realidad aumentada"], ["personalizar", "Personalizaron"], ["zoom", "Usaron el zoom"], ["ver_foto", "Vieron fotos de ambiente"], ["ayuda_inicio", "Abrieron «Ayúdame a elegir»"], ["ayuda_resultado", "Terminaron la guía"], ["search", "Buscaron"], ["filtrar", "Filtraron el catálogo"], ["contacto_whatsapp", "Escribieron por WhatsApp (botón)"]].map(([k, t]) => `<tr><td>${t}</td><td class="n">${U[k] || 0}</td></tr>`).join("")}</table>`)}
      ${bloque("Compartidos", r.compartir.length ? `<table class="tabla"><tr><th>Cómo</th><th class="n">Veces</th></tr>${r.compartir.map(c => `<tr><td>${esc(c.metodo)}</td><td class="n">${c.veces}</td></tr>`).join("")}</table>` : vacio)}
    </div>
    ${bloque("Páginas más visitadas", r.paginas.length ? `<table class="tabla"><tr><th>Página</th><th class="n">Vistas</th><th class="n">Personas</th></tr>
      ${r.paginas.map(x => `<tr><td><a href="${esc(x.pagina)}" target="_blank" rel="noopener">${esc(x.pagina)}</a></td><td class="n">${x.vistas}</td><td class="n">${x.personas}</td></tr>`).join("")}</table>` : vacio)}`);
  bindRango(vistaMarketing);
}

/* ---------- productos y creación de cuadros ---------- */
// Estilos de imagen con IA (el prompt real se arma en el servidor)
const ESTILOS_IA = {
  oscuro: { n: "Fotográfico oscuro", cuantas: 2, ayuda: "Foto en blanco y negro, fondo negro y luz dramática. Ideal para animales, retratos y paisajes.", ej: "Ej.: puma andino mirando de frente, entre la niebla" },
  claro: { n: "Minimalista claro", cuantas: 2, ayuda: "Fondo blanco, líneas finas y mucho espacio libre. Ideal para símbolos y diseños sencillos.", ej: "Ej.: cruz minimalista delgada negra, centrada" },
  tipografico: { n: "Tipográfico", cuantas: 2, ayuda: "Para cuadros con palabras. Usa un modelo que escribe mejor las letras y gasta más cuota diaria de IA. Revisa la ortografía antes de publicar.", ej: "Ej.: cruz delgada negra; en vez de la línea horizontal debe decir «JESUCRISTO»" },
};
const PRECIO_STD = x => x.o === "triptico" ? CAT.config.precio.triptico : x.o === "diptico" ? CAT.config.precio.diptico : CAT.config.precio.pieza;
const colNom = id => (CAT.colecciones.find(c => c.id === id) || {}).nombre || id;
const imgDe = (x, thumb) => x.m ? `/media/${x.s}/${thumb ? "t" : "obra"}${["triptico", "diptico"].includes(x.o) ? "-1" : ""}.webp?v=${encodeURIComponent(x.m)}`
  : x.i ? `/img/cuadros/${thumb ? "t/" : ""}${x.s}${["triptico", "diptico"].includes(x.o) ? "-1" : ""}.webp` : "/img/favicon.svg";
let FILPROD = "todos", BUSPROD = "";
async function recargarCatalogo() {
  try { const t = await (await fetch("/data.js?f=" + Date.now(), { cache: "no-store" })).text();
    const c = JSON.parse(t.slice(t.indexOf("window.CATALOGO=") + 16, t.lastIndexOf(";")));
    CAT.productos = c.productos; Object.keys(BY).forEach(k => delete BY[k]); c.productos.forEach(x => (BY[x.s] = x)); } catch {}
}
async function listaProductos() {
  const { productos: filas } = await api("productos");
  const fila = Object.fromEntries(filas.map(f => [f.slug, f]));
  const todos = CAT.productos.map(x => ({ x, f: fila[x.s] }));
  filas.filter(f => !BY[f.slug]).forEach(f => todos.push({ x: { ...f.datos, s: f.slug }, f }));
  return todos.map(({ x, f }) => ({ x, f, estado: !f ? "web" : f.estado === "publicado" ? (f.base ? "modificado" : "nuevo") : f.estado }));
}
async function vistaProductos() {
  shell("productos", `<div class="top"><div><h1>Productos</h1><p>Tus cuadros en la web. Crea nuevos, cambia precios y textos, u ocúltalos.</p></div>
    <button class="btn btn--p" id="crear">+ Nuevo cuadro</button></div>${pestanas("productos", "catalogo")}
    <div class="filtros" id="fp">${[["todos", "Todos"], ["web", "Originales"], ["nuevo", "Creados por ti"], ["modificado", "Editados"], ["borrador", "Borradores"], ["oculto", "Ocultos"]].map(([k, n]) => `<button class="chip ${k === FILPROD ? "on" : ""}" data-f="${k}">${n}<small data-c="${k}"></small></button>`).join("")}</div>
    <input type="search" id="bp" placeholder="Buscar cuadro por nombre o colección" value="${esc(BUSPROD)}" style="margin-bottom:14px">
    <div class="prods" id="prods">${'<div class="sk" style="height:250px"></div>'.repeat(8)}</div>`);
  $("#crear").addEventListener("click", () => location.hash = "#/productos/nuevo");
  $$("#fp .chip").forEach(b => b.addEventListener("click", () => { FILPROD = b.dataset.f; vistaProductos(); }));
  let tt; $("#bp").addEventListener("input", e => { clearTimeout(tt); tt = setTimeout(() => { BUSPROD = e.target.value; pintar(); }, 150); });
  let todos = await listaProductos();
  const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const pintar = () => {
    const cnt = {}; todos.forEach(p => { cnt[p.estado] = (cnt[p.estado] || 0) + 1; }); cnt.todos = todos.length;
    $$("#fp [data-c]").forEach(sm => sm.textContent = cnt[sm.dataset.c] || "");
    const q = norm(BUSPROD);
    const l = todos.filter(p => (FILPROD === "todos" || p.estado === FILPROD) && (!q || norm(`${p.x.n} ${colNom(p.x.c)}`).includes(q)));
    const etiqueta = { web: "", nuevo: '<span class="est est--entregado">En la web · creado por ti</span>', modificado: '<span class="est est--entregado">En la web · editado</span>', borrador: '<span class="est est--nuevo">Borrador</span>', oculto: '<span class="est est--cancelado">Oculto</span>' };
    $("#prods").innerHTML = l.length ? l.map(({ x, estado }) => `<button class="prod" data-s="${esc(x.s)}">
      <span class="prod__img"><img src="${imgDe(x, true)}" alt="" loading="lazy"></span>
      <span class="prod__info"><b>${esc(x.n)}</b><small>${esc(colNom(x.c))} · ${x.q ? "Cotizar" : "S/ " + (x.pr || PRECIO_STD(x)) + (x.pr ? " (especial)" : "")}</small>${etiqueta[estado]}</span></button>`).join("") : vacio("No hay cuadros con ese filtro.", "productos");
    $$("#prods .prod").forEach(b => b.addEventListener("click", () => { const p = todos.find(t => t.x.s === b.dataset.s); editorProducto(p, async () => { await recargarCatalogo(); todos = await listaProductos(); pintar(); }); }));
  };
  pintar();
}

// Convierte una imagen (URL o dataURL) en las variantes que usa la web
async function variantes(src, horizontal) {
  const im = await cargarImg(src);
  const toBlob = (c, tipo, q) => new Promise(ok => c.toBlob(ok, tipo, q));
  const lienzo = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; };
  const escala = (max) => { const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight)); return [Math.round(im.naturalWidth * s), Math.round(im.naturalHeight * s)]; };
  const [w1, h1] = escala(1400); const [c1, g1] = lienzo(w1, h1); g1.drawImage(im, 0, 0, w1, h1);
  const obra = await toBlob(c1, "image/webp", .86);
  const tw = horizontal ? 560 : 400, th = Math.round(tw * im.naturalHeight / im.naturalWidth); const [c2, g2] = lienzo(tw, th); g2.drawImage(im, 0, 0, tw, th);
  const t = await toBlob(c2, "image/webp", .8);
  return { obra, t, im };
}
async function imagenOG(im, x, horizontal) {
  const W = 1200, H = 630; const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
  await document.fonts.load("600 46px Inter");
  g.fillStyle = "#0b0b0b"; g.fillRect(0, 0, W, H);
  const rg = g.createRadialGradient(380, 300, 40, 380, 300, 520); rg.addColorStop(0, "#302c26"); rg.addColorStop(1, "#0b0b0b"); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const fh = horizontal ? 380 : 470, fw = Math.round(fh * (horizontal ? 37.4 / 29.8 : 29.8 / 37.4)), x0 = 380 - fw / 2, y0 = (H - fh) / 2;
  g.save(); g.shadowColor = "rgba(0,0,0,.75)"; g.shadowBlur = 40; g.shadowOffsetY = 20; g.fillStyle = "#0e0e0e"; g.fillRect(x0, y0, fw, fh); g.restore();
  const mx = fw * .055, my = fh * .044, iw = fw - 2 * mx, ih = fh - 2 * my, s = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), sw = iw / s, sh = ih / s;
  g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x0 + mx, y0 + my, iw, ih);
  const tx = 720; g.fillStyle = "#96928a"; g.font = "500 20px Inter"; g.fillText("CUADROS FINOS", tx, 150);
  g.fillStyle = "#f3f1ec"; g.font = "600 44px Inter"; let y = 205;
  envolver(g, (x.n || "").toUpperCase(), 440).slice(0, 3).forEach(l => { g.fillText(l, tx, y); y += 54; });
  g.fillStyle = "#96928a"; g.font = "400 24px Inter"; y += 6; envolver(g, x.f || "", 440).slice(0, 3).forEach(l => { g.fillText(l, tx, y); y += 32; });
  const pr = x.q ? null : x.pr || PRECIO_STD(x); if (pr) { g.fillStyle = "#f3f1ec"; g.font = "600 40px Inter"; g.fillText("S/ " + pr, tx, Math.min(y + 50, 520)); }
  g.fillStyle = "#96928a"; g.font = "400 20px Inter"; g.fillText("Hecho en Lima · Envío a todo el Perú", tx, 560);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", .86));
}
async function subir(clave, blob) {
  const r = await fetch("/api/admin/media/" + clave, { method: "PUT", body: blob, headers: { "content-type": blob.type }, credentials: "same-origin" });
  const d = await r.json(); if (!d.ok) throw new Error(d.error || "No se pudo subir la imagen");
}
function vistaPrevia(src, horizontal) {
  const w = (CAT.paredes || {}).sala;
  const marco = `<span class="mp-marco ${horizontal ? "h" : ""}">${src ? `<img src="${esc(src)}" alt="">` : `<span class="mp-vacio">Sin imagen</span>`}</span>`;
  return `<div class="mp"><div class="mp-obra">${marco}</div>${w ? `<div class="mp-pared"><img src="/img/ambiente/${w.img}.webp" alt="">
    <div class="mp-cuadro ${horizontal ? "h" : ""}" style="left:${w.cx}%;top:${w.cy}%;width:${w.cm * (horizontal ? 37.4 : 29.8)}%">${src ? `<img src="${esc(src)}" alt="">` : ""}</div><span>Vista a escala real · 30 × 37 cm</span></div>` : ""}</div>`;
}
function editorProducto(p, alGuardar) {
  const esNuevo = !p, x0 = p ? { ...p.x } : { n: "", f: "", c: CAT.colecciones[0].id, a: ["sala"], o: "vertical", nw: 1 };
  let imagen = p ? imgDe(x0, false) : null, imagenNueva = null;
  const d = document.createElement("div"); d.className = "drawer";
  const colOpts = CAT.colecciones.map(c => `<option value="${c.id}" ${c.id === x0.c ? "selected" : ""}>${esc(c.nombre)}</option>`).join("");
  const subsDe = c => ((CAT.colecciones.find(k => k.id === c) || {}).subs || []);
  d.innerHTML = `<section role="dialog" aria-modal="true" aria-label="${esNuevo ? "Nuevo cuadro" : esc(x0.n)}" class="ancho">
    <div class="dhead"><div class="fila"><div><h1>${esNuevo ? "Nuevo cuadro" : esc(x0.n)}</h1><p class="muted small">${esNuevo ? "Sube tu imagen o créala con IA, completa los datos y publícalo." : p.estado === "web" ? "Cuadro de la web. Los cambios se publican al instante." : "Estado: " + esc(p.estado)}</p></div><button class="cerrar" aria-label="Cerrar">×</button></div></div>
    <div class="dbody editor">
      <div class="ed-col">
        <div class="sec"><h3>1 · Imagen</h3>
          <div class="seg" id="modo" style="margin-bottom:12px"><button data-m="ia" class="${esNuevo ? "on" : ""}">Crear con IA</button><button data-m="subir" class="${esNuevo ? "" : "on"}">Subir imagen</button></div>
          <div id="m-ia" ${esNuevo ? "" : "hidden"}>
            <div class="f"><span>Estilo</span><div class="seg" id="estilo" role="group" aria-label="Estilo de la imagen">${Object.entries(ESTILOS_IA).map(([k, e], i) => `<button type="button" data-e="${k}" class="${i ? "" : "on"}">${e.n}</button>`).join("")}</div></div>
            <p class="muted small" id="estilo-ayuda" style="margin:4px 0 10px">${ESTILOS_IA.oscuro.ayuda}</p>
            <label class="f"><span>Describe el cuadro</span><textarea id="idea" rows="3" placeholder="${ESTILOS_IA.oscuro.ej}"></textarea></label>
            <label class="check" style="margin:8px 0"><input type="checkbox" id="color"> <span>Con algo de color (tonos tierra)</span></label>
            <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--p" id="gen">✨ Generar 2 opciones</button><button class="btn" id="sugerir">Sugerir nombre y frase</button></div>
            <p class="muted small" id="entendio" hidden></p>
            <div class="opciones" id="opciones"></div>
            <p class="muted small">Usa la IA de Cloudflare. Cada imagen tarda unos segundos. ¿La hiciste en ChatGPT? Descárgala y usa «Subir imagen».</p>
          </div>
          <div id="m-subir" ${esNuevo ? "hidden" : ""}>
            <label class="subir"><input type="file" id="archivo" accept="image/*"><span>${ic("productos")}<b>Elegir imagen</b><small>JPG, PNG o WebP · vertical 2:3 recomendado · mínimo 1000 px de alto</small></span></label>
          </div>
        </div>
        <div class="sec"><h3>2 · Datos</h3>
          <div class="grid2">
            <label class="f" style="grid-column:1/-1"><span>Nombre</span><input id="n" value="${esc(x0.n)}" placeholder="Puma · Andes" maxlength="80"></label>
            <label class="f" style="grid-column:1/-1"><span>Frase corta</span><input id="f" value="${esc(x0.f)}" placeholder="El que cuida la montaña." maxlength="160"></label>
            <label class="f"><span>Colección</span><select id="c">${colOpts}</select></label>
            <label class="f"><span>Subcolección</span><select id="u"></select></label>
            <label class="f"><span>Formato</span><select id="o"><option value="vertical" ${x0.o === "vertical" ? "selected" : ""}>Vertical (30 × 37)</option><option value="horizontal" ${["horizontal", "panoramico"].includes(x0.o) ? "selected" : ""}>Horizontal (37 × 30)</option>${["triptico", "diptico"].includes(x0.o) ? `<option value="${x0.o}" selected>${x0.o === "triptico" ? "Tríptico" : "Díptico"}</option>` : ""}</select></label>
            <label class="f"><span>Precio (vacío = estándar S/ ${PRECIO_STD(x0)})</span><input id="pr" type="number" min="1" value="${x0.pr || ""}" placeholder="${PRECIO_STD(x0)}"></label>
          </div>
          <div style="margin-top:10px"><span class="small" style="font-weight:500;color:var(--fg2)">Va bien en</span>
            <div class="checks">${["sala", "dormitorio", "oficina", "comedor"].map(a => `<label class="check"><input type="checkbox" name="a" value="${a}" ${(x0.a || []).includes(a) ? "checked" : ""}> <span>${a[0].toUpperCase() + a.slice(1)}</span></label>`).join("")}</div></div>
          <div class="checks" style="margin-top:6px"><label class="check"><input type="checkbox" id="t" ${x0.t ? "checked" : ""}> <span>Marcar como «Más pedido»</span></label><label class="check"><input type="checkbox" id="nw" ${x0.nw ? "checked" : ""}> <span>Marcar como «Nuevo»</span></label></div>
          <label class="f" style="margin-top:10px"><span>Descripción para la ficha (opcional)</span><textarea id="dd" rows="3" placeholder="Si lo dejas vacío, se arma sola con la frase, la medida y el precio.">${esc(x0.d || "")}</textarea></label>
        </div>
      </div>
      <div class="ed-col"><div class="sec" style="position:sticky;top:12px"><h3>Vista previa</h3><div id="prev">${vistaPrevia(imagen, ["horizontal", "panoramico"].includes(x0.o))}</div></div></div>
      <div class="guardar">
        <button class="btn btn--p" id="publicar">${p && p.estado !== "borrador" ? "Guardar y publicar" : "Publicar en la web"}</button>
        <button class="btn" id="borrador">Guardar borrador</button>
        ${(() => { const extra = [
          p && p.estado !== "borrador" ? `<a href="/cuadro/${esc(x0.s)}/" target="_blank" rel="noopener">${ic("web")} Ver en la web</a>` : "",
          p && p.estado !== "oculto" && !esNuevo ? `<button type="button" id="ocultar">Ocultar de la web</button>` : "",
          p && p.estado === "oculto" ? `<button type="button" id="mostrar">Volver a mostrar</button>` : "",
          p && p.f && p.estado !== "web" ? `<button type="button" id="restaurar" class="peligro">${p.f.base ? "Deshacer cambios" : "Eliminar cuadro"}</button>` : ""].filter(Boolean);
          return extra.length ? `<details class="menu-mas"><summary class="btn btn--ghost" title="Más acciones" aria-label="Más acciones">${ic("mas")}</summary><div class="menu-lista">${extra.join("")}</div></details>` : ""; })()}
      </div>
    </div></section>`;
  document.body.append(d);
  const cerrar = () => { d.remove(); if (location.hash === "#/productos/nuevo") history.replaceState(null, "", "#/productos"), render(); };
  d.addEventListener("click", e => { if (e.target === d || e.target.closest(".cerrar")) cerrar(); });
  const pintarSubs = () => { const ss = subsDe($("#c", d).value); $("#u", d).innerHTML = ss.length ? ss.map(([k, n]) => `<option value="${k}" ${k === x0.u ? "selected" : ""}>${esc(n)}</option>`).join("") : `<option value="">—</option>`; };
  pintarSubs(); $("#c", d).addEventListener("change", pintarSubs);
  const horiz = () => $("#o", d).value === "horizontal";
  const prev = () => $("#prev", d).innerHTML = vistaPrevia(imagenNueva || imagen, horiz());
  $("#o", d).addEventListener("change", prev);
  $$("#modo button", d).forEach(b => b.addEventListener("click", () => { $$("#modo button", d).forEach(z => z.classList.toggle("on", z === b)); $("#m-ia", d).hidden = b.dataset.m !== "ia"; $("#m-subir", d).hidden = b.dataset.m !== "subir"; }));
  $("#archivo", d).addEventListener("change", e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { imagenNueva = r.result; prev(); toast("Imagen lista"); }; r.readAsDataURL(f); });
  let estilo = "oscuro";
  const cuantas = () => ESTILOS_IA[estilo].cuantas;
  const textoGen = otras => `✨ Generar ${otras ? "otras " : ""}${cuantas()}${otras ? "" : " opciones"}`;
  $$("#estilo button", d).forEach(b => b.addEventListener("click", () => {
    estilo = b.dataset.e; $$("#estilo button", d).forEach(z => z.classList.toggle("on", z === b));
    $("#estilo-ayuda", d).textContent = ESTILOS_IA[estilo].ayuda; $("#idea", d).placeholder = ESTILOS_IA[estilo].ej;
    const g = $("#gen", d); if (!g.disabled) g.textContent = textoGen(!!$(".opcion", d));
  }));
  $("#gen", d).addEventListener("click", async () => {
    const idea = $("#idea", d).value.trim(); if (!idea) return toast("Describe el cuadro primero");
    const b = $("#gen", d); b.disabled = true; b.textContent = "Entendiendo la idea…";
    const op = $("#opciones", d), en = $("#entendio", d); const n = cuantas();
    op.innerHTML = '<div class="sk"></div>'.repeat(n); en.hidden = true;
    // 1) La IA entiende la idea una vez: la traduce al inglés y separa el texto a escribir y el fondo pedido
    let q = { escena: idea, texto: "", fondo: "" };
    try { q = await api("ia/prompt", { method: "POST", body: { idea } }); }
    catch (e) { if (/cuota/i.test(e.message)) { op.innerHTML = `<p class="err">${esc(e.message)}</p>`; b.disabled = false; b.textContent = textoGen(false); return; } }
    en.innerHTML = `La IA entendió: <i>${esc(q.escena)}</i>${q.texto ? ` · Texto: <b>«${esc(q.texto)}»</b>` : ""}${q.fondo ? ` · Fondo ${esc(q.fondo)}` : ""}`; en.hidden = false;
    if (q.texto && estilo !== "tipografico") toast("Pediste texto: el estilo Tipográfico lo escribe mucho mejor");
    // 2) Las imágenes, en paralelo
    b.textContent = "Generando…";
    const res = await Promise.allSettled(Array.from({ length: n }, () => api("ia/imagen", { method: "POST", body: { idea, escena: q.escena, texto: q.texto, fondo: q.fondo, estilo, color: $("#color", d).checked } })));
    const ok = res.filter(r => r.status === "fulfilled").map(r => r.value.imagen);
    op.innerHTML = ok.length ? ok.map((src, i) => `<button class="opcion" data-i="${i}"><img src="${src}" alt="Opción ${i + 1}"></button>`).join("") : `<p class="err">${esc((res.find(r => r.status === "rejected") || {}).reason?.message || "No se pudo generar")}</p>`;
    $$(".opcion", op).forEach(o => o.addEventListener("click", () => { $$(".opcion", op).forEach(z => z.classList.toggle("on", z === o)); imagenNueva = ok[+o.dataset.i]; prev(); }));
    if (ok.length && !$("#n", d).value.trim()) $("#sugerir", d).click();
    b.disabled = false; b.textContent = textoGen(ok.length > 0);
  });
  $("#sugerir", d).addEventListener("click", async () => {
    const idea = $("#idea", d).value.trim() || $("#n", d).value.trim(); if (!idea) return toast("Escribe la idea o el nombre");
    const b = $("#sugerir", d); b.disabled = true; b.textContent = "Pensando…";
    try { const r = await api("ia/textos", { method: "POST", body: { idea } });
      if (r.nombre) $("#n", d).value = r.nombre; if (r.frase) $("#f", d).value = r.frase;
      if (r.coleccion) { $("#c", d).value = r.coleccion; pintarSubs(); }
      if (r.ambientes && r.ambientes.length) $$('[name="a"]', d).forEach(c => c.checked = r.ambientes.includes(c.value));
      if (r.descripcion && !$("#dd", d).value.trim()) $("#dd", d).value = r.descripcion;
      toast("Textos sugeridos: revísalos y ajústalos");
    } catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = "Sugerir nombre y frase";
  });
  const datos = () => ({ n: $("#n", d).value.trim(), f: $("#f", d).value.trim(), c: $("#c", d).value, u: $("#u", d).value, o: $("#o", d).value,
    pr: $("#pr", d).value ? +$("#pr", d).value : undefined, a: $$('[name="a"]:checked', d).map(c => c.value), t: $("#t", d).checked, nw: $("#nw", d).checked,
    d: $("#dd", d).value.trim(), i: x0.i || !!imagenNueva, m: x0.m, q: x0.q, p: x0.p, k: x0.k });
  async function guardar(estado) {
    const dt = datos();
    if (!dt.n) return toast("Ponle un nombre al cuadro");
    if (esNuevo && !imagenNueva) return toast("Falta la imagen: créala con IA o súbela");
    const btns = $$(".guardar .btn, .guardar .menu-lista button", d); btns.forEach(b => b.disabled = true);
    try {
      let slug = x0.s;
      if (esNuevo) { const r = await api("productos", { method: "POST", body: { nuevo: true, datos: { ...dt, i: 0 }, estado: "borrador" } }); slug = r.slug; }
      if (imagenNueva) {
        toast("Preparando imágenes…");
        const { obra, t, im } = await variantes(imagenNueva, horiz());
        const og = await imagenOG(im, dt, horiz());
        await subir(`${slug}/obra.webp`, obra); await subir(`${slug}/t.webp`, t); await subir(`${slug}/og.jpg`, og);
        dt.m = Date.now().toString(36); dt.i = true;
      }
      await api("productos", { method: "POST", body: { slug, datos: dt, estado } });
      toast(estado === "publicado" ? "¡Publicado! Ya está en la web." : "Borrador guardado");
      cerrar(); if (alGuardar) alGuardar(); else vistaProductos();
    } catch (e) { toast(e.message); btns.forEach(b => b.disabled = false); }
  }
  $("#publicar", d).addEventListener("click", () => guardar("publicado"));
  $("#borrador", d).addEventListener("click", () => guardar("borrador"));
  $("#ocultar", d)?.addEventListener("click", async () => { await api("productos/" + x0.s, { method: "PATCH", body: { estado: "oculto" } }); toast("Oculto de la web"); cerrar(); alGuardar && alGuardar(); });
  $("#mostrar", d)?.addEventListener("click", async () => { await api("productos/" + x0.s, { method: "PATCH", body: { estado: "publicado" } }); toast("Visible otra vez"); cerrar(); alGuardar && alGuardar(); });
  $("#restaurar", d)?.addEventListener("click", async () => { if (!confirm(p.f.base ? "¿Deshacer los cambios y dejarlo como estaba en la web?" : "¿Eliminar este cuadro del panel?")) return;
    await api("productos/" + x0.s, { method: "DELETE" }); toast("Listo"); cerrar(); alGuardar && alGuardar(); });
}

/* ---------- desarrollo: equipo, cuenta e integraciones ---------- */
const topDes = (t, sub) => `<div class="top"><div><h1>Desarrollo</h1><p>${sub}</p></div><button class="btn btn--sm" id="salir">Cerrar sesión</button></div>${pestanas("desarrollo", t)}`;
const bindSalir = () => $("#salir").addEventListener("click", async () => { await api("logout", { method: "POST" }); YO = null; location.hash = ""; render(); });
async function vistaEquipo() {
  const { usuarios } = await api("usuarios");
  shell("desarrollo", `${topDes("equipo", "Quién entra al panel.")}
    <div class="cols"><div class="panel"><h2>Equipo con acceso</h2>
      <table class="tabla">${usuarios.map(u => `<tr><td>${esc(u.nombre || "")}<br><span class="muted small">${esc(u.email)} · ${esc(u.rol === "admin" ? "Administrador" : "Equipo")}</span></td>
        <td class="n">${u.email !== YO.email && YO.rol === "admin" ? `<button class="btn btn--sm" data-del="${esc(u.email)}">Quitar</button>` : ""}</td></tr>`).join("")}</table></div>
      ${YO.rol === "admin" ? `<div class="panel"><h2>Dar acceso</h2><form id="fu" style="display:grid;gap:8px"><input name="nombre" placeholder="Nombre" required><input name="email" type="email" placeholder="correo@ejemplo.com" required>
        <select name="rol"><option value="equipo">Equipo (ventas y logística)</option><option value="admin">Administrador</option></select>
        <button class="btn btn--p">Dar acceso</button><p class="muted small" id="tmp"></p></form></div>` : ""}</div>`);
  bindSalir();
  $$("[data-del]").forEach(b => b.addEventListener("click", async () => { if (confirm("¿Quitar el acceso de " + b.dataset.del + "?")) { await api("usuarios/" + encodeURIComponent(b.dataset.del), { method: "DELETE" }); vistaEquipo(); } }));
  $("#fu")?.addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await api("usuarios", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
      $("#tmp").textContent = `Listo. Contraseña temporal: ${r.temporal} — pásasela y que la cambie en Desarrollo → Mi cuenta.`; }
    catch (er) { toast(er.message); }
  });
}
function vistaCuenta() {
  shell("desarrollo", `${topDes("cuenta", `${esc(YO.nombre || "")} · ${esc(YO.email)}`)}
    <div class="panel" style="max-width:480px"><h2>Cambiar mi contraseña</h2><form id="fc" style="display:grid;gap:8px">
      <input name="actual" type="password" placeholder="Contraseña actual" required autocomplete="current-password">
      <input name="nueva" type="password" placeholder="Nueva (mínimo 10 caracteres)" minlength="10" required autocomplete="new-password">
      <button class="btn btn--p">Cambiar</button></form></div>`);
  bindSalir();
  $("#fc").addEventListener("submit", async e => { e.preventDefault(); try { await api("clave", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); toast("Contraseña cambiada"); e.target.reset(); } catch (er) { toast(er.message); } });
}
async function vistaIntegraciones() {
  shell("desarrollo", `${topDes("integraciones", "Estado del sistema y conexiones.")}<p class="cargando">Revisando…</p>`);
  let r = {}; try { r = await api("sistema"); } catch {}
  const M = (CAT.config && CAT.config.medicion) || {};
  const fila = (ok, t, d) => `<tr><td><span class="luz ${ok === true ? "v" : ok === false ? "r" : "g"}" style="display:inline-block"></span></td><td><b>${t}</b><br><span class="muted small">${d}</span></td></tr>`;
  shell("desarrollo", `${topDes("integraciones", "Estado del sistema y conexiones.")}
    <div class="cols">
      <div class="panel"><h2>Sistema</h2><table class="tabla integ">
        ${fila(!!r.db, "Base de datos", r.db ? `${r.pedidos} pedidos · ${r.productos} cuadros del panel · ${r.eventos} eventos medidos` : "Sin conexión")}
        ${fila(!!r.ia, "IA de Cloudflare", r.ia ? "Imágenes (FLUX) y textos (Llama) disponibles" : "No conectada")}
        ${fila(!!r.sesion, "Sesiones seguras", r.sesion ? "Clave de sesión configurada" : "Falta SESSION_SECRET")}
        ${fila(r.ultimoEvento ? true : null, "Medición propia", r.ultimoEvento ? `Último evento: ${esc(r.ultimoEvento.replace("T", " ").slice(0, 16))}` : "Aún no llegan visitas")}
      </table></div>
      <div class="panel"><h2>Medición externa</h2><table class="tabla integ">
        ${fila(M.ga4 ? true : null, "Google Analytics 4", M.ga4 ? esc(M.ga4) : "Sin ID · se activa al poner el ID")}
        ${fila(M.metaPixel ? true : null, "Meta Pixel", M.metaPixel ? esc(M.metaPixel) : "Sin ID · necesario para anuncios con conversión")}
        ${fila(M.clarity ? true : null, "Microsoft Clarity", M.clarity ? esc(M.clarity) : "Sin ID · grabaciones y mapas de calor")}
      </table><p class="muted small" style="margin-top:8px">Pásame los IDs y los activo; solo cargan con el permiso del visitante.</p></div>
      <div class="panel"><h2>Archivos públicos</h2><table class="tabla integ">
        ${[["/sitemap.xml", "Mapa del sitio (Google)"], ["/feeds/meta.csv", "Catálogo Meta"], ["/feeds/google.xml", "Catálogo Google"], ["/llms.txt", "Guía para buscadores con IA"], ["/robots.txt", "Robots"]].map(([u, t]) => `<tr><td colspan="2"><a href="${u}" target="_blank" rel="noopener">${t}</a><br><span class="muted small">${SITIO}${u}</span></td></tr>`).join("")}
      </table></div>
    </div>`);
  bindSalir();
}

/* ---------- rutas ---------- */
async function render() {
  if (!YO) return arrancar();
  await pulso(true);
  const [, sec, arg] = location.hash.split("/");
  try {
    // enlaces antiguos
    const ANT = { resumen: "#/dashboard", pedidos: "#/ventas", entregas: "#/logistica", ajustes: "#/desarrollo", generador: "#/productos/nuevo" };
    if (ANT[sec]) { history.replaceState(null, "", ANT[sec]); return render(); }
    if (sec === "pedido" && arg) return vistaPedido(arg);
    if (sec === "ventas") return vistaPedidos();
    if (sec === "logistica") return vistaEntregas();
    if (sec === "marketing") return arg === "kit" ? vistaKit() : arg === "anuncios" ? vistaAnuncios() : vistaMarketing();
    if (sec === "productos") { if (arg === "nuevo") { if (!$(".prods")) await vistaProductos(); $$(".tabs a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#/productos/nuevo")); if (!$(".drawer")) editorProducto(null); return; } return vistaProductos(); }
    if (sec === "desarrollo") return arg === "cuenta" ? vistaCuenta() : arg === "integraciones" ? vistaIntegraciones() : vistaEquipo();
    return vistaResumen();
  } catch (e) { if (YO) app.innerHTML = `<p class="cargando">${esc(e.message)}</p>`; }
}
async function arrancar() {
  try {
    const r = await fetch("/api/admin/estado", { credentials: "same-origin" }).then(r => r.json());
    if (!r.ok) { app.innerHTML = `<p class="cargando">El panel aún no está conectado a la base de datos (${esc(r.error || "")}).</p>`; return; }
    if (r.necesitaSetup) return vistaIngreso(true);
    if (!r.usuario) return vistaIngreso(false);
    YO = r.usuario; await pulso(true); render();
  } catch { app.innerHTML = `<p class="cargando">No se pudo conectar con el servidor.</p>`; }
}
addEventListener("hashchange", () => { if (!location.hash.startsWith("#/pedido/")) $$(".drawer").forEach(d => d.remove()); render(); });
arrancar();
