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
const precioBase = x => x.q ? null : x.o === "triptico" ? P.triptico : x.o === "diptico" ? P.diptico : P.pieza;
const medida = x => x.o === "triptico" ? "Tríptico 3 × (30 × 37 cm) con marco" : x.o === "diptico" ? "Díptico 2 × (30 × 37 cm) con marco" : esH(x) ? "37 × 30 cm con marco (horizontal)" : "30 × 37 cm con marco";
DATA.forEach(x => (x._q = norm([x.n, x.f, colDe(x.c)?.nombre, subNombre(x), x.a.join(" "), x.p || "", x.o].join(" "))));
const rank = x => (x.t ? 0 : 10) + (x.nw ? 0 : 3) + (x.i ? 0 : 20) + (x.c === "papa" ? 15 : 0) + x.idx / 100;
const matches = (x, q) => norm(q).split(/\s+/).filter(Boolean).every(t => x._q.includes(t.replace(/s$/, "")));

/* ---------- render ---------- */
function pf(x, { lazy = true, thumb = false, scene = false } = {}) {
  const ld = lazy ? ' loading="lazy" decoding="async"' : "";
  const base = thumb ? "/img/cuadros/t/" : "/img/cuadros/";
  const n = piezas(x);
  if (n > 1) {
    const inner = Array.from({ length: n }, (_, i) =>
      `<span class="pf"><img src="${base}${x.s}-${i + 1}.webp" alt="${esc(x.n)} (panel ${i + 1})"${ld}></span>`).join("");
    return scene ? inner : `<span class="set">${inner}</span>`;
  }
  const cls = "pf" + (esH(x) ? " pf--h" : "");
  if (!x.i) return `<span class="${cls}"><span class="ph"><b>${esc(x.n)}</b><i>Vista previa<br>por WhatsApp</i></span></span>`;
  return `<span class="${cls}"><img src="${base}${x.s}.webp" alt="${esc(x.n)} — cuadro con marco negro"${ld}></span>`;
}
const precioTxt = x => x.q ? "Cotizar" : (x.p ? "Desde " : "") + soles(precioBase(x));
function card(x, { mini = false } = {}) {
  const tag = x.t ? '<span class="tag">Más pedido</span>' : x.nw ? '<span class="tag tag--ghost">Nuevo</span>' : x.p ? '<span class="tag tag--ghost">Personalizable</span>' : "";
  const inBag = bag.some(b => b.s === x.s);
  const add = x.q || mini ? "" : `<button class="card__add${inBag ? " is-in" : ""}" data-add="${x.s}" aria-label="${inBag ? "Ya está en tu selección" : "Agregar a mi selección"}: ${esc(x.n)}">${inBag ? "✓" : "+"}</button>`;
  return `<article class="card${mini ? "" : " rv"}" data-s="${x.s}"><div class="card__stage">${tag}${pf(x, { thumb: true })}${add}</div>` +
    `<h3>${esc(x.n)}</h3>${mini ? "" : `<p>${esc(x.f)}</p>`}<span class="card__price">${precioTxt(x)}</span>` +
    `<a class="card__open" href="${purl(x)}" aria-label="Ver ${esc(x.n)}"></a></article>`;
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
const F0 = { ...F };

function filtered() {
  const vf = VFILTRO[F.col];
  let list = DATA.filter(x => (!F.col || (vf ? vf(x) : x.c === F.col)) && (!F.sub || x.u === F.sub) &&
    (!F.room || x.a.includes(F.room)) && (!F.q || matches(x, F.q)));
  if (F.sort === "az") list.sort((a, b) => a.n.localeCompare(b.n, "es"));
  else if (F.sort === "nuevo") list.sort((a, b) => (b.nw ? 1 : 0) - (a.nw ? 1 : 0) || rank(a) - rank(b));
  else if (F.sort === "precio") list.sort((a, b) => (precioBase(a) ?? 1e9) - (precioBase(b) ?? 1e9) || rank(a) - rank(b));
  else list.sort((a, b) => rank(a) - rank(b));
  return list;
}
function renderFilters() {
  $$("#colFilters [data-col]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.col === F.col)));
  const c = colDe(F.col);
  $("#subFilters").innerHTML = c && c.subs.length > 1 ? [["", "Todo " + c.nombre], ...c.subs].map(([id, n]) =>
    `<button class="chip${F.sub === id ? " is-on" : ""}" data-sub="${id}" aria-pressed="${F.sub === id}">${esc(n)}</button>`).join("") : "";
  $("#room").value = F.room; $("#sort").value = F.sort;
  if ($("#q").value !== F.q) $("#q").value = F.q;
}
function renderGrid() {
  const list = filtered();
  $("#grid").innerHTML = list.map(x => card(x)).join("");
  $("#empty").hidden = list.length > 0;
  $("#count").textContent = list.length === DATA.length ? `${list.length} cuadros` : `${list.length} de ${DATA.length} cuadros`;
  reveal($("#grid"));
}
function syncUrl() {
  if (PAGE !== "home") return;
  const u = new URL(location.href);
  [["q", F.q], ["c", F.col], ["amb", F.room]].forEach(([k, v]) => v ? u.searchParams.set(k, v) : u.searchParams.delete(k));
  history.replaceState(history.state, "", u.pathname + u.search + u.hash);
}
function setFilter(patch, scroll) {
  Object.assign(F, patch);
  renderFilters(); renderGrid(); syncUrl();
  if (scroll) $("#catalogo").scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
}
function bindCatalog() {
  if (!hasCatalog) return;
  const params = new URLSearchParams(location.search);
  if (PAGE === "home") Object.assign(F, { q: params.get("q") || "", col: params.get("c") || "", room: params.get("amb") || "" });
  $("#colFilters").addEventListener("click", e => { const b = e.target.closest("[data-col]"); if (b) setFilter({ col: b.dataset.col, sub: "" }); });
  $("#colFilters").addEventListener("keydown", e => {
    if (!["ArrowRight", "ArrowLeft"].includes(e.key)) return;
    const tabs = $$("#colFilters [data-col]"); const i = tabs.indexOf(document.activeElement);
    if (i < 0) return; e.preventDefault();
    tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length].focus();
  });
  $("#subFilters").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b) setFilter({ sub: b.dataset.sub }); });
  let t; $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => setFilter({ q: e.target.value.trim() }), 140); });
  $("#room").addEventListener("change", e => setFilter({ room: e.target.value }));
  $("#sort").addEventListener("change", e => setFilter({ sort: e.target.value }));
  $("#clearFilters").addEventListener("click", () => setFilter({ col: "", sub: "", q: "", room: "" }));
  const changed = F.q || F.col !== F0.col || F.room !== F0.room;
  renderFilters();
  if (changed) { renderGrid(); if (F.q || F.col || F.room) setTimeout(() => $("#catalogo").scrollIntoView(), 50); }
  else reveal($("#grid"));
}

