// Utilidades del servidor (Cloudflare Pages Functions): respuestas, sesiones y contraseñas.

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const error = (msg, status = 400) => json({ ok: false, error: msg }, status);

const enc = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
export const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
export const sha256 = async s => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
export const randomId = (n = 16) => hex(crypto.getRandomValues(new Uint8Array(n)));

// ---------- contraseñas (PBKDF2-SHA256, 100 000 iteraciones) ----------
export async function hashPassword(password, salHex = randomId(16)) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salHex), iterations: 100000 }, key, 256);
  return { hash: hex(bits), sal: salHex };
}
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ---------- sesiones firmadas (cookie HttpOnly) ----------
const COOKIE = "cf_admin";
const DIAS = 14;
async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function crearSesion(env, usuario) {
  const payload = b64u(enc.encode(JSON.stringify({ e: usuario.email, n: usuario.nombre || "", r: usuario.rol, x: Date.now() + DIAS * 864e5 })));
  const sig = b64u(await crypto.subtle.sign("HMAC", await hmacKey(env.SESSION_SECRET), enc.encode(payload)));
  return `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DIAS * 86400}`;
}
export const cerrarSesion = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export async function leerSesion(request, env) {
  if (!env.SESSION_SECRET) return null;
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, sig] = m[1].split(".");
  if (!payload || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env.SESSION_SECRET), fromB64u(sig), enc.encode(payload));
    if (!ok) return null;
    const d = JSON.parse(new TextDecoder().decode(fromB64u(payload)));
    if (d.x < Date.now()) return null;
    return { email: d.e, nombre: d.n, rol: d.r };
  } catch { return null; }
}

// ---------- validación ----------
export const txt = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : v == null ? null : String(v).slice(0, max)) || null;
export const num = (v, min = 0, max = 1e6) => { const n = Number(v); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null; };
export const ESTADOS = ["nuevo", "confirmado", "pagado", "produccion", "listo", "enviado", "entregado", "cancelado"];
export const ESTADO_NOMBRE = { nuevo: "Nuevo", confirmado: "Confirmado", pagado: "Pagado", produccion: "En producción", listo: "Listo", enviado: "Enviado", entregado: "Entregado", cancelado: "Cancelado" };
export const CODIGO_RE = /^CF-[2-9A-Z]{4,8}$/;

// Origen permitido para los endpoints públicos (evita que otros sitios escriban en la base)
export function mismoOrigen(request) {
  const o = request.headers.get("origin");
  if (!o) return true; // sendBeacon desde el mismo sitio puede no enviar Origin
  try { return new URL(o).host === new URL(request.url).host; } catch { return false; }
}
export const sinDB = env => !env.DB;
