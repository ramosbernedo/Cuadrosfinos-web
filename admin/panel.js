/* Panel de Cuadros Finos: resumen, pedidos, entregas y ajustes. */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const soles = n => "S/ " + Math.round(Number(n) || 0).toLocaleString("es-PE");
const pct = n => (n * 100).toFixed(n && n < .1 ? 1 : 0) + "%";
const CAT = window.CATALOGO || { productos: [], config: {} };
const BY = Object.fromEntries(CAT.productos.map(x => [x.s, x]));
const thumb = s => BY[s] && BY[s].i ? `/img/cuadros/t/${s}${BY[s].o === "triptico" || BY[s].o === "diptico" ? "-1" : ""}.webp` : "/img/favicon.svg";
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
const SECCIONES = [["resumen", "Resumen"], ["pedidos", "Pedidos"], ["entregas", "Entregas"], ["marketing", "Marketing", "fase 2"], ["productos", "Productos", "fase 3"], ["generador", "Generador", "fase 4"], ["ajustes", "Ajustes"]];
function shell(activa, contenido, badge = {}) {
  app.innerHTML = `<div class="shell"><nav class="side" aria-label="Secciones">
    <div class="marca"><span class="wm"><i></i></span>Cuadros Finos</div>
    ${SECCIONES.map(([k, n, f]) => `<a href="#/${k}" class="${k === activa ? "on" : ""}">${n}${badge[k] ? `<span class="badge">${badge[k]}</span>` : f ? `<small>${f}</small>` : ""}</a>`).join("")}
    <div class="yo">${esc(YO.nombre || YO.email)}<br><a href="#/ajustes" style="padding:0;display:inline">Ajustes</a></div>
  </nav><main class="main" id="main">${contenido}</main></div>`;
}
const rangoSeg = () => `<div class="seg" id="rango">${[7, 30, 90, 365].map(d => `<button data-d="${d}" class="${d === DIAS ? "on" : ""}">${d === 365 ? "1 año" : d + " días"}</button>`).join("")}</div>`;
const bindRango = fn => $$("#rango button").forEach(b => b.addEventListener("click", () => { DIAS = +b.dataset.d; fn(); }));