/* ---------- ficha del cuadro (diálogo o página) ---------- */
const dlg = $("#product");
const inline = PAGE === "product";
const S = { x: null, room: "sala", wall: store.get("cf_wall", "#e9e6df"), tab: "obra", pushed: false, prevUrl: null, prevTitle: document.title };
const ROOM_TOP = { sala: "17%", dormitorio: "13%", oficina: "22%", comedor: "21%" };

function openProduct(slug, tab, { push = true } = {}) {
  const x = BY[slug]; if (!x) return false;
  if (!inline && !dlg) { location.href = purl(x); return true; }
  S.x = x;
  const c = colDe(x.c);
  $("#pCol").textContent = `Colección ${c.nombre}${subNombre(x) && c.subs.length > 1 ? " · " + subNombre(x) : ""}`;
  $("#pTitle").textContent = x.n;
  $("#pPhrase").textContent = x.f;
  if (!inline) {
    $("#pStage").innerHTML = pf(x, { lazy: false });
    $("#pSceneArt").innerHTML = pf(x, { lazy: false, scene: true });
    $("#pFieldList").innerHTML = (x.k || []).map(([label, ph], i) =>
      `<label class="field"><span>${esc(label)}</span><input name="f${i}" data-label="${esc(label)}" placeholder="${esc(ph)}"${/opcional/i.test(label) ? "" : " required"}></label>`).join("");
    const rel = DATA.filter(y => y.c === x.c && y.s !== x.s && y.i).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
    $("#pRelated").innerHTML = rel.map(y => card(y, { mini: true })).join("");
    $("#pPage").href = purl(x);
  }
  $("#pMeasure").textContent = x.o === "triptico" ? "≈ 98 cm de ancho" : x.o === "diptico" ? "≈ 64 cm de ancho" : esH(x) ? "37 × 30 cm" : "30 × 37 cm";
  $("#pSize").textContent = medida(x);
  $("#pRooms").textContent = x.a.map(r => r[0].toUpperCase() + r.slice(1)).join(", ");
  $("#pFields").hidden = !x.p;
  restoreFields();
  if (x.q) {
    $("#pPrice").textContent = "Cotiza por WhatsApp";
    $("#pPriceNote").textContent = "Recuerdo de la visita del Papa: precio a consultar.";
    $("#pAdd").hidden = true; $("#pWa").textContent = "Cotizar por WhatsApp";
  } else {
    $("#pPrice").textContent = soles(precioBase(x) + (x.p ? P.personalizar : 0));
    $("#pPriceNote").textContent = x.p ? `Incluye personalización (+ ${soles(P.personalizar)}). Marco negro y envío protegido.` : `${medida(x)}. Listo para colgar.`;
    $("#pAdd").hidden = false; $("#pWa").textContent = "Pedir este por WhatsApp";
  }
  updateProductWa(); refreshAddBtn();
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
function productMsg() {
  const x = S.x;
  if (x.q) return `Hola, quiero cotizar el cuadro «${x.n}» (Papa León XIV).\n${absUrl(x)}`;
  const f = x.p ? fieldValues().filter(([, v]) => v).map(([l, v]) => `  · ${l}: ${v}`).join("\n") : "";
  return `Hola, quiero pedir este cuadro:\n• ${x.n} — ${medida(x)} — ${$("#pPrice").textContent}` + (f ? `\n${f}` : "") + `\n${absUrl(x)}\n\n¿Me confirman el envío a mi dirección?`;
}
function updateProductWa() { $("#pWa").href = waLink(productMsg(), S.x.q ? CONFIG.whatsappPapa : CONFIG.whatsapp); }
function refreshAddBtn() {
  const n = bag.filter(b => b.s === S.x.s).reduce((a, b) => a + b.qty, 0);
  $("#pAdd").textContent = n && !S.x.p ? `En tu selección (${n}) · Agregar otro` : "Agregar a mi selección";
}
function setTab(t) {
  S.tab = t;
  $$(".tabs [data-tab]").forEach(b => { b.setAttribute("aria-selected", String(b.dataset.tab === t)); b.tabIndex = b.dataset.tab === t ? 0 : -1; });
  $("#pStage").hidden = t !== "obra";
  $("#pWall").hidden = t !== "pared";
}
function renderScene() {
  const s = $("#pScene");
  s.className = "scene scene--" + S.room;
  s.style.setProperty("--wall", S.wall);
  s.style.setProperty("--top", ROOM_TOP[S.room]);
  const rgb = parseInt(S.wall.slice(1), 16), lum = ((rgb >> 16) * .299 + ((rgb >> 8) & 255) * .587 + (rgb & 255) * .114);
  $("#pMeasure").classList.toggle("on-dark", lum < 110);
  $$("#sceneRoom [data-v]").forEach(b => b.setAttribute("aria-checked", String(b.dataset.v === S.room)));
  $$("#wallColors button").forEach(b => b.classList.toggle("is-on", getComputedStyle(b).getPropertyValue("--c").trim() === S.wall));
}
function bindProduct() {
  if (!$("#pTitle")) return;
  $$(".tabs [data-tab]").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $(".tabs").addEventListener("keydown", e => {
    if (["ArrowRight", "ArrowLeft"].includes(e.key)) { e.preventDefault(); const t = S.tab === "obra" ? "pared" : "obra"; setTab(t); $(`.tabs [data-tab="${t}"]`).focus(); }
  });
  $("#sceneRoom").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { S.room = b.dataset.v; renderScene(); } });
  $("#wallColors").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    S.wall = getComputedStyle(b).getPropertyValue("--c").trim(); store.set("cf_wall", S.wall); renderScene();
  });
  $("#wallPick").addEventListener("input", e => { S.wall = e.target.value; store.set("cf_wall", S.wall); renderScene(); });
  $("#pFields").addEventListener("input", () => {
    store.set(fieldKey(), Object.fromEntries($$("#pFieldList input").map(i => [i.name, i.value])));
    updateProductWa();
  });
  $("#pFields").addEventListener("submit", e => e.preventDefault());
  const firstMissing = () => $$("#pFieldList input[required]").find(i => !i.value.trim());
  $("#pAdd").addEventListener("click", () => {
    if (S.x.p && firstMissing()) { firstMissing().focus(); toast("Completa los datos para personalizar"); return; }
    addToBag(S.x.s, S.x.p ? fieldValues().filter(([, v]) => v) : null);
    refreshAddBtn();
  });
  $("#pWa").addEventListener("click", e => {
    if (S.x.p && firstMissing()) { e.preventDefault(); firstMissing().focus(); toast("Completa los datos para personalizar"); }
  });
  $("#pShare").addEventListener("click", async () => {
    const url = absUrl(S.x);
    try {
      if (navigator.share) await navigator.share({ title: S.x.n, text: `${S.x.n} · ${precioTxt(S.x)}`, url });
      else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); }
    } catch {}
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

