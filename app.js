/* =========================================================
   Cuadros Finos — interacción del sitio
   Los datos (precios, WhatsApp, colecciones, cuadros) vienen de data.js,
   que genera tools/build.py desde data/catalogo.json.
   ========================================================= */
(() => {
"use strict";
const CAT = window.CATALOGO;
const CONFIG = CAT.config;
const P = CONFIG.precio;
const COLECCIONES = CAT.colecciones;
const VIRTUALES = CAT.virtuales;
const VFILTRO = { top: x => x.t, nuevos: x => x.nw, personalizados: x => x.p };
const PAGE = document.body.dataset.page || "home";

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soles = n => "S/ " + n.toLocaleString("es-PE");
const purl = x => `/cuadro/${x.s}/`;
const absUrl = x => location.origin + purl(x);
const waLink = (msg, num = CONFIG.whatsapp) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let toastT;
function toast(msg, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button type="button">${esc(action.label)}</button>` : "");
  if (action) t.querySelector("button").onclick = () => { t.classList.remove("is-on"); action.fn(); };
  t.classList.add("is-on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 3600);
}

/* ---------- datos ---------- */
const DATA = CAT.productos.map((x, i) => ({ ...x, idx: i }));
const BY = Object.fromEntries(DATA.map(x => [x.s, x]));
const colDe = id => COLECCIONES.find(c => c.id === id);
const subNombre = x => ((colDe(x.c)?.subs || []).find(s => s[0] === x.u) || [])[1] || "";
const piezas = x => x.o === "triptico" ? 3 : x.o === "diptico" ? 2 : 1;
const esH = x => x.o === "horizontal" || x.o === "panoramico";
const precioBase = x => x.q ? null : x.pr ? x.pr : x.o === "triptico" ? P.triptico : x.o === "diptico" ? P.diptico : P.pieza;
// Imagen de un cuadro: las del panel viven en /media/<slug>/, las de la web en /img/cuadros/
const imgSrc = (x, { thumb = false, panel = 0 } = {}) => x.m
  ? `/media/${x.s}/${thumb ? "t" : "obra"}${panel ? "-" + panel : ""}.webp?v=${encodeURIComponent(x.m)}`
  : `/img/cuadros/${thumb ? "t/" : ""}${x.s}${panel ? "-" + panel : ""}.webp`;
const medida = x => x.o === "triptico" ? "Tríptico 3 × (30 × 37 cm) con marco" : x.o === "diptico" ? "Díptico 2 × (30 × 37 cm) con marco" : esH(x) ? "37 × 30 cm con marco (horizontal)" : "30 × 37 cm con marco";
const AMBS = CAT.ambientes, PERS = VIRTUALES.find(v => v.id === "personalizados") || {};
const subClaves = x => (colDe(x.c)?.subClaves || {})[x.u] || "";
// Texto donde se busca: nombre (pesa más), colección, subtema, palabras clave del tema y del ambiente
DATA.forEach(x => {
  x._n = norm(x.n);
  x._q = norm([x.n, x.f, colDe(x.c)?.nombre, colDe(x.c)?.claves, subNombre(x), subClaves(x),
    x.a.map(a => (AMBS.find(m => m.id === a) || {}).claves || a).join(" "), x.p ? "personalizado " + (PERS.claves || "") : "", x.o].join(" "));
});
// cuadros «Nuevo» creados/editados desde el panel: el más reciente primero (x.m = fecha de la imagen en base 36)
const fresco = x => x.nw && x.m ? parseInt(x.m, 36) || 0 : 0;
const rank = x => (x.t ? 0 : 10) + (x.nw ? 0 : 3) + (x.i ? 0 : 20) + (x.c === "papa" ? 15 : 0) + (fresco(x) ? -0.5 : x.idx / 100);
// Búsqueda: cada palabra debe coincidir con el comienzo de una palabra del cuadro (leones → león, abogados → abogado)
const VACIAS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "o", "para", "con", "en", "un", "una", "mi", "cuadro", "cuadros"]);
const tokens = q => norm(q).replace(/[^a-z0-9ñ ]/g, " ").split(/\s+/).filter(t => t && !VACIAS.has(t));
const variantes = t => [...new Set([t, t.length > 4 ? t.replace(/es$/, "") : t, t.length > 3 ? t.replace(/s$/, "") : t])];
const tokHit = (txt, t) => variantes(t).some(v => v.length <= 2 ? new RegExp(`(^|[^a-z0-9ñ])${v}([^a-z0-9ñ]|$)`).test(txt) : new RegExp(`(^|[^a-z0-9ñ])${v}`).test(txt));
const matches = (x, q) => { const ts = tokens(q); return ts.length ? ts.every(t => tokHit(x._q, t)) : true; };
const relevancia = (x, q) => tokens(q).reduce((a, t) => a + (tokHit(x._n, t) ? 3 : 0), 0);

/* ---------- medición (medicion.js) ---------- */
const T = (name, params) => { try { window.CFTrack && CFTrack.track(name, params); } catch {} };
const LISTA = document.body.dataset.col || document.body.dataset.room || (PAGE === "home" ? "inicio" : PAGE);
const item = (x, extra = {}) => ({ item_id: x.s, item_name: x.n, item_brand: CONFIG.marca, item_category: (colDe(x.c) || {}).nombre || x.c,
  item_category2: subNombre(x) || undefined, item_variant: x.o, price: x.q ? 0 : precioBase(x) + (x.p ? P.personalizar : 0), quantity: 1, ...extra });
const once = new Set(); const T1 = (key, name, params) => { if (once.has(key)) return; once.add(key); T(name, params); };

/* ---------- fecha estimada de llegada (días hábiles de C.entrega) ---------- */
function habiles(n, d = new Date()) { d = new Date(d); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() % 6) n--; } return d; }
const diaTxt = d => d.toLocaleDateString("es-PE", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "").replace(",", "");
function eta() { const [a, b] = (CONFIG.entrega.match(/(\d+)\s*a\s*(\d+)/) || [0, 4, 6]).slice(1).map(Number); return `entre el ${diaTxt(habiles(a))} y el ${diaTxt(habiles(b))}`; }

/* ---------- render ---------- */
function pf(x, { lazy = true, thumb = false, scene = false } = {}) {
  const ld = lazy ? ' loading="lazy" decoding="async"' : "";
  const n = piezas(x);
  if (n > 1) {
    const inner = Array.from({ length: n }, (_, i) =>
      `<span class="pf"><img src="${imgSrc(x, { thumb, panel: i + 1 })}" alt="${esc(x.n)} (panel ${i + 1})"${ld}></span>`).join("");
    return scene ? inner : `<span class="set">${inner}</span>`;
  }
  const cls = "pf" + (esH(x) ? " pf--h" : "");
  if (!x.i) return `<span class="${cls}"><span class="ph"><b>${esc(x.n)}</b><i>Vista previa<br>por WhatsApp</i></span></span>`;
  return `<span class="${cls}"><img src="${imgSrc(x, { thumb })}" alt="${esc(x.n)} — cuadro con marco negro"${ld}></span>`;
}
const nombreHtml = n => n.length <= 22 || !n.includes(" · ") ? esc(n) : (([a, ...b]) => `${esc(a)}<span class="t-sub"><span class="sr"> · </span>${esc(b.join(" · "))}</span>`)(n.split(" · "));
const precioTxt = x => x.q ? "Cotizar" : (x.p ? "Desde " : "") + soles(precioBase(x));
function card(x, { mini = false, add: conAdd = !mini } = {}) {
  const tag = x.t ? '<span class="tag">Más pedido</span>' : x.nw ? '<span class="tag tag--ghost">Nuevo</span>' : x.p ? '<span class="tag tag--ghost">Personalizable</span>' : "";
  const inBag = bag.some(b => b.s === x.s);
  const add = x.q || !conAdd ? "" : `<button class="card__add${inBag ? " is-in" : ""}" data-add="${x.s}" aria-label="${inBag ? "Ya está en tu selección" : "Agregar a mi selección"}: ${esc(x.n)}">${inBag ? "✓" : "+"}</button>`;
  return `<article class="card${mini ? "" : " rv"}" data-s="${x.s}"><div class="card__stage">${tag}${pf(x, { thumb: true })}${add}</div>` +
    `<h3>${nombreHtml(x.n)}</h3>${mini ? "" : `<p>${esc(x.f)}</p>`}<span class="card__price">${precioTxt(x)}</span>` +
    `<a class="card__open" href="${purl(x)}" aria-label="Ver ${esc(x.n)}"></a></article>`;
}

function viewsHtml(x) {
  const obra = imgSrc(x, { thumb: true, panel: piezas(x) > 1 ? 1 : 0 });
  const fotos = [...(x.fotos || []), ...(x.i && !x.m ? [[`detalle-${x.s}`, "El marco negro de cerca"]] : [])];
  return `<button class="view is-on" role="tab" id="tabObra" aria-selected="true" aria-controls="pStage" data-tab="obra">${x.i ? `<img src="${obra}" alt="" loading="lazy">` : '<span class="view__ph"></span>'}<span>Obra</span></button>` +
    `<button class="view" role="tab" id="tabPared" aria-selected="false" aria-controls="pWall" data-tab="pared"><img src="/img/ambiente/t/${PAREDES[roomFor(x)].img}.webp" alt="" loading="lazy"><span>En tu pared</span></button>` +
    `<button class="view view--3d" role="tab" aria-selected="false" aria-controls="p3d" data-tab="3d"><span class="view__3d" aria-hidden="true">3D</span><span>3D · AR</span></button>` +
    fotos.map(([f, alt]) => `<button class="view" role="tab" aria-selected="false" aria-controls="pPhoto" data-tab="foto" data-src="/img/ambiente/${f}.webp" data-alt="${esc(alt)}"><img src="/img/ambiente/t/${f}.webp" alt="" loading="lazy"><span class="sr">${esc(alt)}</span></button>`).join("");
}

/* ---------- aparición suave ---------- */
const io = !reduced && "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { rootMargin: "0px 0px -40px" }) : null;
function reveal(root = document) {
  $$(".rv:not(.in)", root).forEach((el, i) => {
    if (!io) return el.classList.add("in");
    el.style.transitionDelay = `${(i % 4) * 60}ms`; io.observe(el);
  });
}

/* ---------- catálogo ---------- */
const hasCatalog = !!$("#grid");
const F = { col: document.body.dataset.col || "", sub: "", q: "", room: document.body.dataset.room || "", sort: "" };
const LIM0 = Number($("#catalogo")?.dataset.limite) || 24; let lim = LIM0;
const F0 = { ...F };

const pasa = (x, f) => { const vf = VFILTRO[f.col];
  return (!f.col || (vf ? vf(x) : x.c === f.col)) && (!f.sub || x.u === f.sub) && (!f.room || x.a.includes(f.room)) && (!f.q || matches(x, f.q)); };
function filtered() {
  let list = DATA.filter(x => pasa(x, F));
  if (F.q && !F.sort) list.sort((a, b) => relevancia(b, F.q) - relevancia(a, F.q) || rank(a) - rank(b));
  else if (F.sort === "az") list.sort((a, b) => a.n.localeCompare(b.n, "es"));
  else if (F.sort === "nuevo") list.sort((a, b) => (b.nw ? 1 : 0) - (a.nw ? 1 : 0) || fresco(b) - fresco(a) || rank(a) - rank(b));
  else if (F.sort === "precio") list.sort((a, b) => (precioBase(a) ?? 1e9) - (precioBase(b) ?? 1e9) || rank(a) - rank(b));
  else if (F.col === "nuevos") list.sort((a, b) => fresco(b) - fresco(a) || rank(a) - rank(b));
  else list.sort((a, b) => rank(a) - rank(b) || fresco(b) - fresco(a));
  return list;
}
function renderFilters() {
  $$("#colFilters [data-col]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.col === F.col)));
  const c = colDe(F.col);
  $("#subFilters").innerHTML = c && c.subs.length > 1 ? [["", "Todo " + c.nombre], ...c.subs].map(([id, n]) =>
    `<button class="chip${F.sub === id ? " is-on" : ""}" data-sub="${id}" aria-pressed="${F.sub === id}">${esc(n)}</button>`).join("") : "";
  $$("#roomFilters [data-room]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.room === F.room)));
  // Conteos en vivo: cuántos quedan si tocas ese tema o ese ambiente (con lo demás que ya elegiste)
  $$("#colFilters [data-col]").forEach(b => { const n = DATA.filter(x => pasa(x, { ...F, col: b.dataset.col, sub: "" })).length;
    $("small", b).textContent = n; b.classList.toggle("is-zero", !n && b.dataset.col !== F.col); });
  $$("#roomFilters [data-room]").forEach(b => { const n = DATA.filter(x => pasa(x, { ...F, room: b.dataset.room })).length;
    $("small", b).textContent = n; b.classList.toggle("is-zero", !n && b.dataset.room !== F.room); });
  $("#sort").value = F.sort;
  if ($("#q").value !== F.q) $("#q").value = F.q;
  $("#resetFilters").hidden = !(F.q || F.sub || F.col !== F0.col || F.room !== F0.room || (PAGE === "home" && (F.col || F.room)));
}
function renderGrid() {
  const list = filtered();
  $("#grid").innerHTML = list.slice(0, lim).map(x => card(x)).join("");
  const resto = list.length - Math.min(lim, list.length);
  $("#more").hidden = resto <= 0; $("#moreN").textContent = `quedan ${resto}`;
  $("#empty").hidden = list.length > 0;
  $("#emptyQ").textContent = F.q ? `“${F.q}”` : "cuadros con esos filtros";
  $("#count").textContent = list.length === DATA.length ? `${list.length} cuadros` : `${list.length} de ${DATA.length} cuadros`;
  reveal($("#grid"));
  T("view_item_list", { item_list_id: F.col || F.room || "todos", item_list_name: listaNombre(), items: list.slice(0, 20).map((x, i) => item(x, { index: i })) });
}
function syncUrl() {
  if (PAGE !== "home") return;
  const u = new URL(location.href);
  [["q", F.q], ["c", F.col], ["sub", F.sub], ["amb", F.room]].forEach(([k, v]) => v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}
const listaNombre = () => [F.col && ((colDe(F.col) || VIRTUALES.find(v => v.id === F.col) || {}).nombre || F.col), F.room && "Ambiente " + F.room, F.q && "Búsqueda"].filter(Boolean).join(" · ") || "Todos los cuadros";
function setFilter(patch, scroll) {
  if (patch.col !== undefined || patch.room !== undefined || patch.sub !== undefined || patch.sort !== undefined)
    T("filtrar", { coleccion: patch.col ?? F.col, subcoleccion: patch.sub ?? F.sub, ambiente: patch.room ?? F.room, orden: patch.sort ?? F.sort });
  if (patch.q && patch.q.length >= 3) { clearTimeout(window.__tq); window.__tq = setTimeout(() => T("search", { search_term: patch.q, resultados: filtered().length }), 1200); }
  if (patch.col !== undefined || patch.sub !== undefined || patch.room !== undefined || patch.q !== undefined) lim = LIM0;
  Object.assign(F, patch);
  renderFilters(); renderGrid(); syncUrl();
  if (scroll) $("#catalogo").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}
function bindCatalog() {
  if (!hasCatalog) return;
  const params = new URLSearchParams(location.search);
  if (PAGE === "home") Object.assign(F, { q: params.get("q") || "", col: params.get("c") || "", room: params.get("amb") || "" });
  if (params.get("sub") && (colDe(F.col)?.subs || []).some(s => s[0] === params.get("sub"))) F.sub = params.get("sub");
  $("#colFilters").addEventListener("click", e => { const b = e.target.closest("[data-col]"); if (b) setFilter({ col: b.dataset.col, sub: "" }); });
  $("#colFilters").addEventListener("keydown", e => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const tabs = $$("#colFilters [data-col]"); const i = tabs.indexOf(document.activeElement);
    if (i < 0) return; e.preventDefault();
    tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].focus();
  });
  $("#subFilters").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b) setFilter({ sub: b.dataset.sub }); });
  let t; $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => setFilter({ q: e.target.value.trim() }), 140); });
  $("#roomFilters").addEventListener("click", e => { const b = e.target.closest("[data-room]"); if (b) setFilter({ room: b.dataset.room }); });
  $("#resetFilters").addEventListener("click", () => setFilter({ col: PAGE === "home" ? "" : F0.col, sub: "", q: "", room: PAGE === "home" ? "" : F0.room }));
  $("#more").addEventListener("click", () => { const desde = lim; lim += LIM0 * 2; renderGrid(); $$("#grid .card")[desde]?.querySelector(".card__open")?.focus({ preventScroll: true }); T("ver_mas", { lista: listaNombre(), mostrados: lim }); });
  $("#sort").addEventListener("change", e => setFilter({ sort: e.target.value }));
  $("#clearFilters").addEventListener("click", () => setFilter({ col: "", sub: "", q: "", room: "" }));
  const changed = F.q || F.sub || F.col !== F0.col || F.room !== F0.room;
  renderFilters();
  // Con cuadros del panel, los contadores fijos del HTML se actualizan
  if (CAT.panel) {
    $$("#colFilters [data-col]").forEach(b => { const k = b.dataset.col, sm = $("small", b); if (!sm) return;
      sm.textContent = DATA.filter(x => !k || (VFILTRO[k] ? VFILTRO[k](x) : x.c === k)).length; });
    $$('a[href="#catalogo"]').forEach(a => { a.textContent = a.textContent.replace(/\d+ cuadros/, DATA.length + " cuadros"); });
  }
  // Al volver con «Atrás» se recupera la posición exacta (el catálogo se vuelve a armar)
  const navEntry = performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  const key = "cf_scroll:" + location.pathname + location.search;
  let saved = null; try { saved = sessionStorage.getItem(key); } catch {}
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  addEventListener("pagehide", () => { try { sessionStorage.setItem("cf_scroll:" + location.pathname + location.search, String(scrollY)); sessionStorage.setItem("cf_lim:" + location.pathname + location.search, String(lim)); } catch {} });
  const volviendo = navEntry && navEntry.type === "back_forward" && saved !== null;
  if (volviendo) { try { lim = Math.max(LIM0, Number(sessionStorage.getItem(key.replace("cf_scroll:", "cf_lim:"))) || LIM0); } catch {} }
  if (changed || CAT.panel || lim !== LIM0) renderGrid(); else reveal($("#grid"));
  if (volviendo) {
    $$("#grid .rv").forEach(el => el.classList.add("in"));
    requestAnimationFrame(() => scrollTo({ top: Number(saved), behavior: "instant" }));
  } else if (changed && (F.q || F.col || F.room) && PAGE === "home") setTimeout(() => $("#catalogo").scrollIntoView(), 50);
}

/* ---------- ficha del cuadro (diálogo o página) ---------- */
const dlg = $("#product");
const inline = PAGE === "product";
const dinamico = inline && !!document.body.dataset.dinamico;
const S = { x: null, room: "sala", tab: "obra", pushed: false, prevUrl: null, prevTitle: document.title };
const PAREDES = CAT.paredes;
const roomFor = x => x.a.find(a => PAREDES[a]) || (x.a.includes("oficina") ? "estudio" : "sala");

function openProduct(slug, tab, { push = true } = {}) {
  const x = BY[slug]; if (!x) return false;
  if (!inline && !dlg) { location.href = purl(x); return true; }
  S.x = x;
  const c = colDe(x.c);
  $("#pCol").textContent = `Colección ${c.nombre}${subNombre(x) && c.subs.length > 1 ? " · " + subNombre(x) : ""}`;
  $("#pTitle").innerHTML = nombreHtml(x.n);
  $("#pPhrase").textContent = x.f;
  if (!inline || dinamico) {
    $("#pStage").innerHTML = pf(x, { lazy: false });
    $("#pSceneArt").innerHTML = pf(x, { lazy: false, scene: true });
    $("#pFieldList").innerHTML = (x.k || []).map(([label, ph], i) =>
      `<label class="field"><span>${esc(label)}</span><input name="f${i}" data-label="${esc(label)}" placeholder="${esc(ph)}"${/opcional/i.test(label) ? "" : " required"}></label>`).join("");
    const rel = DATA.filter(y => y.c === x.c && y.s !== x.s && y.i).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
    if ($("#pRelated")) $("#pRelated").innerHTML = rel.map(y => card(y, { mini: true })).join("");
    if ($("#pPage")) $("#pPage").href = purl(x);
    $("#pViews").innerHTML = viewsHtml(x);
  }
  $("#pMeasure").textContent = x.o === "triptico" ? "≈ 98 cm de ancho" : x.o === "diptico" ? "≈ 64 cm de ancho" : esH(x) ? "37 × 30 cm" : "30 × 37 cm";
  $("#pSize").textContent = medida(x);
  $("#pRooms").textContent = x.a.map(r => r[0].toUpperCase() + r.slice(1)).join(", ");
  $("#pFields").hidden = !x.p;
  restoreFields();
  livePreview();
  if (x.q) {
    $("#pPrice").textContent = "Cotiza por WhatsApp";
    $("#pPriceNote").textContent = "Recuerdo de la visita del Papa: precio a consultar.";
    $("#pAdd").hidden = true; $("#pWa").textContent = "Cotizar por WhatsApp";
  } else {
    $("#pPrice").textContent = soles(precioBase(x) + (x.p ? P.personalizar : 0));
    $("#pPriceNote").textContent = x.p ? `Incluye personalización (+ ${soles(P.personalizar)}). Marco negro y envío gratis.` : `${medida(x)}. Listo para colgar.`;
    $("#pAdd").hidden = false; $("#pWa").textContent = "Pedir este por WhatsApp";
  }
  updateProductWa(); refreshAddBtn();
  if ($("#pPack")) { $("#pPack").hidden = !enPack(x); $("#pPack").innerHTML = `<b>${packTxt()}</b> · combinando los cuadros que quieras`; }
  if ($("#pEta")) $("#pEta").innerHTML = `<b>Pide hoy y llega ${eta()}</b> en Lima · envío gratis a todo el Perú`;
  if (window.requestIdleCallback) requestIdleCallback(preloadWalls, { timeout: 2500 }); else setTimeout(preloadWalls, 1200);
  S.room = roomFor(x);
  setTab(tab || "obra"); renderScene();
  if (!inline) {
    const wasOpen = dlg.open;
    if (!wasOpen) {
      S.prevUrl = location.pathname + location.search + location.hash; S.prevTitle = document.title;
      dlg.showModal();
    }
    dlg.scrollTop = 0;
    if (push && location.pathname !== purl(x)) {
      if (wasOpen && location.pathname.startsWith("/cuadro/")) history.replaceState({ cuadro: x.s }, "", purl(x));
      else { history.pushState({ cuadro: x.s }, "", purl(x)); S.pushed = true; }
    }
    document.title = `${x.n} · Cuadro con marco | ${CONFIG.marca}`;
  }
  recordView(x.s);
  T("view_item", { currency: "PEN", value: item(x).price, items: [item(x)] });
  return true;
}
function closeProduct() {
  if (!dlg || !dlg.open) return;
  dlg.close();
}
function onDialogClosed() {
  document.title = S.prevTitle;
  if (location.pathname.startsWith("/cuadro/")) {
    if (S.pushed && history.state && history.state.cuadro) { S.pushed = false; history.back(); }
    else history.replaceState(null, "", S.prevUrl || "/");
  }
  S.pushed = false;
}
const fieldKey = () => "cf_fields_" + S.x.s;
function fieldValues() { return $$("#pFieldList input").map(i => [i.dataset.label, i.value.trim()]); }
function restoreFields() {
  const saved = store.get(fieldKey(), {});
  $$("#pFieldList input").forEach(i => { if (saved[i.name]) i.value = saved[i.name]; });
}
function productMsg(code = "") {
  const x = S.x;
  if (x.q) return `Hola, quiero cotizar el cuadro «${x.n}» (Papa León XIV).\n${absUrl(x)}` + (code ? `\nCódigo: ${code}` : "");
  const f = x.p ? fieldValues().filter(([, v]) => v).map(([l, v]) => `  · ${l}: ${v}`).join("\n") : "";
  return `Hola, quiero pedir este cuadro:\n• ${x.n} — ${medida(x)} — ${$("#pPrice").textContent}` + (f ? `\n${f}` : "") + `\n${absUrl(x)}` + (code ? `\nCódigo: ${code}` : "") + `\n\n¿Me confirman el envío a mi dirección?`;
}
function updateProductWa() { $("#pWa").href = waLink(productMsg(), S.x.q ? CONFIG.whatsappPapa : CONFIG.whatsapp); }
function refreshAddBtn() {
  const n = bag.filter(b => b.s === S.x.s).reduce((a, b) => a + b.qty, 0);
  $("#pAdd").textContent = n && !S.x.p ? `En tu selección (${n}) · Agregar otro` : "Agregar a mi selección";
  const bb = $("#bbAdd"); if (bb) { bb.textContent = n && !S.x.p ? "✓" : "+"; bb.classList.toggle("is-in", !!n); }
}
function setTab(t, btn) {
  S.tab = t;
  const views = $$("#pViews .view");
  btn = btn || views.find(v => v.dataset.tab === t) || views[0];
  views.forEach(v => { const on = v === btn; v.classList.toggle("is-on", on); v.setAttribute("aria-selected", String(on)); v.tabIndex = on ? 0 : -1; });
  $("#pStage").hidden = t !== "obra";
  $("#pWall").hidden = t !== "pared";
  if (t === "pared") preloadWalls();
  $("#pPhoto").hidden = t !== "foto";
  if (S.x && t !== "obra") T1(t + S.x.s + (btn && btn.dataset.src || ""), "ver_" + t, { item_id: S.x.s, item_name: S.x.n, ...(t === "foto" ? { foto: (btn && btn.dataset.alt) || "" } : {}) });
  $("#p3d").hidden = t !== "3d";
  if (t === "3d") open3D();
  if (t === "foto") {
    const img = $("#pPhotoImg");
    img.src = btn.dataset.src; img.alt = btn.dataset.alt;
    $("#pPhotoCap").textContent = btn.dataset.alt;
  }
  $("#pZoom").hidden = t === "pared" || t === "3d" || (t === "obra" && !(S.x && (S.x.i || personal(S.x))));
}
function zoomSrc() {
  if (S.tab === "foto") return [$("#pPhotoImg").src, $("#pPhotoImg").alt];
  if (personal(S.x)) return ["", S.x.n, $("#pStage .pf").innerHTML];
  const x = S.x; return [imgSrc(x, { panel: piezas(x) > 1 ? 1 : 0 }), x.n];
}
function openZoom([src, alt, html]) {
  if (S.x) T("zoom", { item_id: S.x.s });
  const z = $("#zoom"), img = $("#zoomImg"), st = $("#zoomStage");
  $("#zoomSvg")?.remove();
  img.hidden = !!html;
  if (html) st.insertAdjacentHTML("beforeend", `<div class="zoom__svg" id="zoomSvg" role="img" aria-label="${esc(alt)}">${html}</div>`);
  else { img.src = src; img.alt = alt; }
  z.classList.remove("is-z");
  z.showModal();
}
/* Vista previa en vivo de los personalizados */
const personal = x => !!(x && window.CFPersonal && CFPersonal.tiene(x.s));
function livePreview() {
  const x = S.x; if (!personal(x)) return;
  const vals = $$("#pFieldList input").map(i => i.value.trim());
  const draw = el => { if (el) { el.classList.remove("pf--h"); el.innerHTML = CFPersonal.svg(x.s, vals); } };
  draw($("#pStage .pf")); draw($("#pSceneArt .pf"));
  const nota = CFPersonal.nota(x.s);
  $("#pPersNote").textContent = (nota ? nota + " " : "") + "Te mandamos la final por WhatsApp antes de imprimir.";
}
/* ---------- 3D y realidad aumentada (model-viewer, se carga solo al usarlo) ---------- */
const MV_SRC = "/vendor/model-viewer-4.3.1.min.js";
let mvLoading = null;
const loadMV = () => mvLoading || (mvLoading = new Promise((ok, ko) => {
  if (customElements.get("model-viewer")) return ok();
  const sc = document.createElement("script"); sc.type = "module"; sc.src = MV_SRC;
  sc.onload = () => customElements.whenDefined("model-viewer").then(ok); sc.onerror = ko;
  document.head.append(sc);
}));
// Recorta la imagen a la ventana del marco (26,5 × 34,4) y la devuelve como dataURL
function artTexture(src, horizontal, svgMarkup) {
  return new Promise((ok, ko) => {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => {
      const ar = horizontal ? 1 / 0.772 : 0.772, W = horizontal ? 1400 : 1080, H = Math.round(W / ar);
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const g = c.getContext("2d"), s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
      ok(c.toDataURL("image/jpeg", .9));
    };
    img.onerror = ko;
    img.src = svgMarkup ? URL.createObjectURL(new Blob([svgMarkup.replace("<svg ", '<svg width="900" height="1170" ')], { type: "image/svg+xml" })) : src;
  });
}
let mvFor = null;
async function open3D() {
  const x = S.x, wrap = $("#mvWrap");
  if (mvFor === x.s + "|" + (personal(x) ? $$("#pFieldList input").map(i => i.value).join("|") : "")) return;
  mvFor = x.s + "|" + (personal(x) ? $$("#pFieldList input").map(i => i.value).join("|") : "");
  try { await loadMV(); } catch { wrap.innerHTML = '<p class="mv-loading">No se pudo cargar el visor 3D.</p>'; return; }
  const n = piezas(x), h = esH(x) && n === 1;
  const glb = n === 3 ? "marco-3" : n === 2 ? "marco-2" : h ? "marco-h" : "marco-v";
  let mv = $("#mv");
  if (!mv) {
    wrap.innerHTML = `<model-viewer id="mv" ar ar-modes="webxr scene-viewer quick-look" ar-placement="wall" ar-scale="fixed"
      camera-controls touch-action="pan-y" shadow-intensity="1.1" shadow-softness=".8" exposure="1.05" environment-image="neutral"
      camera-orbit="18deg 82deg 118%" min-camera-orbit="auto auto auto" interaction-prompt="auto" interpolation-decay="120">
      <button slot="ar-button" class="btn btn--light ar-btn">Ver en mi pared</button>
      <div slot="progress-bar"></div></model-viewer>`;
    mv = $("#mv");
    mv.addEventListener("ar-status", e => { if (e.detail.status === "session-started") T("realidad_aumentada", { item_id: S.x.s, item_name: S.x.n }); if (e.detail.status === "failed") toast("Tu celular no permitió abrir la cámara para la realidad aumentada"); });
  }
  mv.alt = `${x.n}: cuadro con marco negro en 3D`;
  const apply = async () => {
    const mats = mv.model ? mv.model.materials : [];
    for (let i = 0; i < n; i++) {
      const mat = mats.find(m => m.name === "obra" + (i + 1)); if (!mat) continue;
      let url;
      if (personal(x)) url = await artTexture(null, false, CFPersonal.svg(x.s, $$("#pFieldList input").map(v => v.value.trim())));
      else if (!x.i) continue;
      else url = await artTexture(imgSrc(x, { panel: n > 1 ? i + 1 : 0 }), h);
      const tex = await mv.createTexture(url);
      mat.pbrMetallicRoughness.baseColorTexture.setTexture(tex);
    }
    mv.classList.add("is-ready");
  };
  mv.classList.remove("is-ready");
  const src = `/3d/${glb}.glb`;
  if (mv.getAttribute("src") !== src) { mv.addEventListener("load", apply, { once: true }); mv.setAttribute("src", src); }
  else if (mv.loaded) apply(); else mv.addEventListener("load", apply, { once: true });
}

let wallsReady = false;
function preloadWalls() {
  if (wallsReady) return; wallsReady = true;
  Object.values(PAREDES).forEach(w => { const i = new Image(); i.decoding = "async"; i.src = `/img/ambiente/${w.img}.webp`; });
}
function renderScene() {
  const s = $("#pScene"), w = PAREDES[S.room], bg = $("#pSceneBg");
  const apply = () => {
    [["--cx", w.cx], ["--cy", w.cy], ["--cm", w.cm], ["--gap", w.gap]].forEach(([k, v]) => s.style.setProperty(k, v));
    s.classList.remove("is-swapping");
  };
  $$("#sceneRoom [data-v]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === S.room)));
  const src = `/img/ambiente/${w.img}.webp`;
  if (bg.getAttribute("src") === src) return apply();
  // Fundido: se cambia la foto recién cuando está decodificada (sin parpadeo)
  s.classList.add("is-swapping");
  const next = new Image(); next.src = src;
  (next.decode ? next.decode() : Promise.resolve()).catch(() => {}).then(() => {
    if (PAREDES[S.room] !== w) return;
    bg.src = src; bg.alt = `Pared de ${w.nombre.toLowerCase()} con el cuadro a escala`; apply();
  });
}
function bindProduct() {
  if (!$("#pTitle")) return;
  $("#pViews").addEventListener("click", e => { const b = e.target.closest(".view"); if (b) setTab(b.dataset.tab, b); });
  $("#pViews").addEventListener("keydown", e => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const v = $$("#pViews .view"), i = v.indexOf(document.activeElement); if (i < 0) return;
    e.preventDefault(); const n = v[(i + (e.key === "ArrowRight" ? 1 : -1) + v.length) % v.length];
    setTab(n.dataset.tab, n); n.focus(); n.scrollIntoView({ block: "nearest", inline: "nearest" });
  });
  $("#pZoom").addEventListener("click", () => openZoom(zoomSrc()));
  $("#pStage").addEventListener("click", e => { if (S.x && (S.x.i || personal(S.x)) && e.target.closest("img,svg")) openZoom(zoomSrc()); });
  $("#pPhoto").addEventListener("click", () => openZoom(zoomSrc()));
  $("#sceneRoom").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { S.room = b.dataset.v; renderScene(); T("ver_pared_ambiente", { item_id: S.x.s, ambiente: S.room }); } });
  $("#pFields").addEventListener("input", () => {
    store.set(fieldKey(), Object.fromEntries($$("#pFieldList input").map(i => [i.name, i.value])));
    T1("pers" + S.x.s, "personalizar", { item_id: S.x.s, item_name: S.x.n });
    updateProductWa(); livePreview();
    if (S.tab === "3d") { clearTimeout(window.__t3d); window.__t3d = setTimeout(open3D, 350); }
  });
  $("#pFields").addEventListener("submit", e => e.preventDefault());
  const firstMissing = () => $$("#pFieldList input[required]").find(i => !i.value.trim());
  $("#pAdd").addEventListener("click", () => {
    if (S.x.p && firstMissing()) { firstMissing().focus(); toast("Completa los datos para personalizar"); return; }
    addToBag(S.x.s, S.x.p ? fieldValues().filter(([, v]) => v) : null);
    refreshAddBtn();
  });
  $("#pWa").addEventListener("click", e => {
    if (S.x.p && firstMissing()) { e.preventDefault(); firstMissing().focus(); toast("Completa los datos para personalizar"); return; }
    const code = window.CFTrack ? CFTrack.codigo() : "";
    $("#pWa").href = waLink(productMsg(code), S.x.q ? CONFIG.whatsappPapa : CONFIG.whatsapp);
    const it = item(S.x);
    T("begin_checkout", { currency: "PEN", value: it.price, items: [it], via: "ficha" });
    T("generate_lead", { currency: "PEN", value: it.price, transaction_id: code, items: [it], via: S.x.q ? "cotizar" : "ficha", ...((window.CFTrack && CFTrack.origen()) || {}) });
    const ent = store.get("cf_entrega", {});
    window.CFTrack && CFTrack.pedido({ codigo: code, via: S.x.q ? "cotizar" : "ficha", lugar: ent.lugar || "", pago: ent.pago || "", regalo: !!ent.regalo,
      items: [{ s: S.x.s, n: S.x.n, qty: 1, precio: it.price, f: S.x.p ? fieldValues().filter(([, v]) => v) : null }] });
  });
  // Barra de compra fija (celular): visible mientras los botones principales no se ven completos; usa los mismos botones
  const bar = $("#buyBar");
  if (bar && "IntersectionObserver" in window) {
    const ver = v => { bar.classList.toggle("is-on", v); bar.setAttribute("aria-hidden", String(!v)); document.body.classList.toggle("bb-on", v); };
    new IntersectionObserver(([en]) => ver(en.intersectionRatio < 0.99), { threshold: [0, 0.99, 1] }).observe($("#pBuy"));
    $("#bbWa").addEventListener("click", e => { e.preventDefault(); T("barra_compra", { item_id: S.x.s, accion: "whatsapp" }); $("#pWa").click(); });
    $("#bbAdd")?.addEventListener("click", () => { T("barra_compra", { item_id: S.x.s, accion: "agregar" }); $("#pAdd").click(); });
  }
  // Compartir: WhatsApp, Facebook, copiar y el menú del celular
  const shareText = () => `${S.x.n} · ${precioTxt(S.x)} — Cuadros Finos`;
  const syncShare = () => {
    if (!S.x) return;
    const url = absUrl(S.x), utm = (src, med) => `${url}?utm_source=${src}&utm_medium=${med}&utm_campaign=compartir`;
    $("#shWa").href = `https://wa.me/?text=${encodeURIComponent(shareText() + "\n" + utm("whatsapp", "compartido"))}`;
    $("#shFb").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(utm("facebook", "compartido"))}`;
    $("#pShare").hidden = !navigator.share;
  };
  $("#pTitle") && new MutationObserver(syncShare).observe($("#pTitle"), { childList: true });
  $("#shWa").addEventListener("click", () => T("share", { method: "whatsapp", content_type: "cuadro", item_id: S.x.s }));
  $("#shFb").addEventListener("click", () => T("share", { method: "facebook", content_type: "cuadro", item_id: S.x.s }));
  $("#shCopy").addEventListener("click", async () => {
    const url = absUrl(S.x);
    try { await navigator.clipboard.writeText(url); }
    catch { const t = document.createElement("textarea"); t.value = url; document.body.append(t); t.select(); document.execCommand("copy"); t.remove(); }
    T("share", { method: "copiar_enlace", content_type: "cuadro", item_id: S.x.s });
    $("#shCopy span").textContent = "¡Copiado!"; toast("Enlace copiado: pégalo donde quieras");
    setTimeout(() => ($("#shCopy span").textContent = "Copiar enlace"), 2200);
  });
  $("#pShare").addEventListener("click", async () => {
    T("share", { method: "nativo", content_type: "cuadro", item_id: S.x.s });
    try { await navigator.share({ title: S.x.n, text: shareText(), url: absUrl(S.x) + "?utm_source=compartido&utm_medium=nativo&utm_campaign=compartir" }); } catch {}
  });
  if (dlg) {
    dlg.addEventListener("close", onDialogClosed);
    dlg.addEventListener("click", e => { if (e.target === dlg || e.target.closest("[data-close]")) closeProduct(); });
  }
  if (inline) openProduct(document.body.dataset.slug, new URLSearchParams(location.search).get("vista") === "pared" ? "pared" : "obra", { push: false });
}

/* ---------- vistos recientemente ---------- */
function recordView(s) {
  const v = store.get("cf_vistos", []).filter(x => x !== s && BY[x]);
  v.unshift(s); store.set("cf_vistos", v.slice(0, 12));
}

function renderRecent() {
  const sec = $("#recent"); if (!sec) return;
  const cur = document.body.dataset.slug;
  const list = store.get("cf_vistos", []).filter(s => s !== cur).map(s => BY[s]).filter(Boolean).slice(0, 8);
  sec.hidden = list.length < 2;
  if (!sec.hidden) { $("#recentGrid").innerHTML = list.map(x => card(x)).join(""); reveal(sec); }
}

/* ---------- selección (carrito por WhatsApp) ---------- */
let bag = store.get("cf_bag", []).filter(b => b && BY[b.s] && !BY[b.s].q && b.qty > 0);
const unit = b => precioBase(BY[b.s]) + (b.f && b.f.length ? P.personalizar : 0);
/* Precio por cantidad: cuadros sueltos (30 × 37) se cobran de 3 en 3 al precio del tríptico y 2 al del díptico */
const enPack = x => !!x && !x.q && !x.p && !x.pr && piezas(x) === 1;
const packPrecio = n => Math.floor(n / 3) * P.triptico + (n % 3 === 2 ? Math.min(P.diptico, 2 * P.pieza) : (n % 3) * P.pieza);
function packs() { const n = bag.filter(b => enPack(BY[b.s])).reduce((a, b) => a + b.qty, 0); return { n, ahorro: Math.max(0, n * P.pieza - packPrecio(n)) }; }
const packTxt = () => `Lleva 3 por ${soles(P.triptico)}` + (P.diptico < 2 * P.pieza ? ` · 2 por ${soles(P.diptico)}` : "");
function saveBag() { store.set("cf_bag", bag); renderBag(); }
function addToBag(s, f = null) {
  const x = BY[s]; if (!x || x.q) return;
  if (x.p && !f) { openProduct(s); toast("Escribe los datos para personalizarlo"); return; }
  const key = JSON.stringify(f);
  const ex = bag.find(b => b.s === s && JSON.stringify(b.f) === key);
  ex ? ex.qty++ : bag.push({ s, f, qty: 1 });
  T("add_to_cart", { currency: "PEN", value: unit({ s, f }), items: [item(x, { price: unit({ s, f }) })], lista: LISTA });
  saveBag(); syncAddButtons();
  const badge = $("#bagCount"); badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
  if ($("#bag").getAttribute("aria-hidden") !== "false") toast(`«${x.n}» está en tu selección`, { label: "Ver selección", fn: openBag });
}
function bagMessage(code = "") {
  const { ahorro } = packs(), total = bagTotal();
  const lines = bag.map(b => {
    const x = BY[b.s];
    const f = b.f && b.f.length ? "\n" + b.f.map(([l, v]) => `    · ${l}: ${v}`).join("\n") : "";
    return `• ${b.qty} × ${x.n} (${medida(x)}) — ${soles(unit(b) * b.qty)}${f}\n  ${absUrl(x)}`;
  });
  const d = store.get("cf_entrega", {});
  const extra = [d.lugar && `Entrega en: ${d.lugar}`, d.pago && `Pago: ${d.pago}`, d.regalo && "Es para regalo 🎁"].filter(Boolean).join("\n");
  return `Hola, quiero pedir estos cuadros:\n${lines.join("\n")}\n\n` + (ahorro ? `Descuento por cantidad: − ${soles(ahorro)}\n` : "") + `Total: ${soles(total)} (envío gratis)` + (extra ? `\n${extra}` : "") + (code ? `\nCódigo: ${code}` : "") + `\n¿Me confirman el envío${d.lugar ? "" : " a mi dirección"}?`;
}
/* Sugerencia en la selección: armar el tríptico (más barato que 3 sueltos) o un cuadro que combine */
function bagUpsell() {
  const { n } = packs(), falta = n % 3 ? 3 - (n % 3) : 0;
  const head = n && falta ? `<p class="bag-up__msg">Agrega ${falta} cuadro${falta > 1 ? "s" : ""} más y los 3 te salen <b>${soles(P.triptico)}</b> (pagas ${soles(packPrecio(n + falta) - packPrecio(n))} más). Envío gratis.</p>` : "";
  const cols = new Set(bag.map(b => BY[b.s].c));
  const enSet = new Set(bag.flatMap(b => BY[b.s].set || []));
  const sug = DATA.filter(x => cols.has(x.c) && enPack(x) && x.i && !enSet.has(x.s) && !bag.some(b => b.s === x.s)).sort((a, b) => rank(a) - rank(b)).slice(0, 2);
  return sug.length ? `<div class="bag-up"><p class="kicker">${head ? "Te conviene" : "Combinan con tu selección"}</p>${head}<div class="cards cards--mini">${sug.map(x => card(x, { mini: true, add: true })).join("")}</div></div>` : "";
}
function renderBag() {
  const n = bag.reduce((a, b) => a + b.qty, 0);
  const badge = $("#bagCount"); badge.hidden = !n; badge.textContent = n;
  $("#openBag").setAttribute("aria-label", n ? `Mi selección: ${n} cuadro${n > 1 ? "s" : ""}` : "Mi selección");
  const total = bagTotal(), { ahorro } = packs();
  $("#bagTotal").textContent = soles(total);
  if ($("#bagDsc")) { $("#bagDsc").hidden = !ahorro; $("#bagDscN").textContent = "− " + soles(ahorro); }
  $("#bagFoot").hidden = !n;
  $("#bagList").innerHTML = n ? bag.map((b, i) => {
    const x = BY[b.s];
    const f = b.f && b.f.length ? b.f.map(([l, v]) => `${esc(l)}: ${esc(v)}`).join(" · ") : medida(x);
    return `<div class="bag-item">
      <a href="${purl(x)}" aria-label="Ver ${esc(x.n)}">${pf(x, { thumb: true })}</a>
      <div><h3>${esc(x.n)}</h3><p>${f}</p>
        <div class="qty"><button data-q="${i}" data-d="-1" aria-label="Quitar uno de ${esc(x.n)}">−</button><span aria-live="polite">${b.qty}</span><button data-q="${i}" data-d="1" aria-label="Agregar uno de ${esc(x.n)}">+</button></div></div>
      <div class="bag-item__r"><strong>${soles(unit(b) * b.qty)}</strong><button class="rm" data-rm="${i}">Quitar</button></div>
    </div>`;
  }).join("") + bagUpsell() : `<div class="bag-empty"><p>Aún no guardas cuadros.</p><p class="muted small">Toca “+” en cualquier cuadro para armar tu selección y pedir todo en un solo mensaje.</p><a href="/#catalogo" class="btn btn--line" data-close-bag>Ver cuadros</a></div>`;
  $("#bagWa").href = waLink(bagMessage());
  if ($("#bagEta")) $("#bagEta").textContent = `Envío gratis. Pide hoy y llega ${eta()} en Lima. El pago se confirma por WhatsApp: no pagas nada en la web.`;
}
const drawer = $("#bag");
let lastFocus = null;
const bagItems = () => bag.map(b => item(BY[b.s], { price: unit(b), quantity: b.qty }));
function bagTotal() { return bag.reduce((a, b) => a + unit(b) * b.qty, 0) - packs().ahorro; }
function openBag() {
  if (dlg && dlg.open) closeProduct();
  T("view_cart", { currency: "PEN", value: bagTotal(), items: bagItems() });
  lastFocus = document.activeElement;
  $("#toast").classList.remove("is-on");
  drawer.removeAttribute("inert"); drawer.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("lock");
  setTimeout(() => $(".drawer__head [data-close-bag]").focus(), 60);
}
function closeBag() {
  drawer.setAttribute("aria-hidden", "true"); drawer.setAttribute("inert", "");
  document.documentElement.classList.remove("lock");
  lastFocus && lastFocus.focus && lastFocus.focus();
}
function bindBag() {
  $("#openBag").addEventListener("click", openBag);
  drawer.addEventListener("click", e => {
    const q = e.target.closest("[data-q]");
    if (q) { const b = bag[+q.dataset.q]; if (+q.dataset.d < 0) T("remove_from_cart", { currency: "PEN", value: unit(b), items: [item(BY[b.s], { price: unit(b) })] }); b.qty += +q.dataset.d; if (b.qty < 1) bag.splice(+q.dataset.q, 1); saveBag(); syncAddButtons(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      const [gone] = bag.splice(+rm.dataset.rm, 1); saveBag(); syncAddButtons();
      T("remove_from_cart", { currency: "PEN", value: unit(gone) * gone.qty, items: [item(BY[gone.s], { price: unit(gone), quantity: gone.qty })] });
      toast(`Quitaste «${BY[gone.s].n}»`, { label: "Deshacer", fn: () => { bag.push(gone); saveBag(); syncAddButtons(); openBag(); } });
      return;
    }
    if (e.target.closest("[data-close-bag]") || e.target.closest("a[href]")) closeBag();
  });
  drawer.addEventListener("keydown", e => {
    if (e.key === "Escape") return closeBag();
    if (e.key !== "Tab") return;
    const f = $$("a[href],button:not([disabled])", $(".drawer__panel")).filter(el => el.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  });
  $("#bagShare").addEventListener("click", async () => {
    T("share", { method: "seleccion", content_type: "seleccion" });
    const u = new URL("/", location.origin); u.searchParams.set("seleccion", bag.map(b => b.s + (b.qty > 1 ? "*" + b.qty : "")).join(","));
    try { if (navigator.share) await navigator.share({ title: "Mi selección de cuadros", url: u.href }); else { await navigator.clipboard.writeText(u.href); toast("Enlace de tu selección copiado"); } } catch {}
  });
  // Datos de entrega: se recuerdan y van en el mensaje
  const ent = store.get("cf_entrega", {});
  $("#bagLugar").value = ent.lugar || ""; $("#bagPago").value = ent.pago || ""; $("#bagRegalo").checked = !!ent.regalo;
  const saveEnt = () => { store.set("cf_entrega", { lugar: $("#bagLugar").value.trim(), pago: $("#bagPago").value, regalo: $("#bagRegalo").checked }); $("#bagWa").href = waLink(bagMessage()); };
  $("#bagForm").addEventListener("input", saveEnt); $("#bagForm").addEventListener("change", saveEnt);
  $("#bagLugar").addEventListener("change", () => $("#bagLugar").value.trim() && T("add_shipping_info", { currency: "PEN", value: bagTotal(), shipping_tier: $("#bagLugar").value.trim(), items: bagItems() }));
  $("#bagPago").addEventListener("change", () => $("#bagPago").value && T("add_payment_info", { currency: "PEN", value: bagTotal(), payment_type: $("#bagPago").value, items: bagItems() }));
  $("#bagWa").addEventListener("click", () => {
    const code = window.CFTrack ? CFTrack.codigo() : "";
    $("#bagWa").href = waLink(bagMessage(code));
    T("begin_checkout", { currency: "PEN", value: bagTotal(), items: bagItems(), via: "seleccion" });
    T("generate_lead", { currency: "PEN", value: bagTotal(), transaction_id: code, items: bagItems(), via: "seleccion", piezas: bag.reduce((a, b) => a + b.qty, 0), ...((window.CFTrack && CFTrack.origen()) || {}) });
    window.CFTrack && CFTrack.pedido({ codigo: code, via: "seleccion", lugar: $("#bagLugar").value.trim(), pago: $("#bagPago").value, regalo: $("#bagRegalo").checked,
      descuento: packs().ahorro, items: bag.map(b => ({ s: b.s, n: BY[b.s].n, qty: b.qty, precio: unit(b), f: b.f && b.f.length ? b.f : null })) });
  });
  $("#bagForm").addEventListener("submit", e => e.preventDefault());
  // Selección compartida por enlace (?seleccion=slug,slug*2)
  const shared = new URLSearchParams(location.search).get("seleccion");
  if (shared) {
    shared.split(",").forEach(t => { const [s, q] = t.split("*"); const x = BY[s]; if (x && !x.q && !x.p && !bag.some(b => b.s === s)) bag.push({ s, f: null, qty: Math.max(1, Math.min(20, +q || 1)) }); });
    saveBag(); const u = new URL(location.href); u.searchParams.delete("seleccion"); history.replaceState(null, "", u.pathname + u.search);
    setTimeout(openBag, 300);
  }
  renderBag();
}
function syncAddButtons() {
  $$("[data-add]").forEach(b => {
    const on = bag.some(x => x.s === b.dataset.add);
    b.classList.toggle("is-in", on); b.textContent = on ? "✓" : "+";
    b.setAttribute("aria-label", `${on ? "Ya está en tu selección" : "Agregar a mi selección"}: ${BY[b.dataset.add]?.n || ""}`);
  });
  if (S.x) refreshAddBtn();
}

/* ---------- ayúdame a elegir ---------- */
const QUIZ = [
  { t: "¿Para qué pared es?", k: "room", o: [["sala", "Sala", "Sobre el sofá o el aparador"], ["dormitorio", "Dormitorio", "Sobre la cama o la cómoda"], ["oficina", "Oficina", "Despacho, consultorio o escritorio"], ["comedor", "Comedor", "Junto a la mesa"]] },
  { t: "¿Qué quieres que diga?", k: "style", o: [["poder", "Fuerza", "Animales, ambición y disciplina"], ["fe", "Fe", "Arte sacro y bendiciones"], ["calma", "Calma", "Abstractos y botánicos"], ["lugares", "Lugares", "Perú, el mar, el cielo"], ["oficio", "Mi profesión", "Abogados, salud, arquitectura"], ["pers", "Algo solo mío", "Con nombre, fecha o ciudad"]] },
  { t: "¿Una pieza o un conjunto?", k: "fmt", o: [["uno", "Una pieza", `${soles(P.pieza)} · 30 × 37 cm`], ["set", "Tríptico", `${soles(P.triptico)} · ≈ 98 cm de ancho`], ["any", "Me da igual", "Muéstrame lo mejor"]] },
];
const STYLE = { poder: x => x.c === "poder", fe: x => x.c === "fe" || x.c === "papa", calma: x => x.c === "abstracto" || x.c === "botanico", lugares: x => x.c === "lugares" || x.c === "cosmos", oficio: x => x.c === "oficio", pers: x => !!x.p };
const STYLE_COL = { poder: "poder", fe: "fe", calma: "abstracto", lugares: "lugares", oficio: "oficio", pers: "personalizados" };
let QA = {};
const quiz = $("#quiz");
function openQuiz() { QA = {}; quizStep(0); quiz.showModal(); T("ayuda_inicio", { lista: LISTA }); }
function quizStep(i) {
  $("#qRes").hidden = true; $("#qOpts").hidden = false;
  const q = QUIZ[i];
  $("#qStep").textContent = `Paso ${i + 1} de ${QUIZ.length}`;
  $("#qTitle").textContent = q.t;
  $("#qOpts").innerHTML = q.o.map(([v, n, d]) => `<button class="quiz__opt" data-v="${v}"><strong>${n}</strong><span>${d}</span></button>`).join("") +
    (i ? `<button class="link-btn small quiz__back" data-back="${i - 1}">← Volver</button>` : "");
  $("#qOpts").onclick = e => {
    const back = e.target.closest("[data-back]"); if (back) return quizStep(+back.dataset.back);
    const b = e.target.closest("[data-v]"); if (!b) return;
    QA[q.k] = b.dataset.v; i + 1 < QUIZ.length ? quizStep(i + 1) : quizResult();
  };
  setTimeout(() => $("#qOpts .quiz__opt").focus(), 30);
}
function quizResult() {
  const score = x => (x.a.includes(QA.room) ? 4 : 0) + (STYLE[QA.style](x) ? 8 : 0) +
    (QA.fmt === "set" ? (piezas(x) > 1 ? 6 : 0) : QA.fmt === "uno" ? (piezas(x) === 1 ? 2 : -4) : 0) + (x.t ? 2 : 0) + (x.i ? 3 : -10) + (x.q ? -3 : 0);
  let res = DATA.filter(x => STYLE[QA.style](x)).sort((a, b) => score(b) - score(a) || a.idx - b.idx).slice(0, 6);
  if (QA.fmt === "set" && !res.some(x => piezas(x) > 1)) res = [...DATA.filter(x => piezas(x) > 1 && x.i && x.a.includes(QA.room)).sort((a, b) => rank(a) - rank(b)).slice(0, 2), ...res].slice(0, 6);
  T("ayuda_resultado", { ambiente: QA.room, estilo: QA.style, formato: QA.fmt });
  $("#qStep").textContent = "Tu recomendación";
  $("#qTitle").textContent = "Estos van con tu pared";
  $("#qOpts").hidden = true;
  const r = $("#qRes"); r.hidden = false;
  const col = STYLE_COL[QA.style];
  const colObj = colDe(col) || VIRTUALES.find(v => v.id === col);
  r.innerHTML = `<div class="cards">${res.map(x => card(x, { mini: true, add: true })).join("")}</div>
    <div class="quiz__actions"><a class="btn btn--light" href="/${colObj.url}/">Ver todos los de este estilo</a><button class="btn btn--line" id="qAgain">Empezar de nuevo</button></div>`;
  $("#qAgain").onclick = () => quizStep(0);
}

/* ---------- búsqueda rápida ---------- */
const sdlg = $("#search");
function openSearch() { sdlg.showModal(); $("#sq").value = ""; renderSearch(""); $("#sq").focus(); }
function renderSearch(q) {
  let list;
  if (q.trim()) list = DATA.filter(x => matches(x, q)).sort((a, b) => relevancia(b, q) - relevancia(a, q) || rank(a) - rank(b));
  else {
    const vistos = store.get("cf_vistos", []).map(s => BY[s]).filter(Boolean);
    list = vistos.length ? vistos : DATA.filter(x => x.t);
  }
  list = list.slice(0, 8);
  // Enter abre el cuadro si su nombre coincide con lo buscado (p. ej. «machu»); si no, el primer tema.
  sdlg.dataset.top = q.trim() && list[0] && relevancia(list[0], q) > 0 ? "cuadro" : "";
  const head = !q.trim() ? `<p class="search__hint">${store.get("cf_vistos", []).length ? "Vistos recientemente" : "Los más pedidos"}</p>` : "";
  // Temas y subtemas que coinciden (p. ej. «médico» → Profesionales · Salud)
  const temas = [];
  if (q.trim()) {
    COLECCIONES.forEach(c => (c.subs || []).forEach(([id, n]) => { if (matches({ _q: norm(n + " " + ((c.subClaves || {})[id] || "")) }, q)) temas.push({ url: `/${c.url}/?sub=${id}#catalogo`, t: `${c.nombre} · ${n}`, k: DATA.filter(x => x.c === c.id && x.u === id).length }); }));
    [...COLECCIONES, ...VIRTUALES, ...AMBS].forEach(c => { if (matches({ _q: norm([c.nombre, c.h1, c.claves].join(" ")) }, q)) temas.push({ url: `/${c.url}/`, t: c.h1 || c.nombre, k: 0 }); });
  }
  const cols = temas.filter((c, i) => temas.findIndex(o => o.url.split("?")[0] === c.url.split("?")[0]) === i || c.url.includes("?")).slice(0, 3);
  $("#sRes").innerHTML = head + cols.map(c => `<a class="s-item s-item--col" role="listitem" href="${c.url}"><span class="s-ico">→</span><span><b>${esc(c.t)}</b><small>${c.k ? c.k + " cuadros" : "Ver todos"}</small></span><em></em></a>`).join("") +
    (list.length ? list.map(x => `<a class="s-item" role="listitem" href="${purl(x)}">${pf(x, { thumb: true })}<span><b>${esc(x.n)}</b><small>${esc(colDe(x.c).nombre)} · ${esc(x.f)}</small></span><em>${precioTxt(x)}</em></a>`).join("")
      : `<div class="s-empty"><p>No tenemos un cuadro de “${esc(q)}” todavía. <span class="muted">Estos son los que más se piden:</span></p></div>` +
        DATA.filter(x => x.t && x.i).slice(0, 4).map(x => `<a class="s-item s-item--sug" role="listitem" href="${purl(x)}">${pf(x, { thumb: true })}<span><b>${esc(x.n)}</b><small>${esc(colDe(x.c).nombre)} · ${esc(x.f)}</small></span><em>${precioTxt(x)}</em></a>`).join("") +
        `<div class="s-empty"><p class="muted small">O mira por tema:</p><div class="pills">${COLECCIONES.map(c => `<a class="pill" href="/${c.url}/">${esc(c.nombre)}</a>`).join("")}</div><p class="small"><a class="u" href="${waLink("Hola, busco un cuadro de: " + q)}" target="_blank" rel="noopener">Pídenos uno a medida por WhatsApp</a></p></div>`);
}

