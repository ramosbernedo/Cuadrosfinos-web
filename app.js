/* ===== Configuración del negocio — edita aquí ===== */
const WHATSAPP = "51999999999"; // Número con código de país, sin "+" ni espacios

const FRAMES = [
  { id: "black",  name: "Negro mate",    note: "Moderno",     factor: 1.00, sw: "linear-gradient(145deg,#2a2826,#121110)" },
  { id: "oak",    name: "Roble natural", note: "Cálido",      factor: 1.10, sw: "linear-gradient(145deg,#d8b388,#b48659)" },
  { id: "walnut", name: "Nogal",         note: "Premium",     factor: 1.25, sw: "linear-gradient(145deg,#7a5235,#4a2e1b)" },
  { id: "white",  name: "Blanco",        note: "Nórdico",     factor: 1.00, sw: "linear-gradient(145deg,#fdfcf9,#e5e0d6)" },
  { id: "gold",   name: "Dorado clásico",note: "Elegante",    factor: 1.35, sw: "linear-gradient(145deg,#f0d28e,#a8782c)" },
  { id: "float",  name: "Flotante",      note: "Sin paspartú",factor: 1.15, sw: "linear-gradient(145deg,#444,#111)" },
];
const SIZES = [
  { id: "20x30", w: 20, h: 30, base: 79,  ph: 38 },
  { id: "30x40", w: 30, h: 40, base: 119, ph: 48 },
  { id: "40x60", w: 40, h: 60, base: 179, ph: 58 },
  { id: "50x70", w: 50, h: 70, base: 239, ph: 64 },
  { id: "60x90", w: 60, h: 90, base: 329, ph: 70 },
];
const CATALOG = [
  { name: "Atardecer en Paracas", cat: "naturaleza", art: "sunset",  frame: "walnut", price: 149 },
  { name: "Botánica I",           cat: "naturaleza", art: "botanic", frame: "oak",    price: 129 },
  { name: "Ritmo",                cat: "abstracto",  art: "lines",   frame: "black",  price: 119 },
  { name: "Pacífico",             cat: "naturaleza", art: "ocean",   frame: "white",  price: 139 },
  { name: "Cordillera Blanca",    cat: "peru",       art: "andes",   frame: "gold",   price: 169 },
  { name: "Arcilla",              cat: "abstracto",  art: "clay",    frame: "oak",    price: 129 },
  { name: "Luna de Cusco",        cat: "peru",       art: "moon",    frame: "black",  price: 139 },
  { name: "Dunas de Huacachina",  cat: "peru",       art: "dunes",   frame: "walnut", price: 159 },
  { name: "Composición 04",       cat: "minimal",    art: "grid",    frame: "white",  price: 119 },
  { name: "Machu Picchu",         cat: "peru",       art: "machu",   frame: "oak",    price: 169 },
  { name: "Arco",                 cat: "minimal",    art: "arch",    frame: "black",  price: 119 },
  { name: "Silencio",             cat: "minimal",    art: "moon",    frame: "gold",   price: 149 },
];

/* ===== Utilidades ===== */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const soles = n => "S/ " + Math.round(n).toLocaleString("es-PE");
const waLink = msg => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("is-on");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("is-on"), 2600);
}

/* ===== Estado del configurador ===== */
const state = { frame: "walnut", size: "30x40", orient: "v", art: "sunset", image: null, mat: true, glass: false, gift: false, qty: 1 };

function renderOptions() {
  $("#frameOptions").innerHTML = FRAMES.map(f => `
    <button type="button" class="chip" data-frame="${f.id}" aria-pressed="false">
      <span class="chip__sw" style="background:${f.sw}"></span>
      <span>${f.name}<small>${f.note}</small></span>
    </button>`).join("");
  $("#sizeOptions").innerHTML = SIZES.map(s => `
    <button type="button" class="chip chip--size" data-size="${s.id}" aria-pressed="false">
      <span>${s.w}×${s.h} cm<small>desde ${soles(s.base)}</small></span>
    </button>`).join("");
}

