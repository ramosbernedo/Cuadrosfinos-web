/* =========================================================
   Cuadros Finos — vistas previas en vivo de los personalizados.
   Cada diseño es un SVG de 600 × 780 (la ventana del marco) que se
   dibuja con lo que escribe el cliente. tools/personalizados.js usa
   estas mismas funciones para generar las imágenes del catálogo.
   ========================================================= */
(() => {
"use strict";
let uid = 0;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const SERIF = "'Cormorant Garamond', 'Cormorant', Garamond, Georgia, serif";
const SANS = "'Inter', 'Helvetica Neue', Arial, sans-serif";
const W = 600, H = 780;

// Tamaño de letra para que el texto entre en `width` (aprox. por cantidad de letras)
const fit = (txt, width, max, k = .62, track = 0) => {
  const n = Math.max(1, [...txt].length);
  return Math.max(14, Math.min(max, width / (n * (k + track))));
};
const svg = (body, defs = "", bg = "#efe9de") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" style="fill:#000;stroke:none;stroke-width:1">` +
  `<defs>${defs}</defs><rect width="${W}" height="${H}" fill="${bg}"/>${body}</svg>`;
// Papel con grano
const paper = id => `<filter id="${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .15  0 0 0 .09 0"/></filter>`;
const grain = id => `<rect width="${W}" height="${H}" filter="url(#${id})"/>`;
const T = (x, y, txt, { size = 20, font = SERIF, weight = 400, italic = false, track = 0, fill = "#1c1a17", anchor = "middle", opacity = 1 } = {}) =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="${font}" font-size="${size.toFixed(1)}" font-weight="${weight}"${italic ? ' font-style="italic"' : ""}${track ? ` letter-spacing="${(track * size).toFixed(1)}"` : ""} fill="${fill}" opacity="${opacity}">${esc(txt)}</text>`;
const up = s => s.toLocaleUpperCase("es-PE");

// Semilla estable a partir de un texto
const seeded = str => { let h = 2166136261; for (const c of str) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };

const DISENOS = {
  /* Familia · tu apellido — apellido grande sobre papel hueso */
  "familia-apellido"([apellido, desde]) {
    const id = "g" + (++uid);
    let name = (apellido || "Familia Figueroa Rojas").trim().replace(/^familia\s+/i, "");
    const words = name.split(/\s+/);
    const lines = name.length > 13 && words.length > 1 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [name];
    const size = Math.min(...lines.map(l => fit(up(l), 500, 92, .64, .04)));
    const y0 = 400 - (lines.length - 1) * size * .55;
    const body = grain(id) +
      `<line x1="270" y1="190" x2="330" y2="190" stroke="#1c1a17" stroke-width="1"/>` +
      T(300, 245, "LA FAMILIA", { size: 19, track: .42, font: SANS, weight: 500 }) +
      lines.map((l, i) => T(300, y0 + i * size * 1.08, up(l), { size, weight: 500, track: .04 })).join("") +
      `<line x1="250" y1="${y0 + (lines.length - 1) * size * 1.08 + 62}" x2="350" y2="${y0 + (lines.length - 1) * size * 1.08 + 62}" stroke="#1c1a17" stroke-width="1"/>` +
      T(300, y0 + (lines.length - 1) * size * 1.08 + 118, `DESDE ${up((desde || "2015").trim())}`, { size: 18, track: .4, font: SANS, weight: 500 }) +
      T(300, 690, "Aquí se quiere bonito.", { size: 24, italic: true, opacity: .75 });
    return svg(body, paper(id));
  },

  /* Nuestra fecha — nombres, fecha y lugar */
  "nuestra-fecha"([nombres, fecha, lugar]) {
    const id = "g" + (++uid);
    const n = (nombres || "Ana & Luis").trim(), f = (fecha || "14 de febrero de 2020").trim(), l = (lugar || "Barranco, Lima").trim();
    const size = fit(n, 500, 96, .5);
    const body = grain(id) +
      `<g fill="none" stroke="#1c1a17" stroke-width="1.2" opacity=".85"><circle cx="286" cy="200" r="26"/><circle cx="314" cy="200" r="26"/></g>` +
      T(300, 380, n, { size, italic: true, weight: 500 }) +
      `<line x1="240" y1="430" x2="360" y2="430" stroke="#1c1a17" stroke-width="1"/>` +
      T(300, 488, up(f), { size: fit(up(f), 500, 22, .62, .3), track: .3, font: SANS, weight: 500 }) +
      T(300, 534, l, { size: fit(l, 480, 30, .45), italic: true, opacity: .8 }) +
      T(300, 680, "AQUÍ EMPEZÓ TODO", { size: 14, track: .45, font: SANS, weight: 500, opacity: .6 });
    return svg(body, paper(id));
  },

  /* Tu cielo — mapa de estrellas (referencial) con fecha, lugar y frase */
  "tu-cielo"([fecha, lugar, frase]) {
    const id = "c" + (++uid);
    const f = (fecha || "14/02/2020, 9 p. m.").trim(), l = (lugar || "Barranco, Lima").trim(), fr = (frase || "La noche que dijimos sí").trim();
    const rnd = seeded(f + "|" + l);
    const cx = 300, cy = 290, R = 220;
    let stars = "", pts = [];
    for (let i = 0; i < 340; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * (R - 6);
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r, m = rnd();
      const s = m > .985 ? 2.6 : m > .93 ? 1.7 : m > .7 ? 1.1 : .7;
      stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s}" fill="#fff" opacity="${(.45 + rnd() * .55).toFixed(2)}"/>`;
      if (s >= 1.7) pts.push([x, y]);
    }
    // «constelaciones»: une cada estrella brillante con su vecina más cercana
    let lines = "";
    pts.slice(0, 26).forEach((p, i) => {
      let best = null, d = 1e9;
      pts.forEach((q, j) => { if (j === i) return; const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2; if (dd < d && dd > 400) { d = dd; best = q; } });
      if (best && d < 9000) lines += `<line x1="${p[0].toFixed(1)}" y1="${p[1].toFixed(1)}" x2="${best[0].toFixed(1)}" y2="${best[1].toFixed(1)}"/>`;
    });
    let ticks = "";
    for (let g = 0; g < 360; g += 5) {
      const a = g * Math.PI / 180, r1 = R + 6, r2 = R + (g % 30 ? 11 : 18);
      ticks += `<line x1="${(cx + Math.cos(a) * r1).toFixed(1)}" y1="${(cy + Math.sin(a) * r1).toFixed(1)}" x2="${(cx + Math.cos(a) * r2).toFixed(1)}" y2="${(cy + Math.sin(a) * r2).toFixed(1)}"/>`;
    }
    const defs = `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${R}"/></clipPath><radialGradient id="${id}r"><stop offset="0" stop-color="#1b2233"/><stop offset="1" stop-color="#0b0e16"/></radialGradient>`;
    const body = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${id}r)"/>` +
      `<g clip-path="url(#${id})">${stars}<g stroke="#fff" stroke-width=".7" opacity=".45">${lines}</g></g>` +
      `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="#e9e4da" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="${R + 24}" fill="none" stroke="#e9e4da" stroke-width=".6" opacity=".6"/>` +
      `<g stroke="#e9e4da" stroke-width=".8" opacity=".7">${ticks}</g>` +
      T(300, 600, fr, { size: fit(fr, 500, 40, .42), italic: true, fill: "#f2ede4", weight: 500 }) +
      `<line x1="270" y1="628" x2="330" y2="628" stroke="#f2ede4" stroke-width=".8" opacity=".7"/>` +
      T(300, 668, up(f), { size: fit(up(f), 500, 18, .62, .3), track: .3, font: SANS, weight: 500, fill: "#e9e4da" }) +
      T(300, 700, up(l), { size: fit(up(l), 500, 15, .62, .35), track: .35, font: SANS, fill: "#bdb6aa" });
    return svg(body, defs, "#0b0d12");
  },

  /* Bendice este hogar — la lámina original con el apellido escrito */
  "bendice-este-hogar"([apellido]) {
    const a = up((apellido || "Familia Figueroa Rojas").trim());
    return svg(`<image href="/img/cuadros/base/bendice-este-hogar.webp" x="0" y="-60" width="600" height="900" preserveAspectRatio="xMidYMid slice"/>` +
      T(300, 302, a, { size: fit(a, 520, 36, .7, .14), weight: 500, track: .14, fill: "#191714" }), "", "#ece6dc");
  },

  /* Tu ciudad — mapa con el nombre del lugar */
  "tu-ciudad"([lugar, texto]) {
    const id = "m" + (++uid);
    const raw = (lugar || "Lima, Perú").trim();
    const [c1, ...rest] = raw.split(",").map(s => s.trim()).filter(Boolean);
    const city = up(c1 || "Lima"), sub = rest.join(", ") || "Perú";
    const t = (texto || "").trim();
    const defs = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b0b0b" stop-opacity="0"/><stop offset=".45" stop-color="#0b0b0b" stop-opacity=".92"/><stop offset="1" stop-color="#0b0b0b"/></linearGradient>`;
    return svg(`<image href="/img/cuadros/base/tu-ciudad.webp" x="0" y="-20" width="600" height="816" preserveAspectRatio="xMidYMid slice"/>` +
      `<rect x="0" y="540" width="600" height="240" fill="url(#${id})"/>` +
      T(300, 650, city, { size: fit(city, 520, 54, .7, .5), track: .5, font: SANS, weight: 600, fill: "#ffffff" }) +
      `<line x1="226" y1="682" x2="250" y2="682" stroke="#cfc9bf" stroke-width="1"/><line x1="350" y1="682" x2="374" y2="682" stroke="#cfc9bf" stroke-width="1"/>` +
      T(300, 690, sub, { size: fit(sub, 90, 24, .45), italic: true, fill: "#d9d3c9" }) +
      (t ? T(300, 730, up(t), { size: fit(up(t), 520, 13, .62, .35), track: .35, font: SANS, fill: "#a9a399" }) : ""), defs, "#0b0b0b");
  },
};

const NOTAS = {
  "tu-ciudad": "La vista previa usa el mapa de Lima: el tuyo se dibuja con las calles reales del lugar que escribas.",
  "tu-cielo": "Vista previa referencial: el cielo exacto de tu fecha, hora y lugar te lo enviamos por WhatsApp antes de imprimir.",
};

window.CFPersonal = {
  tiene: slug => !!DISENOS[slug],
  svg: (slug, valores = []) => DISENOS[slug](valores),
  nota: slug => NOTAS[slug] || "",
};
})();