/* ---------- selección (carrito por WhatsApp) ---------- */
let bag = store.get("cf_bag", []).filter(b => b && BY[b.s] && !BY[b.s].q && b.qty > 0);
const unit = b => precioBase(BY[b.s]) + (b.f && b.f.length ? P.personalizar : 0);
function saveBag() { store.set("cf_bag", bag); renderBag(); }
function addToBag(s, f = null) {
  const x = BY[s]; if (!x || x.q) return;
  if (x.p && !f) { openProduct(s); toast("Escribe los datos para personalizarlo"); return; }
  const key = JSON.stringify(f);
  const ex = bag.find(b => b.s === s && JSON.stringify(b.f) === key);
  ex ? ex.qty++ : bag.push({ s, f, qty: 1 });
  saveBag(); syncAddButtons();
  const badge = $("#bagCount"); badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
  toast(`«${x.n}» está en tu selección`, { label: "Ver selección", fn: openBag });
}
function bagMessage() {
  const total = bag.reduce((a, b) => a + unit(b) * b.qty, 0);
  const lines = bag.map(b => {
    const x = BY[b.s];
    const f = b.f && b.f.length ? "\n" + b.f.map(([l, v]) => `    · ${l}: ${v}`).join("\n") : "";
    return `• ${b.qty} × ${x.n} (${medida(x)}) — ${soles(unit(b) * b.qty)}${f}\n  ${absUrl(x)}`;
  });
  return `Hola, quiero pedir estos cuadros:\n${lines.join("\n")}\n\nTotal: ${soles(total)}\n¿Me confirman el envío a mi dirección?`;
}
function renderBag() {
  const n = bag.reduce((a, b) => a + b.qty, 0);
  const badge = $("#bagCount"); badge.hidden = !n; badge.textContent = n;
  $("#openBag").setAttribute("aria-label", n ? `Mi selección: ${n} cuadro${n > 1 ? "s" : ""}` : "Mi selección");
  const total = bag.reduce((a, b) => a + unit(b) * b.qty, 0);
  $("#bagTotal").textContent = soles(total);
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
  }).join("") : `<div class="bag-empty"><p>Aún no guardas cuadros.</p><p class="muted small">Toca “+” en cualquier cuadro para armar tu selección y pedir todo en un solo mensaje.</p><a href="/#catalogo" class="btn btn--line" data-close-bag>Ver cuadros</a></div>`;
  $("#bagWa").href = waLink(bagMessage());
}
const drawer = $("#bag");
let lastFocus = null;
function openBag() {
  if (dlg && dlg.open) closeProduct();
  lastFocus = document.activeElement;
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
    if (q) { const b = bag[+q.dataset.q]; b.qty += +q.dataset.d; if (b.qty < 1) bag.splice(+q.dataset.q, 1); saveBag(); syncAddButtons(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) {
      const [gone] = bag.splice(+rm.dataset.rm, 1); saveBag(); syncAddButtons();
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
    const u = new URL("/", location.origin); u.searchParams.set("seleccion", bag.map(b => b.s + (b.qty > 1 ? "*" + b.qty : "")).join(","));
    try { if (navigator.share) await navigator.share({ title: "Mi selección de cuadros", url: u.href }); else { await navigator.clipboard.writeText(u.href); toast("Enlace de tu selección copiado"); } } catch {}
  });
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
function openQuiz() { QA = {}; quizStep(0); quiz.showModal(); }
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
  const res = DATA.filter(x => STYLE[QA.style](x)).sort((a, b) => score(b) - score(a) || a.idx - b.idx).slice(0, 6);
  $("#qStep").textContent = "Tu recomendación";
  $("#qTitle").textContent = "Estos van con tu pared";
  $("#qOpts").hidden = true;
  const r = $("#qRes"); r.hidden = false;
  const col = STYLE_COL[QA.style];
  const colObj = colDe(col) || VIRTUALES.find(v => v.id === col);
  r.innerHTML = `<div class="cards">${res.map(x => card(x, { mini: true })).join("")}</div>
    <div class="quiz__actions"><a class="btn btn--light" href="/${colObj.url}/">Ver todos los de este estilo</a><button class="btn btn--line" id="qAgain">Empezar de nuevo</button></div>`;
  $("#qAgain").onclick = () => quizStep(0);
}

