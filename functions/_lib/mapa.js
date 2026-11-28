// Mapa de calles para «Tu ciudad»: lugar → coordenadas (Nominatim) → calles (Overpass) → trazos SVG livianos.
// Lo usa /api/mapa (servidor). La web tiene una copia de respaldo en personaliza.js por si el servidor falla.

export const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
export const ANCHO = { motorway: 4.2, trunk: 3.8, primary: 3.2, secondary: 2.5, tertiary: 1.9, unclassified: 1.1, residential: 1.0, living_street: .9, pedestrian: .9 };
const UA = "CuadrosFinos/1.0 (+https://cuadrosfinos.plantify.pe)";

const conTiempo = (url, op, ms) => { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); return fetch(url, { ...op, signal: c.signal }).finally(() => clearTimeout(t)); };

export async function buscarLugar(q) {
  const u = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1&accept-language=es&q=" + encodeURIComponent(q);
  const r = await conTiempo(u, { headers: { Accept: "application/json", "User-Agent": UA } }, 8000);
  if (!r.ok) throw new Error("lugar HTTP " + r.status);
  const j = await r.json(); if (!j.length) throw new Error("no encontrado");
  const x = j[0], tipo = x.addresstype || x.type;
  const radio = /city|town|municipality|county|state/.test(tipo) ? 2200 : /suburb|borough|city_district|quarter|neighbourhood|village/.test(tipo) ? 1500 : 1200;
  return { lat: +x.lat, lon: +x.lon, radio, nombre: x.name, pais: (x.address || {}).country || "" };
}

// Pide las calles a todos los servidores a la vez y se queda con el primero que responde bien
export async function bajarCalles({ lat, lon, radio }) {
  const dy = radio / 110540, dx = radio / (111320 * Math.cos(lat * Math.PI / 180));
  const caja = [lat - 1.3 * dy, lon - 1.05 * dx, lat + 1.05 * dy, lon + 1.05 * dx].map(v => v.toFixed(5)).join(",");
  const q = `[out:json][timeout:25];way(${caja})[highway~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)$"];out geom qt;`;
  const ctrls = OVERPASS.map(() => new AbortController());
  const pedidos = OVERPASS.map((url, i) => {
    const t = setTimeout(() => ctrls[i].abort(), 25000);
    return fetch(url, { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": UA }, signal: ctrls[i].signal })
      .then(async r => { if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json(); if (!j.elements || j.elements.length < 15) throw new Error("pocas calles"); return [i, j.elements]; })
      .finally(() => clearTimeout(t));
  });
  const [gano, ways] = await Promise.any(pedidos);
  ctrls.forEach((c, i) => { if (i !== gano) c.abort(); });
  return ways;
}

// Proyecta al cuadro (600 × 780), recorta lo que queda fuera, quita puntos casi repetidos y escribe trazos relativos
export function dibujar(ways, { lat, lon, radio }) {
  const kx = 300 / radio, mx = 111320 * Math.cos(lat * Math.PI / 180) * kx, my = 110540 * kx, cy = 300;
  const fuera = (x, y) => x < -20 || x > 620 || y < -20 || y > 800;
  const grupos = {};
  for (const w of ways) {
    const g = w.geometry; if (!g || g.length < 2) continue;
    const tipo = (w.tags || {}).highway; const pts = g.map(p => [(p.lon - lon) * mx + 300, cy - (p.lat - lat) * my]);
    let d = "", px = 0, py = 0, abierto = false;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      // Un tramo se dibuja si alguno de sus extremos cae dentro del cuadro
      const visible = !fuera(x, y) || (i > 0 && !fuera(...pts[i - 1])) || (i < pts.length - 1 && !fuera(...pts[i + 1]));
      if (!visible) { abierto = false; continue; }
      const rx = Math.round(x * 10) / 10, ry = Math.round(y * 10) / 10;
      if (!abierto) { d += "M" + rx + " " + ry; abierto = true; px = rx; py = ry; continue; }
      const ultimo = i === pts.length - 1 || fuera(...pts[i + 1]);
      if (!ultimo && Math.abs(rx - px) + Math.abs(ry - py) < 1.2) continue;
      d += "l" + (Math.round((rx - px) * 10) / 10) + " " + (Math.round((ry - py) * 10) / 10); px = rx; py = ry;
    }
    if (d) (grupos[tipo] ||= []).push(d);
  }
  return Object.entries(grupos).sort((a, b) => (ANCHO[a[0]] || 1) - (ANCHO[b[0]] || 1))
    .map(([tipo, ds]) => `<path stroke-width="${ANCHO[tipo] || 1}" opacity="${(ANCHO[tipo] || 1) > 1.5 ? .95 : .7}" d="${ds.join("").replace(/l(-?[\d.]+) (-?[\d.]+)/g, (m, a, b) => "l" + a + (b[0] === "-" ? b : " " + b))}"/>`).join("");
}
