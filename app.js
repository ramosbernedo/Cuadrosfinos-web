/* =========================================================
   Plantify Cuadros — lógica del sitio
   Todo lo que el negocio cambia está en CONFIG y COLECCIONES.
   ========================================================= */
const CONFIG = {
  wa: "51944136347",        // WhatsApp de cuadros (todos los pedidos)
  waPapa: "51912012451",    // Cuadros del Papa: solo cotización
  precio: { pieza: 84, triptico: 149, diptico: 168, personalizar: 40 },
  dominio: "https://cuadros.plantify.pe/",
};

const COLECCIONES = [
  { id: "poder", nombre: "Poder", titulo: "Fuerza, visión y lealtad", bajada: "Animales y símbolos para la oficina de quien construye algo propio.", img: "gorila-respeto", subs: [["animales", "Animales"], ["frases", "Frases"], ["simbolos", "Símbolos"]] },
  { id: "fe", nombre: "Fe", titulo: "La fe también vive en casa", bajada: "Arte sacro en línea fina y claroscuro. Con el apellido de tu familia si quieres.", img: "manos-en-oracion", subs: [["jesus", "Jesús"], ["virgen-santos", "Virgen y santos"], ["simbolos", "Símbolos"], ["hogar", "Para el hogar"]] },
  { id: "abstracto", nombre: "Abstracto", titulo: "Textura, piedra y silencio", bajada: "Piezas que ordenan un ambiente sin gritar.", img: "arcos-terracota", subs: [["textura", "Textura y piedra"], ["minimal", "Minimalistas"], ["color", "Con color"], ["linea", "Arte en línea"]] },
  { id: "botanico", nombre: "Botánico", titulo: "Hojas, ramas y aire", bajada: "Láminas botánicas para la sala, el comedor y el dormitorio.", img: "monstera", subs: [["hojas", "Hojas tropicales"], ["laminas", "Láminas botánicas"]] },
  { id: "lugares", nombre: "Lugares", titulo: "El lugar que te hizo", bajada: "Perú, el mar y tu ciudad en un cuadro.", img: "machu-picchu-niebla", subs: [["peru", "Perú"], ["mar", "Mar y costa"], ["ciudades", "Ciudades"]] },
  { id: "cosmos", nombre: "Cosmos", titulo: "Geometría sagrada y tu cielo", bajada: "Símbolos antiguos, la luna y el cielo exacto de tu fecha.", img: "flor-de-la-vida", subs: [["geometria", "Geometría sagrada"], ["luna-cielo", "Luna y cielo"]] },
  { id: "oficio", nombre: "Oficio", titulo: "Para el despacho y el consultorio", bajada: "El regalo de graduación o de apertura que sí se cuelga.", img: "themis-justicia", subs: [["derecho", "Abogados"], ["salud", "Salud"], ["arquitectura", "Arquitectura"], ["finanzas", "Finanzas"]] },
  { id: "papa", nombre: "Papa León XIV", titulo: "La visita del Papa León XIV", bajada: "Un recuerdo de la visita del Papa al Perú: Machu Picchu, el Cusco, el mar y la selva. Cotiza por WhatsApp.", img: "papa-frente-a-machu-picchu", subs: [] },
];
const VIRTUALES = [
  { id: "top", nombre: "Más pedidos", img: "leon-fuerza", filtro: x => x.t },
  { id: "nuevos", nombre: "Nuevos", img: "tigre-en-el-agua", filtro: x => x.nw },
  { id: "personalizados", nombre: "Personalizados", img: "tu-ciudad", filtro: x => x.p },
];

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const soles = n => "S/ " + n.toLocaleString("es-PE");
const waLink = (msg, num = CONFIG.wa) => `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let toastT;
function toast(msg, action) {
  const t = $("#toast");
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button>${esc(action.label)}</button>` : "");
  if (action) t.querySelector("button").onclick = () => { t.classList.remove("is-on"); action.fn(); };
  t.classList.add("is-on");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("is-on"), 3200);
}

