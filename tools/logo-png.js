// Convierte el logo SVG (img/marca/*.svg) en PNG para redes, WhatsApp e impresos.
// Uso: node tools/logo-png.js   (requiere Playwright; antes: python3 tools/logo.py)
// Salida en img/marca/:
//   logo-{blanco,negro,dorado}.png           1600 px de ancho, fondo transparente
//   logo-vertical-{blanco,negro,dorado}.png  1000 px de ancho, fondo transparente
//   perfil.png                               1080 × 1080, símbolo blanco sobre negro (Instagram, WhatsApp, Facebook)
//   perfil-dorado.png                        1080 × 1080, símbolo dorado sobre negro
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'img', 'marca');
const svg = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

async function render(page, html, w, h, out, transparente) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`);
  await page.screenshot({ path: path.join(DIR, out), omitBackground: transparente, clip: { x: 0, y: 0, width: w, height: h } });
  console.log(out);
}

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage();
  const ajuste = (s, w, h) => s.replace('<svg ', `<svg width="${w}" height="${h}" style="display:block" `);
  for (const c of ['blanco', 'negro', 'dorado']) {
    await render(page, ajuste(svg(`logo-${c}.svg`), 1600, 1600 * 100 / 356), 1600, Math.round(1600 * 100 / 356), `logo-${c}.png`, true);
    await render(page, ajuste(svg(`logo-vertical-${c}.svg`), 1000, 1000 * 174 / 240), 1000, Math.round(1000 * 174 / 240), `logo-vertical-${c}.png`, true);
  }
  // Perfil: símbolo al 52 % del lado, centrado, para que entre en el recorte circular.
  for (const [c, out] of [['blanco', 'perfil.png'], ['dorado', 'perfil-dorado.png']]) {
    const s = ajuste(svg(`simbolo-${c}.svg`), 560, 560);
    await render(page, `<div style="width:1080px;height:1080px;background:#0b0b0b;display:grid;place-items:center">${s}</div>`, 1080, 1080, out, false);
  }
  await b.close();
})();