/* ---------- búsqueda rápida ---------- */
const sdlg = $("#search");
function openSearch() { sdlg.showModal(); $("#sq").value = ""; renderSearch(""); $("#sq").focus(); }
function renderSearch(q) {
  let list;
  if (q.trim()) list = DATA.filter(x => matches(x, q)).sort((a, b) => rank(a) - rank(b));
  else {
    const vistos = store.get("cf_vistos", []).map(s => BY[s]).filter(Boolean);
    list = vistos.length ? vistos : DATA.filter(x => x.t);
  }
  list = list.slice(0, 8);
  const head = !q.trim() ? `<p class="search__hint">${store.get("cf_vistos", []).length ? "Vistos recientemente" : "Los más pedidos"}</p>` : "";
  const cols = q.trim() ? [...COLECCIONES, ...VIRTUALES, ...CAT.ambientes].filter(c => matches({ _q: norm(c.nombre + " " + (c.h1 || "")) }, q)).slice(0, 3) : [];
  $("#sRes").innerHTML = head + cols.map(c => `<a class="s-item s-item--col" role="listitem" href="/${c.url}/"><span class="s-ico">→</span><span><b>${esc(c.h1 || c.nombre)}</b><small>Ver colección</small></span><em></em></a>`).join("") +
    (list.length ? list.map(x => `<a class="s-item" role="listitem" href="${purl(x)}">${pf(x, { thumb: true })}<span><b>${esc(x.n)}</b><small>${esc(colDe(x.c).nombre)} · ${esc(x.f)}</small></span><em>${precioTxt(x)}</em></a>`).join("")
      : `<p class="muted" style="padding:20px">Nada con “${esc(q)}”. <a class="u" href="${waLink("Hola, busco un cuadro de: " + q)}" target="_blank" rel="noopener">Pídelo por WhatsApp</a>.</p>`);
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
  $("#sq").addEventListener("input", e => renderSearch(e.target.value));
  $("#search form").addEventListener("submit", e => {
    e.preventDefault();
    const first = $("#sRes a.s-item"); if (first) return first.click();
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
  // Enlaces antiguos tipo #cuadro/slug
  const old = location.hash.match(/^#cuadro\/([a-z0-9-]+)/);
  if (old && BY[old[1]]) location.replace(purl(BY[old[1]]));
}

renderBag();
bindGeneral();
bindCatalog();
bindProduct();
bindBag();
reveal();
})();