/* ---------- datos ---------- */
const DATA = window.CUADROS.map((x, i) => ({ ...x, idx: i }));
const BY = Object.fromEntries(DATA.map(x => [x.s, x]));
const colDe = id => COLECCIONES.find(c => c.id === id);
const subNombre = x => ((colDe(x.c)?.subs || []).find(s => s[0] === x.u) || [])[1] || "";
const piezas = x => x.o === "triptico" ? 3 : x.o === "diptico" ? 2 : 1;
const esH = x => x.o === "horizontal" || x.o === "panoramico";
const precioBase = x => x.q ? null : x.o === "triptico" ? CONFIG.precio.triptico : x.o === "diptico" ? CONFIG.precio.diptico : CONFIG.precio.pieza;
const medida = x => x.o === "triptico" ? "Tríptico 3 × (30 × 37 cm) con marco" : x.o === "diptico" ? "Díptico 2 × (30 × 37 cm) con marco" : esH(x) ? "37 × 30 cm con marco (horizontal)" : "30 × 37 cm con marco";
const searchText = x => norm([x.n, x.f, colDe(x.c)?.nombre, subNombre(x), x.a.join(" "), x.p || ""].join(" "));
DATA.forEach(x => (x._q = searchText(x)));

/* ---------- render de un cuadro enmarcado ---------- */
function pf(x, { lazy = true, scene = false } = {}) {
  const ld = lazy ? ' loading="lazy" decoding="async"' : "";
  const n = piezas(x);
  if (n > 1) {
    const inner = Array.from({ length: n }, (_, i) =>
      `<span class="pf"><img src="img/cuadros/${x.s}-${i + 1}.webp" alt="${i === 0 ? esc(x.n) : ""}"${ld}></span>`).join("");
    return scene ? inner : `<span class="set">${inner}</span>`;
  }
  const cls = "pf" + (esH(x) ? " pf--h" : "");
  if (!x.i) return `<span class="${cls}"><span class="ph"><b>${esc(x.n)}</b><i>Vista previa<br>por WhatsApp</i></span></span>`;
  return `<span class="${cls}"><img src="img/cuadros/${x.s}.webp" alt="${esc(x.n)} — cuadro en blanco y negro con marco"${ld}></span>`;
}

function card(x, { mini = false } = {}) {
  const tag = x.t ? '<span class="tag">Más pedido</span>' : x.nw ? '<span class="tag tag--ghost">Nuevo</span>' : x.p ? '<span class="tag tag--ghost">Personalizable</span>' : "";
  const price = x.q ? "Cotizar" : (x.p ? "Desde " : "") + soles(precioBase(x));
  const inBag = bag.some(b => b.s === x.s);
  return `<article class="card${mini ? "" : " rv"}" data-s="${x.s}">
    <div class="card__stage">${tag}${pf(x)}${x.q || mini ? "" : `<button class="card__add${inBag ? " is-in" : ""}" data-add="${x.s}" aria-label="${inBag ? "Ya está en tu selección" : "Agregar a mi selección"}: ${esc(x.n)}">${inBag ? "✓" : "+"}</button>`}</div>
    <h3>${esc(x.n)}</h3>${mini ? "" : `<p>${esc(x.f)}</p>`}
    <span class="card__price">${price}</span>
    <a class="card__open" href="#cuadro/${x.s}" aria-label="Ver ${esc(x.n)}"></a>
  </article>`;
}

