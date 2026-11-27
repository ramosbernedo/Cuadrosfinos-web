/* =========================================================
   Cuadros Finos — medición (Google Analytics 4, Píxel de Meta, Microsoft Clarity)
   Los IDs van en data/catalogo.json → config.medicion. Sin IDs no se carga nada.
   Modo prueba: agrega ?medir=debug a cualquier URL y verás cada evento en la consola.
   ========================================================= */
(() => {
"use strict";
const CFG = (window.CATALOGO && window.CATALOGO.config.medicion) || {};
const IDS = { ga4: (CFG.ga4 || "").trim(), meta: (CFG.metaPixel || "").trim(), clarity: (CFG.clarity || "").trim() };
const ANY = IDS.ga4 || IDS.meta || IDS.clarity;
const store = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
const qs = new URLSearchParams(location.search);
if (qs.get("medir") === "debug") store.set("cf_medir_debug", "1");
if (qs.get("medir") === "off") store.set("cf_medir_debug", "");
const DEBUG = store.get("cf_medir_debug") === "1";
const log = [];
window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }
window.gtag = window.gtag || gtag;

// ---------- Origen de la visita (UTM / referencia) para atribuir pedidos ----------
const ORIGEN_KEY = "cf_origen";
(() => {
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "gclid", "fbclid"].reduce((o, k) => (qs.get(k) && (o[k] = qs.get(k)), o), {});
  if (Object.keys(utm).length) store.set(ORIGEN_KEY, JSON.stringify({ ...utm, fecha: new Date().toISOString().slice(0, 10) }));
  else if (!store.get(ORIGEN_KEY) && document.referrer && !document.referrer.startsWith(location.origin)) {
    try { store.set(ORIGEN_KEY, JSON.stringify({ utm_source: new URL(document.referrer).hostname, utm_medium: "referencia", fecha: new Date().toISOString().slice(0, 10) })); } catch {}
  }
})();
const origen = () => { try { return JSON.parse(store.get(ORIGEN_KEY) || "{}"); } catch { return {}; } };

// ---------- Consentimiento (Ley 29733) ----------
const CONSENT_KEY = "cf_consent";
const consent = () => store.get(CONSENT_KEY);   // "si" | "no" | null
gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 });

function loadScript(src) { const s = document.createElement("script"); s.async = true; s.src = src; document.head.append(s); return s; }
let metaReady = false, clarityReady = false;
function startProviders() {
  const ok = consent() === "si";
  if (ok) gtag("consent", "update", { analytics_storage: "granted", ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  if (IDS.meta && ok && !metaReady) {
    metaReady = true;
    /* Píxel de Meta (código oficial) */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", IDS.meta); window.fbq("track", "PageView");
  }
  if (IDS.clarity && ok && !clarityReady) {
    clarityReady = true;
    (function (c, l, a, r, i, t, y) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); }; t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y); })(window, document, "clarity", "script", IDS.clarity);
  }
}
if (IDS.ga4) {
  loadScript("https://www.googletagmanager.com/gtag/js?id=" + IDS.ga4);
  gtag("js", new Date());
  gtag("config", IDS.ga4, { currency: "PEN", ...(DEBUG ? { debug_mode: true } : {}) });
}
startProviders();

function banner() {
  if (!ANY || consent()) return;
  const b = document.createElement("div");
  b.className = "consent"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Cookies");
  b.innerHTML = '<p>Usamos cookies para entender qué cuadros te interesan y mejorar la tienda. ¿Nos das permiso?</p><div><button class="btn btn--sm btn--line" data-c="no">No, gracias</button><button class="btn btn--sm btn--light" data-c="si">Aceptar</button></div>';
  b.addEventListener("click", e => { const c = e.target.closest("[data-c]"); if (!c) return; store.set(CONSENT_KEY, c.dataset.c); b.remove(); startProviders(); track("consentimiento", { respuesta: c.dataset.c }); });
  document.body.append(b);
}
document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", banner) : banner();

