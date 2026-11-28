// Mapa de «Tu ciudad»: lugar → límites y coordenadas (Nominatim) → calles (Overpass) → trazos SVG para el cuadro 600 × 780.
// - Ciudad sin límites (Lima, Arequipa…): la ciudad entera con sus avenidas, como el cuadro de muestra.
// - Lugar con límites (Miraflores, Barranco, París…): el lugar delimitado y con todas sus calles; alrededor, solo avenidas y más tenue.
// Lo usan /api/mapa (servidor, functions/api/mapa.js) y el respaldo del celular (personaliza.js).

export const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const ANCHO = { motorway: 4.2, trunk: 3.8, primary: 3.2, secondary: 2.5, tertiary: 1.9, unclassified: 1.1, residential: 1.0, living_street: .9, pedestrian: .9 };
const CLASES = ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential", "living_street", "pedestrian"];
const hasta = c => CLASES.slice(0, CLASES.indexOf(c) + 1).join("|");
const M_LAT = 110540, mLon = lat => 111320 * Math.cos(lat * Math.PI / 180);

const conTiempo = (url, op, ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { ...op, signal: c.signal }).finally(() => clearTimeout(t)); };

// Tamaño del cuadro (medio ancho, en metros) para ciudades sin límites dibujables: según su población
function radioCiudad(tipo, poblacion) {
  if (poblacion >= 3e6) return 10000;
  if (poblacion >= 5e5) return 6000;
  if (poblacion >= 1e5) return 4000;
  if (poblacion > 0) return 2500;
  return /^(city|state|county|state_district|province|region)$/.test(tipo) ? 5000 : /^(town|municipality)$/.test(tipo) ? 3000 : 1500;
}

export async function buscarLugar(q, headers = {}) {
  const u = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&extratags=1&polygon_geojson=1&polygon_threshold=0.0003&accept-language=es&q=" + encodeURIComponent(q);
  const r = await conTiempo(u, { headers: { Accept: "application/json", ...headers } }, 9000);
  if (!r.ok) throw new Error("lugar HTTP " + r.status);
  const j = await r.json(); if (!j.length) throw new Error("no encontrado");
  const x = j[0], tipo = x.addresstype || x.type, g = x.geojson || {};
  const base = { nombre: x.name, pais: (x.address || {}).country || "" };
  const anillos = g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : null;
  if (anillos && anillos.length) {
    // Encuadra el lugar entero: centro de sus límites y tamaño para que entre con margen (arriba del nombre)
    let a = 90, b = -90, c = 180, d = -180;
    for (const ring of anillos) for (const [lo, la] of ring) { if (la < a) a = la; if (la > b) b = la; if (lo < c) c = lo; if (lo > d) d = lo; }
    const lat = (a + b) / 2, lon = (c + d) / 2;
    const radio = Math.max(900, Math.max((d - c) * mLon(lat), (b - a) * M_LAT) / 2 / .9);
    return { ...base, lat, lon, radio, caja: [a, c, b, d], anillos };
  }
  return { ...base, lat: +x.lat, lon: +x.lon, radio: radioCiudad(tipo, parseInt(String((x.extratags || {}).population || "0").replace(/\D/g, "")) || 0), caja: null, anillos: null };
}

// Detalle según el tamaño: un barrio lleva todas sus calles; una ciudad entera, solo avenidas
function detalle(radio) {
  if (radio <= 3500) return { dentro: hasta("pedestrian"), fuera: hasta("tertiary") };
  if (radio <= 7000) return { dentro: hasta("tertiary"), fuera: hasta("secondary") };
  return { dentro: hasta("secondary"), fuera: hasta("primary") };
}
const cajaCuadro = ({ lat, lon, radio }) => { const dy = radio / M_LAT, dx = radio / mLon(lat); return [lat - 1.3 * dy, lon - 1.05 * dx, lat + 1.05 * dy, lon + 1.05 * dx]; };
const txtCaja = k => k.map(v => v.toFixed(5)).join(",");

// Pide las calles a todos los servidores a la vez y se queda con el primero que responde bien
export async function bajarCalles(loc, headers = {}) {
  const { dentro, fuera } = detalle(loc.radio), cuadro = txtCaja(cajaCuadro(loc));
  const q = loc.anillos
    ? `[out:json][timeout:40];(way(${txtCaja(loc.caja)})[highway~"^(${dentro})$"];way(${cuadro})[highway~"^(${fuera})$"];);out geom qt;`
    : `[out:json][timeout:40];way(${cuadro})[highway~"^(${dentro})$"];out geom qt;`;
  const ctrls = OVERPASS.map(() => new AbortController());
  const pedidos = OVERPASS.map((url, i) => {
    const t = setTimeout(() => ctrls[i].abort(), 40000);
    return fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded", ...headers }, signal: ctrls[i].signal })
      .then(async r => { if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (!j.elements || j.elements.length < 15) throw new Error("pocas calles"); return [i, j.elements]; })
      .finally(() => clearTimeout(t));
  });
  const [gano, ways] = await Promise.any(pedidos);
  ctrls.forEach((c, i) => { if (i !== gano) c.abort(); });
  return ways;
}