/* ---------- resumen ---------- */
async function vistaResumen() {
  shell("resumen", `<p class="cargando">Cargando…</p>`);
  const r = await api("resumen?dias=" + DIAS);
  const k = r.kpi, e = r.entregas, f = r.embudo;
  const nombre = s => (BY[s] && BY[s].n) || s;
  const pasos = [["page_view", "Visitas"], ["view_item", "Vieron un cuadro"], ["add_to_cart", "Agregaron"], ["view_cart", "Abrieron selección"], ["generate_lead", "Enviaron pedido"]];
  const max = Math.max(1, ...pasos.map(([n]) => f[n] || 0));
  const smax = Math.max(1, ...r.serie.map(d => d.pedidos));
  shell("resumen", `
    <div class="top"><h1>Resumen</h1>${rangoSeg()}</div>
    <div class="kpis">
      <div class="kpi"><b>${k.pedidos || 0}</b><span>Pedidos enviados por WhatsApp</span></div>
      <div class="kpi"><b>${k.pagados || 0}</b><span>Pagados · cierre ${pct(k.cierre || 0)}</span></div>
      <div class="kpi"><b>${soles(k.ventas)}</b><span>Ventas cobradas</span></div>
      <div class="kpi"><b>${soles(k.ticket)}</b><span>Ticket promedio</span></div>
      <div class="kpi"><b>${(r.porEstado.nuevo || 0)}</b><span>Nuevos sin responder</span></div>
      <div class="kpi"><b>${e.en_curso || 0}</b><span>Entregas en curso</span></div>
      <div class="kpi ${e.atrasados ? "alerta" : ""}"><b>${e.atrasados || 0}</b><span>Atrasados</span></div>
      <div class="kpi"><b>${soles(k.cotizado)}</b><span>Monto pedido (incluye no cerrados)</span></div>
    </div>
    <div class="panel"><h2>Embudo de la web</h2>
      ${f.page_view ? `<div class="embudo">${pasos.map(([n, t], i) => { const v = f[n] || 0, prev = i ? f[pasos[i - 1][0]] || 0 : 0;
        return `<div class="paso"><span>${t}</span><div class="barra"><i style="width:${(v / max) * 100}%"></i></div><em>${v}${i && prev ? ` · ${pct(v / prev)}` : ""}</em></div>`; }).join("")}</div>
      <p class="muted small" style="margin-top:10px">Personas (sesiones) en cada paso. El porcentaje es cuántas pasan del paso anterior: donde baja más, ahí se cae la venta.</p>`
      : `<p class="vacio">Aún no hay visitas registradas en este periodo.</p>`}
    </div>
    <div class="cols">
      <div class="panel"><h2>Cuadros más pedidos</h2>${r.top.length ? `<table class="tabla"><tr><th>Cuadro</th><th class="n">Pedidos</th><th class="n">Vendidos</th></tr>
        ${r.top.map(t => `<tr><td>${esc(nombre(t.s) || t.n)}</td><td class="n">${t.pedidos}</td><td class="n">${t.vendidos || 0}</td></tr>`).join("")}</table>` : `<p class="vacio">Sin pedidos todavía.</p>`}</div>
      <div class="panel"><h2>Cuadros más vistos</h2>${r.vistos.length ? `<table class="tabla"><tr><th>Cuadro</th><th class="n">Vistas</th><th class="n">Personas</th></tr>
        ${r.vistos.map(t => `<tr><td>${esc(nombre(t.s))}</td><td class="n">${t.vistas}</td><td class="n">${t.personas}</td></tr>`).join("")}</table>` : `<p class="vacio">Sin visitas todavía.</p>`}</div>
      <div class="panel"><h2>De dónde vienen los pedidos</h2>${r.fuentes.length ? `<table class="tabla"><tr><th>Fuente</th><th class="n">Pedidos</th><th class="n">Pagados</th><th class="n">Ventas</th></tr>
        ${r.fuentes.map(t => `<tr><td>${esc(t.fuente)}</td><td class="n">${t.pedidos}</td><td class="n">${t.pagados}</td><td class="n">${soles(t.ventas)}</td></tr>`).join("")}</table>` : `<p class="vacio">Sin pedidos todavía.</p>`}</div>
      <div class="panel"><h2>Pedidos por día</h2>${r.serie.length ? `<div class="serie">${r.serie.map(d => `<div title="${esc(d.dia)}: ${d.pedidos} pedidos, ${d.pagados} pagados" style="height:${(d.pedidos / smax) * 100}%"><i style="height:${d.pedidos ? (d.pagados / d.pedidos) * 100 : 0}%"></i></div>`).join("")}</div>
        <p class="muted small" style="margin-top:8px">Gris: pedidos enviados · Verde: pagados</p>` : `<p class="vacio">Sin pedidos todavía.</p>`}</div>
    </div>`, { pedidos: r.porEstado.nuevo || 0 });
  bindRango(vistaResumen);
}