/* ---------- navegación general ---------- */
function bindGeneral() {
  const nav = $("#nav"), tog = $("#navToggle");
  const setNav = o => { nav.classList.toggle("open", o); tog.setAttribute("aria-expanded", String(o)); tog.setAttribute("aria-label", o ? "Cerrar menú" : "Abrir menú"); };
  tog.addEventListener("click", () => setNav(!nav.classList.contains("open")));
  $$(".nav__links a").forEach(a => a.addEventListener("click", () => setNav(false)));
  document.addEventListener("keydown", e => { if (e.key === "Escape" && nav.classList.contains("open")) { setNav(false); tog.focus(); } });
  addEventListener("scroll", () => nav.classList.toggle("is-scrolled", scrollY > 10), { passive: true });

  $$("[data-wa]").forEach(a => { a.href = waLink(a.dataset.wa); a.target = "_blank"; a.rel = "noopener"; });

  document.addEventListener("click", e => {
    const wa = e.target.closest("a[data-wa]");
    if (wa) T("contacto_whatsapp", { ubicacion: wa.classList.contains("wa-float") ? "boton_flotante" : (wa.closest("footer") ? "pie" : "pagina"), ...((window.CFTrack && CFTrack.origen()) || {}) });
    const card = e.target.closest("a.card__open, a.s-item:not(.s-item--col)");
    if (card) { const slug = card.getAttribute("href").split("/")[2], x = BY[slug];
      if (x) T("select_item", { item_list_id: e.target.closest("#qRes") ? "ayuda" : e.target.closest("#sRes") ? "busqueda" : e.target.closest("#recent") ? "vistos" : e.target.closest("#topGrid") ? "mas_pedidos" : e.target.closest(".pd__related, .sec--tight") ? "relacionados" : LISTA, items: [item(x)] }); }
    if (e.target.closest("[data-open-quiz]")) { e.preventDefault(); return openQuiz(); }
    const add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); e.stopPropagation(); return addToBag(add.dataset.add); }
    const a = e.target.closest('a[href^="/cuadro/"]');
    if (a && dlg && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
      const slug = a.getAttribute("href").split("/")[2];
      if (BY[slug]) {
        e.preventDefault();
        if (sdlg.open) sdlg.close();
        if (quiz.open) quiz.close();
        openProduct(slug, a.dataset.tab);
      }
    }
  });
  $$("dialog").forEach(d => d.addEventListener("click", e => { if (d !== dlg && (e.target === d || e.target.closest("[data-close]"))) d.close(); }));
  $("#openSearch").addEventListener("click", openSearch);
  $("#nfSearch")?.addEventListener("click", openSearch);
  document.addEventListener("click", e => { if (e.target.closest("[data-open-search]")) { e.preventDefault(); setNav(false); openSearch(); } });
  // «Por ambiente» y «Por tema»: se abren con clic o teclado; Esc o un clic afuera los cierran
  const dds = $$(".nav__dd");
  const cerrarDd = (salvo) => dds.forEach(b => { if (b !== salvo) b.setAttribute("aria-expanded", "false"); });
  dds.forEach(b => b.addEventListener("click", () => { const o = b.getAttribute("aria-expanded") !== "true"; cerrarDd(b); b.setAttribute("aria-expanded", String(o)); if (o) T("menu", { grupo: b.textContent }); }));
  document.addEventListener("click", e => { if (!e.target.closest(".nav__grp")) cerrarDd(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { const ab = dds.find(b => b.getAttribute("aria-expanded") === "true"); if (ab) { cerrarDd(); ab.focus(); } } });
  $$(".nav__grp").forEach(g => g.addEventListener("focusout", e => { if (!g.contains(e.relatedTarget)) cerrarDd(); }));
  $("#sq").addEventListener("input", e => { renderSearch(e.target.value); const v = e.target.value.trim(); clearTimeout(window.__ts); if (v.length >= 3) window.__ts = setTimeout(() => T("search", { search_term: v, lugar: "buscador", resultados: DATA.filter(x => matches(x, v)).length }), 1200); });
  $("#search form").addEventListener("submit", e => {
    e.preventDefault();
    const first = (sdlg.dataset.top === "cuadro" && $("#sRes a.s-item:not(.s-item--col)")) || $("#sRes a.s-item:not(.s-item--sug)"); if (first) return first.click();
  });
  document.addEventListener("keydown", e => {
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (e.key === "/" && !typing && !document.querySelector("dialog[open]")) { e.preventDefault(); openSearch(); }
  });
  addEventListener("popstate", () => {
    const m = location.pathname.match(/^\/cuadro\/([a-z0-9-]+)\/?$/);
    if (dlg && m && BY[m[1]]) { S.pushed = false; openProduct(m[1], null, { push: false }); }
    else if (dlg && dlg.open) { S.pushed = false; dlg.close(); }
  });
  // Zoom: tocar acerca (2,4x) hacia ese punto; mover el puntero recorre la imagen
  const z = $("#zoom");
  if (z) {
    const st = $("#zoomStage"), zi = $("#zoomImg");
    const aim = e => { const r = zi.getBoundingClientRect(); zi.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`; };
    st.addEventListener("click", e => {
      const target = e.target === zi ? zi : e.target.closest("#zoomSvg");
      if (!target) return z.close();
      const r = target.getBoundingClientRect(), o = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      zi.style.transformOrigin = o; if ($("#zoomSvg")) $("#zoomSvg").style.transformOrigin = o;
      z.classList.toggle("is-z");
    });
    st.addEventListener("pointermove", e => { if (z.classList.contains("is-z") && e.pointerType === "mouse") aim(e); });
  }
  // Portada: fotos que rotan cada 6 s (se detiene al pasar el mouse o si se prefiere menos movimiento)
  const slides = $$(".hero__slide"), dots = $$(".hero__dots button");
  if (slides.length > 1) {
    let i = 0, timer = null;
    const go = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((sl, k) => sl.classList.toggle("is-on", k === i));
      dots.forEach((d, k) => d.setAttribute("aria-selected", String(k === i)));
      if (slides[i].loading === "lazy") slides[i].loading = "eager";
      $("#heroCapTxt").textContent = slides[i].dataset.pie; $("#heroCap").href = slides[i].dataset.url;
    };
    const play = () => { if (!reduced && !timer) timer = setInterval(() => go(i + 1), 6000); };
    const stop = () => { clearInterval(timer); timer = null; };
    dots.forEach((d, k) => d.addEventListener("click", () => { stop(); go(k); }));
    const hero = $(".hero");
    hero.addEventListener("mouseenter", stop); hero.addEventListener("mouseleave", play);
    hero.addEventListener("focusin", stop);
    document.addEventListener("visibilitychange", () => document.hidden ? stop() : play());
    setTimeout(() => slides.forEach(sl => (sl.loading = "eager")), 2500);
    play();
  }
  // Enlaces antiguos tipo #cuadro/slug
  const old = location.hash.match(/^#cuadro\/([a-z0-9-]+)/);
  if (old && BY[old[1]]) location.replace(purl(BY[old[1]]));
}

renderBag();
bindGeneral();
renderRecent();
$("#recentClear")?.addEventListener("click", () => { store.set("cf_vistos", []); renderRecent(); });
bindCatalog();
bindProduct();
bindBag();
reveal();
})();