// ---------- Eventos ----------
// Nombres de GA4 (recomendados para comercio) → equivalentes de Meta
const META = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", generate_lead: "Lead", search: "Search", contacto_whatsapp: "Contact", add_payment_info: "AddPaymentInfo" };
function track(name, params = {}) {
  const p = { ...params };
  log.push({ name, ...p, t: Date.now() });
  window.dataLayer.push({ event: name, ...p });
  if (IDS.ga4) gtag("event", name, p);
  if (IDS.meta && metaReady && window.fbq) {
    const m = META[name], mp = {};
    if (p.value != null) { mp.value = p.value; mp.currency = "PEN"; }
    if (p.items) { mp.content_ids = p.items.map(i => i.item_id); mp.content_type = "product"; mp.contents = p.items.map(i => ({ id: i.item_id, quantity: i.quantity || 1 })); }
    if (p.search_term) mp.search_string = p.search_term;
    m ? window.fbq("track", m, mp) : window.fbq("trackCustom", name, mp);
  }
  if (IDS.clarity && clarityReady && window.clarity) window.clarity("event", name);
  propio(name, p);
  if (DEBUG) console.log("%c[medición] " + name, "color:#25d366;font-weight:600", p);
}
// ---------- Medición propia → panel (/api/ev), por lotes y sin cookies ----------
const PROPIOS = new Set(["page_view", "view_item", "select_item", "ver_pared", "ver_foto", "personalizar", "add_to_cart",
  "remove_from_cart", "view_cart", "add_shipping_info", "add_payment_info", "begin_checkout", "generate_lead", "search", "share", "contacto_whatsapp",
  "ayuda_inicio", "ayuda_resultado", "filtrar", "zoom"]);
const sid = (() => { try { let v = sessionStorage.getItem("cf_sid"); if (!v) { v = Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4); sessionStorage.setItem("cf_sid", v); } return v; } catch { return "s" + Math.random().toString(36).slice(2, 10); } })();
let cola = [], colaT = null;
function enviarCola() {
  if (!cola.length) return;
  const body = JSON.stringify(cola.splice(0, 25)); clearTimeout(colaT); colaT = null;
  try { if (!(navigator.sendBeacon && navigator.sendBeacon("/api/ev", new Blob([body], { type: "application/json" })))) fetch("/api/ev", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {}); } catch {}
}
addEventListener("pagehide", enviarCola);
document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && enviarCola());
function propio(name, p) {
  if (!PROPIOS.has(name) || DEBUG && qs.get("medir") === "debug-sin-panel") return;
  const o = origen();
  cola.push({ n: name, s: p.item_id || (p.items && p.items[0] && p.items[0].item_id) || null, v: name === "search" ? (p.resultados ?? null) : (p.value ?? null), t: p.search_term || p.method || null,
    sid, p: location.pathname, fu: o.utm_source || null, me: o.utm_medium || null, ca: o.utm_campaign || null });
  if (cola.length >= 10 || /^(page_view|view_item|add_to_cart|view_cart|begin_checkout|generate_lead)$/.test(name)) { clearTimeout(colaT); colaT = setTimeout(enviarCola, 60); }
  else if (!colaT) colaT = setTimeout(enviarCola, 2500);
}
// Registra el pedido en el panel (se llama al tocar «Enviar por WhatsApp»)
function pedido(datos) {
  const body = JSON.stringify({ ...datos, origen: origen() });
  try { if (!(navigator.sendBeacon && navigator.sendBeacon("/api/pedido", new Blob([body], { type: "application/json" })))) fetch("/api/pedido", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {}); } catch {}
}

// Código corto para relacionar el chat de WhatsApp con la visita (sin 0/O/1/I)
function codigo() {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; let c = "";
  for (let i = 0; i < 4; i++) c += A[Math.floor(Math.random() * A.length)];
  return "CF-" + c;
}
window.CFTrack = { track, codigo, origen, pedido, log, debug: DEBUG };
// Visita de página para el embudo del panel
track("page_view", { page_location: location.pathname });
})();