/* ---------- reveal ---------- */
const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}), { rootMargin: "0px 0px -40px" }) : null;
function reveal(root = document) {
  $$(".rv:not(.in)", root).forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 60}ms`;
    io ? io.observe(el) : el.classList.add("in");
  });
}

/* ---------- catálogo ---------- */
const F = { col: "", sub: "", q: "", room: "", sort: "" };
const rank = x => (x.t ? 0 : 10) + (x.nw ? 0 : 3) + (x.i ? 0 : 20) + (x.c === "papa" ? 15 : 0) + x.idx / 100;

function filtered() {
  const v = VIRTUALES.find(v => v.id === F.col);
  const terms = norm(F.q).split(/\s+/).filter(Boolean);
  let list = DATA.filter(x =>
    (!F.col || (v ? v.filtro(x) : x.c === F.col)) &&
    (!F.sub || x.u === F.sub) &&
    (!F.room || x.a.includes(F.room)) &&
    terms.every(t => x._q.includes(t)));
  if (F.sort === "az") list.sort((a, b) => a.n.localeCompare(b.n, "es"));
  else if (F.sort === "nuevo") list.sort((a, b) => (b.nw ? 1 : 0) - (a.nw ? 1 : 0) || rank(a) - rank(b));
  else list.sort((a, b) => rank(a) - rank(b));
  return list;
}

function renderFilters() {
  const all = [["", "Todos", DATA.length], ...VIRTUALES.map(v => [v.id, v.nombre, DATA.filter(v.filtro).length]),
    ...COLECCIONES.map(c => [c.id, c.nombre, DATA.filter(x => x.c === c.id).length])];
  $("#colFilters").innerHTML = all.map(([id, n, k]) =>
    `<button class="chip" role="tab" data-col="${id}" aria-selected="${F.col === id}">${esc(n)}<small>${k}</small></button>`).join("");
  const c = colDe(F.col);
  $("#subFilters").innerHTML = c && c.subs.length ? [["", "Todo " + c.nombre], ...c.subs].map(([id, n]) =>
    `<button class="chip${F.sub === id ? " is-on" : ""}" data-sub="${id}">${esc(n)}</button>`).join("") : "";
}

function renderGrid() {
  const list = filtered();
  $("#grid").innerHTML = list.map(x => card(x)).join("");
  $("#empty").hidden = list.length > 0;
  $("#count").textContent = list.length === DATA.length ? `${list.length} cuadros` : `${list.length} de ${DATA.length} cuadros`;
  reveal($("#grid"));
}

function setFilter(patch, scroll) {
  Object.assign(F, patch);
  renderFilters(); renderGrid();
  if (scroll) $("#catalogo").scrollIntoView({ behavior: "smooth" });
}

function bindCatalog() {
  $("#colFilters").addEventListener("click", e => { const b = e.target.closest("[data-col]"); if (b) setFilter({ col: b.dataset.col, sub: "" }); });
  $("#subFilters").addEventListener("click", e => { const b = e.target.closest("[data-sub]"); if (b) setFilter({ sub: b.dataset.sub }); });
  let t; $("#q").addEventListener("input", e => { clearTimeout(t); t = setTimeout(() => setFilter({ q: e.target.value }), 120); });
  $("#room").addEventListener("change", e => setFilter({ room: e.target.value }));
  $("#sort").addEventListener("change", e => setFilter({ sort: e.target.value }));
  $("#clearFilters").addEventListener("click", () => { $("#q").value = ""; $("#room").value = ""; setFilter({ col: "", sub: "", q: "", room: "" }); });
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-filter-col]");
    if (b) { e.preventDefault(); setFilter({ col: b.dataset.filterCol, sub: "", q: "" }, true); }
  });
}

/* ---------- secciones fijas ---------- */
function renderStatic() {
  const rail = [...VIRTUALES, ...COLECCIONES];
  $("#colRail").innerHTML = rail.map(c => `<button data-filter-col="${c.id}"><img src="img/cuadros/${c.img}.webp" alt="" loading="lazy" width="68" height="68">${esc(c.nombre)}</button>`).join("");
  $("#topGrid").innerHTML = DATA.filter(x => x.t).sort((a, b) => a.idx - b.idx).concat(DATA.filter(x => x.nw && x.i).slice(0, 4)).map(x => card(x)).join("");
  $("#colGrid").innerHTML = COLECCIONES.map((c, i) => {
    const k = DATA.filter(x => x.c === c.id).length;
    return `<button class="col rv" data-filter-col="${c.id}">
      <span class="col__n">0${i + 1} · ${k} cuadros</span>
      <span class="col__img">${pf(BY[c.img])}</span>
      <h3>${esc(c.nombre)}</h3><p>${esc(c.bajada)}</p><small>Ver colección →</small>
    </button>`;
  }).join("");
  $("#footCols").innerHTML = COLECCIONES.map(c => `<a href="#catalogo" data-filter-col="${c.id}">${esc(c.nombre)}</a>`).join("");
  $("#year").textContent = new Date().getFullYear();
}

/* ---------- ficha del cuadro ---------- */
const P = { x: null, room: "sala", wall: "#e9e6df", tab: "obra" };
const dlg = $("#product");
const ROOM_TOP = { sala: "17%", dormitorio: "13%", oficina: "22%", comedor: "21%" };

function openProduct(slug, tab) {
  const x = BY[slug]; if (!x) return;
  P.x = x;
  const c = colDe(x.c);
  $("#pCol").textContent = `Colección ${c.nombre}${subNombre(x) && c.subs.length > 1 ? " · " + subNombre(x) : ""}`;
  $("#pTitle").textContent = x.n;
  $("#pPhrase").textContent = x.f;
  $("#pStage").innerHTML = pf(x, { lazy: false });
  $("#pSceneArt").innerHTML = pf(x, { lazy: false, scene: true });
  $("#pMeasure").textContent = x.o === "triptico" ? "≈ 98 cm de ancho" : x.o === "diptico" ? "≈ 64 cm de ancho" : esH(x) ? "37 × 30 cm" : "30 × 37 cm";
  $("#pSize").textContent = medida(x);
  $("#pRooms").textContent = x.a.map(r => r[0].toUpperCase() + r.slice(1)).join(", ");
  $("#pOrientBox").hidden = true;

  const fields = $("#pFields");
  fields.hidden = !x.p;
  $("#pFieldList").innerHTML = (x.k || []).map(([label, ph], i) =>
    `<label class="field"><span>${esc(label)}</span><input name="f${i}" data-label="${esc(label)}" placeholder="${esc(ph)}" ${/opcional/i.test(label) ? "" : "required"}></label>`).join("");

  if (x.q) {
    $("#pPrice").textContent = "Cotiza por WhatsApp";
    $("#pPriceNote").textContent = "Recuerdo de la visita del Papa: precio a consultar.";
    $("#pAdd").hidden = true;
    $("#pWa").textContent = "Cotizar por WhatsApp";
  } else {
    $("#pPrice").textContent = soles(precioBase(x) + (x.p ? CONFIG.precio.personalizar : 0));
    $("#pPriceNote").textContent = x.p ? `Incluye personalización (+ ${soles(CONFIG.precio.personalizar)}). Marco negro y envío protegido.`
      : `${medida(x)}. Listo para colgar.`;
    $("#pAdd").hidden = false;
    $("#pWa").textContent = "Pedir este por WhatsApp";
  }
  updateProductWa();
  refreshAddBtn();

  const rel = DATA.filter(y => y.c === x.c && y.s !== x.s && y.i).sort((a, b) => rank(a) - rank(b)).slice(0, 4);
  $("#pRelated").innerHTML = rel.map(y => card(y, { mini: true })).join("");
  setTab(tab || "obra");
  renderScene();
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  if (location.hash !== "#cuadro/" + slug) history.replaceState(null, "", "#cuadro/" + slug);
}

function fieldValues() {
  return $$("#pFieldList input").map(i => [i.dataset.label, i.value.trim()]);
}
function productMsg() {
  const x = P.x;
  if (x.q) return `Hola, quiero cotizar el cuadro «${x.n}» (Papa León XIV).\n${CONFIG.dominio}cuadro/${x.s}/`;
  const f = x.p ? fieldValues().filter(([, v]) => v).map(([l, v]) => `  · ${l}: ${v}`).join("\n") : "";
  return `Hola, quiero pedir este cuadro:\n• ${x.n} — ${medida(x)} — ${$("#pPrice").textContent}` + (f ? `\n${f}` : "") + `\n${CONFIG.dominio}cuadro/${x.s}/\n\n¿Me confirman el envío a mi dirección?`;
}
function updateProductWa() { $("#pWa").href = waLink(productMsg(), P.x.q ? CONFIG.waPapa : CONFIG.wa); }
function refreshAddBtn() {
  const inBag = bag.some(b => b.s === P.x.s);
  $("#pAdd").textContent = inBag && !P.x.p ? "En tu selección ✓ · Agregar otro" : "Agregar a mi selección";
}

function setTab(t) {
  P.tab = t;
  $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t));
  $("#pStage").hidden = t !== "obra";
  $("#pWall").hidden = t !== "pared";
}
function renderScene() {
  const s = $("#pScene");
  s.className = "scene scene--" + P.room;
  s.style.setProperty("--wall", P.wall);
  s.style.setProperty("--top", ROOM_TOP[P.room]);
  const dark = parseInt(P.wall.slice(1, 3), 16) < 90;
  $("#pMeasure").style.cssText = dark ? "color:rgba(255,255,255,.7);background:rgba(0,0,0,.4)" : "";
  $$("#sceneRoom button").forEach(b => b.setAttribute("aria-checked", b.dataset.v === P.room));
}

function bindProduct() {
  document.addEventListener("click", e => {
    const add = e.target.closest("[data-add]");
    if (add) { e.preventDefault(); e.stopPropagation(); addToBag(add.dataset.add); return; }
    const o = e.target.closest("[data-open]");
    if (o) { e.preventDefault(); openProduct(o.dataset.open, o.dataset.tab); return; }
    const a = e.target.closest('a[href^="#cuadro/"]');
    if (a) { e.preventDefault(); closeSearch(); openProduct(a.getAttribute("href").slice(8)); }
  });
  $$(".tabs button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("#sceneRoom").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) { P.room = b.dataset.v; renderScene(); } });
  $("#wallColors").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    P.wall = getComputedStyle(b).getPropertyValue("--c").trim();
    $$("#wallColors button").forEach(x => x.classList.toggle("is-on", x === b)); renderScene();
  });
  $("#wallPick").addEventListener("input", e => { P.wall = e.target.value; $$("#wallColors button").forEach(x => x.classList.remove("is-on")); renderScene(); });
  $("#pFields").addEventListener("input", updateProductWa);
  $("#pFields").addEventListener("submit", e => e.preventDefault());
  $("#pAdd").addEventListener("click", () => {
    if (P.x.p) {
      const missing = $$("#pFieldList input[required]").find(i => !i.value.trim());
      if (missing) { missing.focus(); toast("Completa los datos para personalizar"); return; }
    }
    addToBag(P.x.s, P.x.p ? fieldValues().filter(([, v]) => v) : null);
    refreshAddBtn();
  });
  $("#pWa").addEventListener("click", e => {
    if (P.x.p && $$("#pFieldList input[required]").some(i => !i.value.trim())) {
      e.preventDefault(); $$("#pFieldList input[required]").find(i => !i.value.trim()).focus();
      toast("Completa los datos para personalizar");
    }
  });
  $("#pShare").addEventListener("click", async () => {
    const url = location.href.split("#")[0] + "#cuadro/" + P.x.s;
    try { if (navigator.share) await navigator.share({ title: P.x.n, url }); else { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } } catch {}
  });
  dlg.addEventListener("close", () => { if (location.hash.startsWith("#cuadro/")) history.replaceState(null, "", location.pathname + location.search); });
}

/* ---------- selección (carrito por WhatsApp) ---------- */
let bag = store.get("pc_bag", []).filter(b => BY[b.s] && !BY[b.s].q);
const unit = b => precioBase(BY[b.s]) + (b.f && b.f.length ? CONFIG.precio.personalizar : 0);
function saveBag() { store.set("pc_bag", bag); renderBag(); }
function addToBag(s, f = null) {
  const x = BY[s]; if (!x || x.q) return;
  if (x.p && !f) { openProduct(s); toast("Escribe los datos para personalizarlo"); return; }
  const key = JSON.stringify(f);
  const ex = bag.find(b => b.s === s && JSON.stringify(b.f) === key);
  ex ? ex.qty++ : bag.push({ s, f, qty: 1 });
  saveBag();
  $$(`[data-add="${s}"]`).forEach(b => { b.classList.add("is-in"); b.textContent = "✓"; });
  const badge = $("#bagCount"); badge.classList.remove("pop"); void badge.offsetWidth; badge.classList.add("pop");
  toast(`«${x.n}» está en tu selección`, { label: "Ver selección", fn: openBag });
}
function renderBag() {
  const n = bag.reduce((a, b) => a + b.qty, 0);
  const badge = $("#bagCount"); badge.hidden = !n; badge.textContent = n;
  const total = bag.reduce((a, b) => a + unit(b) * b.qty, 0);
  $("#bagTotal").textContent = soles(total);
  $("#bagFoot").hidden = !n;
  $("#bagList").innerHTML = n ? bag.map((b, i) => {
    const x = BY[b.s];
    const f = b.f && b.f.length ? b.f.map(([l, v]) => `${esc(l)}: ${esc(v)}`).join(" · ") : medida(x);
    return `<div class="bag-item">
      <a href="#cuadro/${x.s}">${pf(x)}</a>
      <div><h3>${esc(x.n)}</h3><p>${f}</p>
        <div class="qty" style="margin-top:8px;width:max-content"><button data-q="${i}" data-d="-1" aria-label="Quitar uno">−</button><span>${b.qty}</span><button data-q="${i}" data-d="1" aria-label="Agregar uno">+</button></div></div>
      <div class="bag-item__r"><strong>${soles(unit(b) * b.qty)}</strong><button class="rm" data-rm="${i}">Quitar</button></div>
    </div>`;
  }).join("") : `<div class="bag-empty"><p>Aún no guardas cuadros.</p><p class="muted small">Toca “+” en cualquier cuadro para armar tu selección y pedir todo en un solo mensaje.</p><a href="#catalogo" class="btn btn--line" data-close-bag>Ver cuadros</a></div>`;
  const lines = bag.map(b => {
    const x = BY[b.s];
    const f = b.f && b.f.length ? "\n" + b.f.map(([l, v]) => `    · ${l}: ${v}`).join("\n") : "";
    return `• ${b.qty} × ${x.n} (${medida(x)}) — ${soles(unit(b) * b.qty)}${f}`;
  });
  $("#bagWa").href = waLink(`Hola, quiero pedir estos cuadros:\n${lines.join("\n")}\n\nTotal: ${soles(total)}\n¿Me confirman el envío a mi dirección?`);
}
const drawer = $("#bag");
function openBag() { if (dlg.open) dlg.close(); drawer.setAttribute("aria-hidden", "false"); document.body.style.overflow = "hidden"; setTimeout(() => $("[data-close-bag]", drawer).focus(), 50); }
function closeBag() { drawer.setAttribute("aria-hidden", "true"); document.body.style.overflow = ""; }
function bindBag() {
  $("#openBag").addEventListener("click", openBag);
  drawer.addEventListener("click", e => {
    const q = e.target.closest("[data-q]");
    if (q) { const b = bag[+q.dataset.q]; b.qty += +q.dataset.d; if (b.qty < 1) bag.splice(+q.dataset.q, 1); saveBag(); syncAddButtons(); return; }
    const rm = e.target.closest("[data-rm]");
    if (rm) { bag.splice(+rm.dataset.rm, 1); saveBag(); syncAddButtons(); return; }
    if (e.target.closest("[data-close-bag]") || e.target.closest('a[href^="#cuadro/"]')) closeBag();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && drawer.getAttribute("aria-hidden") === "false") closeBag(); });
}
function syncAddButtons() {
  $$("[data-add]").forEach(b => { const on = bag.some(x => x.s === b.dataset.add); b.classList.toggle("is-in", on); b.textContent = on ? "✓" : "+"; });
}

/* ---------- ayúdame a elegir ---------- */
const QUIZ = [
  { t: "¿Para qué pared es?", k: "room", o: [["sala", "Sala", "Sobre el sofá o el aparador"], ["dormitorio", "Dormitorio", "Sobre la cama o la cómoda"], ["oficina", "Oficina", "Despacho, consultorio o escritorio"], ["comedor", "Comedor", "Junto a la mesa"]] },
  { t: "¿Qué quieres que diga?", k: "style", o: [["poder", "Fuerza", "Animales, ambición y disciplina"], ["fe", "Fe", "Arte sacro y bendiciones"], ["calma", "Calma", "Abstractos y botánicos"], ["lugares", "Lugares", "Perú, el mar, el cielo"], ["oficio", "Mi profesión", "Abogados, salud, arquitectura"], ["pers", "Algo solo mío", "Con nombre, fecha o ciudad"]] },
  { t: "¿Una pieza o un conjunto?", k: "fmt", o: [["uno", "Una pieza", "S/ 84 · 30 × 37 cm"], ["set", "Tríptico", "S/ 149 · ≈ 98 cm de ancho"], ["any", "Me da igual", "Muéstrame lo mejor"]] },
];
const STYLE = { poder: x => x.c === "poder", fe: x => x.c === "fe" || x.c === "papa", calma: x => x.c === "abstracto" || x.c === "botanico", lugares: x => x.c === "lugares" || x.c === "cosmos", oficio: x => x.c === "oficio", pers: x => !!x.p };
let QA = {};
const quiz = $("#quiz");
function openQuiz() { QA = {}; quizStep(0); quiz.showModal(); }
function quizStep(i) {
  $("#qRes").hidden = true; $("#qOpts").hidden = false;
  const q = QUIZ[i];
  $("#qStep").textContent = `Paso ${i + 1} de ${QUIZ.length}`;
  $("#qTitle").textContent = q.t;
  $("#qOpts").innerHTML = q.o.map(([v, n, d]) => `<button class="quiz__opt" data-v="${v}"><strong>${n}</strong><span>${d}</span></button>`).join("");
  $("#qOpts").onclick = e => { const b = e.target.closest("[data-v]"); if (!b) return; QA[q.k] = b.dataset.v; i + 1 < QUIZ.length ? quizStep(i + 1) : quizResult(); };
}
function quizResult() {
  const score = x => (x.a.includes(QA.room) ? 4 : 0) + (STYLE[QA.style](x) ? 8 : 0) +
    (QA.fmt === "set" ? (piezas(x) > 1 ? 5 : 0) : QA.fmt === "uno" ? (piezas(x) === 1 ? 2 : -4) : 0) + (x.t ? 2 : 0) + (x.i ? 3 : -10) + (x.q ? -3 : 0);
  const res = DATA.filter(x => STYLE[QA.style](x)).sort((a, b) => score(b) - score(a) || a.idx - b.idx).slice(0, 6);
  $("#qStep").textContent = "Tu selección";
  $("#qTitle").textContent = "Estos van con tu pared";
  $("#qOpts").hidden = true;
  const r = $("#qRes"); r.hidden = false;
  r.innerHTML = `<div class="cards">${res.map(x => card(x, { mini: true })).join("")}</div>
    <div class="quiz__actions"><button class="btn btn--light" id="qAll">Ver todos los de este estilo</button><button class="btn btn--line" id="qAgain">Empezar de nuevo</button></div>`;
  $("#qAgain").onclick = () => { QA = {}; quizStep(0); };
  $("#qAll").onclick = () => {
    quiz.close();
    const map = { poder: "poder", fe: "fe", calma: "abstracto", lugares: "lugares", oficio: "oficio", pers: "personalizados" };
    $("#room").value = QA.room;
    setFilter({ col: map[QA.style], sub: "", q: "", room: QA.room }, true);
  };
  r.onclick = e => { if (e.target.closest('a[href^="#cuadro/"]')) quiz.close(); };
}

/* ---------- búsqueda rápida ---------- */
const sdlg = $("#search");
function openSearch() { sdlg.showModal(); $("#sq").value = ""; renderSearch(""); $("#sq").focus(); }
function closeSearch() { if (sdlg.open) sdlg.close(); }
function renderSearch(q) {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  const list = (terms.length ? DATA.filter(x => terms.every(t => x._q.includes(t))) : DATA.filter(x => x.t)).sort((a, b) => rank(a) - rank(b)).slice(0, 8);
  $("#sRes").innerHTML = list.length ? list.map(x => `<a class="s-item" href="#cuadro/${x.s}">${pf(x)}<span><b>${esc(x.n)}</b><small>${esc(colDe(x.c).nombre)} · ${esc(x.f)}</small></span><em>${x.q ? "Cotizar" : soles(precioBase(x))}</em></a>`).join("")
    : `<p class="muted" style="padding:20px">Nada con “${esc(q)}”. <a class="u" href="${waLink("Hola, busco un cuadro de: " + q)}" target="_blank" rel="noopener">Pídelo por WhatsApp</a>.</p>`;
}

/* ---------- general ---------- */
function bindGeneral() {
  const nav = $("#nav"), tog = $("#navToggle");
  tog.addEventListener("click", () => { const o = nav.classList.toggle("open"); tog.setAttribute("aria-expanded", o); });
  $$(".nav__links a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("open"); tog.setAttribute("aria-expanded", "false"); }));
  $$("[data-wa]").forEach(a => { a.href = waLink(a.dataset.wa); a.target = "_blank"; a.rel = "noopener"; });
  document.addEventListener("click", e => { if (e.target.closest("[data-open-quiz]")) { e.preventDefault(); openQuiz(); } });
  $$("dialog").forEach(d => {
    d.addEventListener("click", e => { if (e.target === d || e.target.closest("[data-close]")) d.close(); });
  });
  $("#openSearch").addEventListener("click", openSearch);
  $("#sq").addEventListener("input", e => renderSearch(e.target.value));
  $("#sq").addEventListener("keydown", e => { if (e.key === "Enter") { const a = $("#sRes a.s-item"); if (a) a.click(); } });
  document.addEventListener("keydown", e => {
    if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) { e.preventDefault(); openSearch(); }
  });
  const route = () => { const m = location.hash.match(/^#cuadro\/([a-z0-9-]+)/); if (m && BY[m[1]]) openProduct(m[1]); };
  addEventListener("hashchange", route);
  route();
}

renderStatic();
renderFilters();
renderGrid();
renderBag();
bindCatalog();
bindProduct();
bindBag();
bindGeneral();
reveal();