// Punto dentro de los límites (rayo horizontal; anillos interiores restan solos)
function dentroDe(x, y, polys) {
  let ok = false;
  for (const p of polys) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ok = !ok;
  }
  return ok;
}

// Proyecta al cuadro, recorta lo que queda fuera, quita puntos casi repetidos y escribe trazos relativos
export function dibujar(ways, loc) {
  const { lat, lon, radio } = loc, k = 300 / radio, mx = mLon(lat) * k, my = M_LAT * k, cy = 300;
  const P = (lo, la) => [(lo - lon) * mx + 300, cy - (la - lat) * my];
  const polys = loc.anillos ? loc.anillos.map(r => r.map(([lo, la]) => P(lo, la))) : null;
  const finas = new Set(detalle(radio).fuera.split("|"));
  const fuera = (x, y) => x < -20 || x > 620 || y < -20 || y > 800;
  const r1 = v => Math.round(v * 10) / 10;
  const trazo = pts => {
    let d = "", px = 0, py = 0, abierto = false;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const visible = !fuera(x, y) || (i > 0 && !fuera(...pts[i - 1])) || (i < pts.length - 1 && !fuera(...pts[i + 1]));
      if (!visible) { abierto = false; continue; }
      const rx = r1(x), ry = r1(y);
      if (!abierto) { d += "M" + rx + " " + ry; abierto = true; px = rx; py = ry; continue; }
      const ultimo = i === pts.length - 1 || fuera(...pts[i + 1]);
      if (!ultimo && Math.abs(rx - px) + Math.abs(ry - py) < 1.2) continue;
      d += "l" + r1(rx - px) + " " + r1(ry - py); px = rx; py = ry;
    }
    return d;
  };
  const grupos = {};   // "tipo|dentro" → trazos
  for (const w of ways) {
    const g = w.geometry; if (!g || g.length < 2) continue;
    const tipo = (w.tags || {}).highway, pts = g.map(p => P(p.lon, p.lat));
    let dentro = true;
    if (polys) { const m = pts[pts.length >> 1]; dentro = dentroDe(m[0], m[1], polys); if (!dentro && !finas.has(tipo)) continue; }
    const d = trazo(pts); if (d) (grupos[tipo + "|" + (dentro ? 1 : 0)] ||= []).push(d);
  }
  const compacto = s => s.replace(/l(-?[\d.]+) (-?[\d.]+)/g, (m, a, b) => "l" + a + (b[0] === "-" ? b : " " + b));
  const capas = Object.entries(grupos).map(([kk, ds]) => { const [tipo, dn] = kk.split("|"); return { tipo, dn: dn === "1", d: compacto(ds.join("")) }; })
    .sort((a, b) => (a.dn - b.dn) || (ANCHO[a.tipo] || 1) - (ANCHO[b.tipo] || 1));
  // Líneas más finas cuanto más grande el lugar (una ciudad entera no lleva trazos gruesos)
  const esc = radio > 7000 ? .5 : radio > 3500 ? .7 : 1;
  let out = capas.map(({ tipo, dn, d }) => { const w = r1((ANCHO[tipo] || 1) * esc);
    return dn ? `<path stroke-width="${w}" opacity="${(ANCHO[tipo] || 1) > 1.5 ? .95 : .7}" d="${d}"/>` : `<path stroke-width="${r1(w * .7)}" opacity=".28" d="${d}"/>`; }).join("");
  // El límite del lugar: línea fina y un velo muy suave para que se lea delimitado
  if (polys) out += `<path d="${polys.map(p => trazo([...p, p[0]])).join("")}" stroke="#fff" stroke-width="1.4" stroke-dasharray="5 4" opacity=".85" fill="#fff" fill-opacity=".05" fill-rule="evenodd"/>`;
  return out;
}

export async function armarMapa(q, headers = {}) {
  const loc = await buscarLugar(q, headers);
  const ways = await bajarCalles(loc, headers);
  return { ok: true, lat: loc.lat, lon: loc.lon, nombre: loc.nombre, pais: loc.pais, svg: dibujar(ways, loc) };
}