/* ---------- pedidos ---------- */
const FILTROS = [["activos", "Activos"], ...ESTADOS, ["todos", "Todos"]];
async function vistaPedidos() {
  shell("pedidos", `<div class="top"><h1>Pedidos</h1><button class="btn btn--p btn--sm" id="nuevo">+ Pedido manual</button></div>
    <div class="filtros" id="filtros">${FILTROS.map(([k, n]) => `<button class="chip ${k === FILTRO ? "on" : ""}" data-f="${k}">${n}</button>`).join("")}</div>
    <input type="search" id="busca" placeholder="Buscar por código, cliente, teléfono, distrito o cuadro" value="${esc(BUSCA)}" style="margin-bottom:12px">
    <div class="lista" id="lista"><p class="cargando">Cargando…</p></div>`);
  $$("#filtros .chip").forEach(b => b.addEventListener("click", () => { FILTRO = b.dataset.f; vistaPedidos(); }));
  let t; $("#busca").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => { BUSCA = e.target.value; cargarLista(); }, 250); });
  $("#nuevo").addEventListener("click", pedidoManual);
  cargarLista();
}
async function cargarLista() {
  const q = new URLSearchParams({ estado: FILTRO === "todos" ? "" : FILTRO, q: BUSCA });
  const { pedidos } = await api("pedidos?" + q);
  $("#lista").innerHTML = pedidos.length ? pedidos.map(filaPedido).join("") : `<p class="vacio">No hay pedidos ${FILTRO !== "todos" ? "en este estado" : ""}.</p>`;
  $$("#lista [data-cod]").forEach(b => b.addEventListener("click", () => location.hash = "#/pedido/" + b.dataset.cod));
}
function filaPedido(p) {
  const nombres = p.items.map(i => `${i.qty > 1 ? i.qty + "× " : ""}${i.n}`).join(", ");
  const atrasado = ["pagado", "produccion", "listo"].includes(p.estado) && p.fecha_prometida && p.fecha_prometida < hoy();
  return `<button class="ped" data-cod="${esc(p.codigo)}">
    <span class="thumbs">${p.items.slice(0, 3).map(i => `<img src="${thumb(i.s)}" alt="" loading="lazy">`).join("")}</span>
    <span class="det"><span class="cod">${esc(p.codigo)}</span> ${est(p.estado)} ${atrasado ? '<span class="atraso">ATRASADO</span>' : ""}
      <p>${esc(p.cliente ? p.cliente + " · " : "")}${esc(nombres)}</p>
      <small>${hace(p.creado)} · ${esc(p.lugar || "sin distrito")} · ${esc(p.fuente || "directo")}${p.pago ? " · " + esc(p.pago) : ""}</small></span>
    <span class="tot">${soles(p.total_final ?? p.total)}</span><span class="muted small">›</span></button>`;
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
  const d = document.createElement("div"); d.className = "drawer";
  d.innerHTML = `<section role="dialog" aria-modal="true" aria-label="Pedido ${esc(p.codigo)}">
    <header><div><h1>${esc(p.codigo)}</h1><p class="muted small">${hace(p.creado)} · vía ${esc(p.via || "web")} · ${esc(p.fuente || "directo")}${p.campana ? " / " + esc(p.campana) : ""}${p.region ? " · visita desde " + esc(p.region) : ""}</p></div>
      <button class="cerrar" aria-label="Cerrar">×</button></header>
    <h3>Estado</h3>
    <div class="pasos" id="pasos">${ESTADOS.map(([k, n]) => `<button data-e="${k}" class="${k === p.estado ? "on" : ""}">${n}</button>`).join("")}</div>
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
      <div class="guardar"><button class="btn btn--p">Guardar cambios</button>${tel ? `<a class="btn btn--wa" target="_blank" rel="noopener" href="https://wa.me/${telWa}">WhatsApp del cliente</a>` : ""}</div>
    </form>
    ${tel ? `<div class="sec"><h3>Mensajes rápidos por WhatsApp</h3><div class="wa-plantillas">${PLANTILLAS.map(([n, f], i) => `<a class="btn btn--sm" target="_blank" rel="noopener" href="https://wa.me/${telWa}?text=${encodeURIComponent(f(p))}">${n}</a>`).join("")}</div></div>`
      : `<p class="muted small sec">Escribe el celular del cliente para enviarle mensajes rápidos (confirmación, pago, en camino…).</p>`}
    <div class="sec"><h3>Historial</h3><div class="hist">${historial.map(h => `<div><time>${esc(h.fecha)} UTC · ${esc(h.usuario || "")}</time>${esc(h.accion)}</div>`).join("")}</div></div>
  </section>`;
  document.body.append(d);
  const cerrar = () => { d.remove(); if (location.hash.startsWith("#/pedido/")) history.back(); };
  d.addEventListener("click", e => { if (e.target === d || e.target.closest(".cerrar")) cerrar(); });
  document.addEventListener("keydown", function k(e) { if (e.key === "Escape") { document.removeEventListener("keydown", k); cerrar(); } });
  $$("#pasos button", d).forEach(b => b.addEventListener("click", async () => {
    await api("pedidos/" + p.codigo, { method: "PATCH", body: { estado: b.dataset.e } });
    toast(`${p.codigo}: ${EN[b.dataset.e]}`); d.remove(); vistaPedido(p.codigo); if ($("#lista")) cargarLista();
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
  shell("entregas", `<p class="cargando">Cargando…</p>`);
  const { pedidos } = await api("pedidos?estado=entregas&limite=200");
  const atr = p => p.fecha_prometida && p.fecha_prometida < hoy() && p.estado !== "enviado";
  const grupos = [["Atrasados", pedidos.filter(atr)], ["Por producir", pedidos.filter(p => ["pagado", "produccion"].includes(p.estado) && !atr(p))],
    ["Listos para enviar", pedidos.filter(p => p.estado === "listo" && !atr(p))], ["En camino", pedidos.filter(p => p.estado === "enviado")]];
  const sig = { pagado: "produccion", produccion: "listo", listo: "enviado", enviado: "entregado" };
  shell("entregas", `<div class="top"><h1>Entregas</h1><p class="muted small">Ordenado por fecha prometida</p></div>
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

/* ---------- próximamente ---------- */
const PRONTO = {
  marketing: ["Marketing", "Campañas, fuentes, productos más vistos frente a más vendidos, búsquedas sin resultado y conversión por colección. El resumen ya muestra el embudo y las fuentes; aquí irá el detalle."],
  productos: ["Productos", "Crear, editar y ocultar cuadros, cambiar precios y subir imágenes, con un botón «Publicar» que actualiza la web."],
  generador: ["Generador de productos", "Escribe una idea y la IA crea la imagen y propone nombre, frase y colección. La revisas en el marco y en la pared antes de publicar."],
};
function vistaPronto(k) { const [t, d] = PRONTO[k]; shell(k, `<div class="top"><h1>${t}</h1></div><div class="pronto"><h2>Próximamente</h2><p>${d}</p></div>`); }

/* ---------- ajustes ---------- */
async function vistaAjustes() {
  const { usuarios } = await api("usuarios");
  shell("ajustes", `<div class="top"><h1>Ajustes</h1><button class="btn btn--sm" id="salir">Cerrar sesión</button></div>
    <div class="cols"><div class="panel"><h2>Equipo con acceso</h2>
      <table class="tabla">${usuarios.map(u => `<tr><td>${esc(u.nombre || "")}<br><span class="muted small">${esc(u.email)} · ${esc(u.rol)}</span></td>
        <td class="n">${u.email !== YO.email && YO.rol === "admin" ? `<button class="btn btn--sm" data-del="${esc(u.email)}">Quitar</button>` : ""}</td></tr>`).join("")}</table>
      ${YO.rol === "admin" ? `<form id="fu" style="display:grid;gap:8px;margin-top:14px"><div class="grid2"><input name="nombre" placeholder="Nombre" required><input name="email" type="email" placeholder="correo@ejemplo.com" required></div>
        <select name="rol"><option value="equipo">Equipo (pedidos y entregas)</option><option value="admin">Administrador</option></select>
        <button class="btn btn--p">Dar acceso</button><p class="muted small" id="tmp"></p></form>` : ""}</div>
      <div class="panel"><h2>Cambiar mi contraseña</h2><form id="fc" style="display:grid;gap:8px">
        <input name="actual" type="password" placeholder="Contraseña actual" required autocomplete="current-password">
        <input name="nueva" type="password" placeholder="Nueva (mínimo 10 caracteres)" minlength="10" required autocomplete="new-password">
        <button class="btn btn--p">Cambiar</button></form></div></div>`);
  $("#salir").addEventListener("click", async () => { await api("logout", { method: "POST" }); YO = null; render(); });
  $$("[data-del]").forEach(b => b.addEventListener("click", async () => { if (confirm("¿Quitar el acceso de " + b.dataset.del + "?")) { await api("usuarios/" + encodeURIComponent(b.dataset.del), { method: "DELETE" }); vistaAjustes(); } }));
  $("#fu")?.addEventListener("submit", async e => {
    e.preventDefault();
    try { const r = await api("usuarios", { method: "POST", body: Object.fromEntries(new FormData(e.target)) });
      $("#tmp").textContent = `Listo. Contraseña temporal: ${r.temporal} — pásasela y que la cambie en Ajustes.`; }
    catch (er) { toast(er.message); }
  });
  $("#fc").addEventListener("submit", async e => { e.preventDefault(); try { await api("clave", { method: "POST", body: Object.fromEntries(new FormData(e.target)) }); toast("Contraseña cambiada"); e.target.reset(); } catch (er) { toast(er.message); } });
}

/* ---------- rutas ---------- */
async function render() {
  if (!YO) return arrancar();
  const [, sec, arg] = location.hash.split("/");
  try {
    if (sec === "pedido" && arg) return vistaPedido(arg);
    if (sec === "pedidos") return vistaPedidos();
    if (sec === "entregas") return vistaEntregas();
    if (sec === "ajustes") return vistaAjustes();
    if (PRONTO[sec]) return vistaPronto(sec);
    return vistaResumen();
  } catch (e) { if (YO) app.innerHTML = `<p class="cargando">${esc(e.message)}</p>`; }
}
async function arrancar() {
  try {
    const r = await fetch("/api/admin/estado", { credentials: "same-origin" }).then(r => r.json());
    if (!r.ok) { app.innerHTML = `<p class="cargando">El panel aún no está conectado a la base de datos (${esc(r.error || "")}).</p>`; return; }
    if (r.necesitaSetup) return vistaIngreso(true);
    if (!r.usuario) return vistaIngreso(false);
    YO = r.usuario; render();
  } catch { app.innerHTML = `<p class="cargando">No se pudo conectar con el servidor.</p>`; }
}
addEventListener("hashchange", () => { if (!location.hash.startsWith("#/pedido/")) $$(".drawer").forEach(d => d.remove()); render(); });
arrancar();