function price() {
  const s = SIZES.find(x => x.id === state.size), f = FRAMES.find(x => x.id === state.frame);
  let p = s.base * f.factor;
  if (state.mat && state.frame !== "float") p += 25;
  if (state.glass) p *= 1.3;
  if (state.gift) p += 15;
  return Math.round(p) * state.qty;
}

function update() {
  const s = SIZES.find(x => x.id === state.size), f = FRAMES.find(x => x.id === state.frame);
  const frame = $("#previewFrame"), mat = $("#previewMat"), art = $("#previewArt"), wrap = $("#previewWrap");
  frame.className = `frame frame--${f.id}`;
  frame.style.setProperty("--fw", `${8 + s.w / 6}px`);
  const showMat = state.mat && f.id !== "float";
  mat.classList.toggle("no-mat", !showMat);
  $("#optMat").disabled = f.id === "float";
  const [w, h] = state.orient === "v" ? [s.w, s.h] : [s.h, s.w];
  wrap.style.setProperty("--ar", `${w}/${h}`);
  wrap.style.setProperty("--ph", `${state.orient === "v" ? s.ph : s.ph * 0.75}%`);
  if (state.image) { art.className = "art"; art.style.backgroundImage = `url(${state.image})`; }
  else { art.className = `art art--${state.art}`; art.style.backgroundImage = ""; }

  $$("#frameOptions .chip").forEach(b => { const on = b.dataset.frame === state.frame; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
  $$("#sizeOptions .chip").forEach(b => { const on = b.dataset.size === state.size; b.classList.toggle("is-active", on); b.setAttribute("aria-pressed", on); });
  $$(".orient button").forEach(b => b.setAttribute("aria-checked", b.dataset.orient === state.orient));
  $$("#sampleArts button").forEach(b => b.classList.toggle("is-active", !state.image && b.dataset.art === state.art));

  const el = $("#price"); el.textContent = soles(price());
  el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
  $("#qty").textContent = state.qty;
  $("#summaryText").textContent = `${f.name} · ${w}×${h} cm${showMat ? " · paspartú" : ""}${state.glass ? " · vidrio museo" : ""}`;
}

function bindConfigurator() {
  $("#frameOptions").addEventListener("click", e => { const b = e.target.closest("[data-frame]"); if (b) { state.frame = b.dataset.frame; update(); } });
  $("#sizeOptions").addEventListener("click", e => { const b = e.target.closest("[data-size]"); if (b) { state.size = b.dataset.size; update(); } });
  $$(".orient button").forEach(b => b.addEventListener("click", () => { state.orient = b.dataset.orient; update(); }));
  $("#sampleArts").addEventListener("click", e => { const b = e.target.closest("[data-art]"); if (b) { state.art = b.dataset.art; state.image = null; update(); } });
  $("#optMat").addEventListener("change", e => { state.mat = e.target.checked; update(); });
  $("#optGlass").addEventListener("change", e => { state.glass = e.target.checked; update(); });
  $("#optGift").addEventListener("change", e => { state.gift = e.target.checked; update(); });
  $("#qtyMinus").addEventListener("click", () => { state.qty = Math.max(1, state.qty - 1); update(); });
  $("#qtyPlus").addEventListener("click", () => { state.qty = Math.min(20, state.qty + 1); update(); });

  const upload = $(".upload"), input = $("#upload");
  const load = file => {
    if (!file || !file.type.startsWith("image/")) return toast("Elige un archivo de imagen");
    const r = new FileReader();
    r.onload = () => {
      state.image = r.result;
      const img = new Image();
      img.onload = () => { state.orient = img.width > img.height ? "h" : "v"; update(); toast("¡Imagen cargada! Ajustamos la orientación."); };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };
  input.addEventListener("change", () => load(input.files[0]));
  ["dragenter", "dragover"].forEach(ev => upload.addEventListener(ev, e => { e.preventDefault(); upload.classList.add("is-drag"); }));
  ["dragleave", "drop"].forEach(ev => upload.addEventListener(ev, e => { e.preventDefault(); upload.classList.remove("is-drag"); }));
  upload.addEventListener("drop", e => load(e.dataTransfer.files[0]));

  $$(".room-switch button").forEach(b => b.addEventListener("click", () => {
    $("#room").dataset.room = b.dataset.room;
    $$(".room-switch button").forEach(x => x.setAttribute("aria-checked", x === b));
  }));

  $("#configForm").addEventListener("submit", e => {
    e.preventDefault();
    const s = SIZES.find(x => x.id === state.size), f = FRAMES.find(x => x.id === state.frame);
    const [w, h] = state.orient === "v" ? [s.w, s.h] : [s.h, s.w];
    const lines = [
      "Hola Cuadros Finos 👋, quiero este cuadro:",
      `• Moldura: ${f.name}`,
      `• Tamaño: ${w}×${h} cm (${state.orient === "v" ? "vertical" : "horizontal"})`,
      `• Paspartú: ${state.mat && f.id !== "float" ? "Sí" : "No"}`,
      `• Vidrio museo: ${state.glass ? "Sí" : "No"}`,
      `• Empaque regalo: ${state.gift ? "Sí" : "No"}`,
      `• Cantidad: ${state.qty}`,
      `• Imagen: ${state.image ? "la envío a continuación" : "obra de muestra «" + state.art + "»"}`,
      `Total estimado: ${soles(price())}`,
    ];
    window.open(waLink(lines.join("\n")), "_blank", "noopener");
  });
}

/* ===== Catálogo ===== */
function renderCatalog() {
  $("#catalog").innerHTML = CATALOG.map(p => `
    <article class="card reveal" data-cat="${p.cat}">
      <div class="card__stage"><div class="frame frame--${p.frame}"><div class="mat"><div class="art art--${p.art}"></div></div></div></div>
      <h3>${p.name}</h3>
      <p>Impresión giclée · 30×40 cm</p>
      <div class="card__row">
        <span class="card__price">${soles(p.price)}</span>
        <a class="card__btn" href="${waLink(`Hola Cuadros Finos, me interesa el cuadro «${p.name}» (${soles(p.price)}).`)}" target="_blank" rel="noopener">Lo quiero</a>
      </div>
    </article>`).join("");
  $$(".filters button").forEach(b => b.addEventListener("click", () => {
    $$(".filters button").forEach(x => x.setAttribute("aria-selected", x === b));
    $$("#catalog .card").forEach(c => c.classList.toggle("is-hidden", b.dataset.filter !== "all" && c.dataset.cat !== b.dataset.filter));
  }));
}

/* ===== UI general ===== */
function bindUI() {
  const nav = $(".nav"), tog = $(".nav__toggle");
  addEventListener("scroll", () => nav.classList.toggle("is-scrolled", scrollY > 10), { passive: true });
  tog.addEventListener("click", () => { const o = nav.classList.toggle("is-open"); tog.setAttribute("aria-expanded", o); });
  $$(".nav__links a").forEach(a => a.addEventListener("click", () => { nav.classList.remove("is-open"); tog.setAttribute("aria-expanded", false); }));
  $$("[data-wa]").forEach(a => { a.href = waLink(a.dataset.wa); a.target = "_blank"; a.rel = "noopener"; });
  $("#year").textContent = new Date().getFullYear();

  const io = "IntersectionObserver" in window && new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  $$(".reveal").forEach((el, i) => { el.style.transitionDelay = `${(i % 4) * 70}ms`; io ? io.observe(el) : el.classList.add("is-in"); });
}

renderOptions();
renderCatalog();
bindConfigurator();
bindUI();
update();
