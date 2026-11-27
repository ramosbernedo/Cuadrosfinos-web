/* 100 escenarios más (segunda tanda), desde otros ángulos:
   personas reales, contenido y textos, Google y redes, situaciones difíciles,
   celular real, compatibilidad de navegadores y medición.
   Uso:  python3 -m http.server 8765 &  node tools/escenarios2.js  [--json salida.json]  */
const { chromium, devices } = require("playwright");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, ".."), BASE = process.env.BASE || "http://localhost:8765";
const PHONE = devices["iPhone 13"], DESK = { viewport: { width: 1366, height: 800 } };
const CAT = (() => { const w = {}; new Function("window", fs.readFileSync(path.join(ROOT, "data.js"), "utf8"))(w); return w.CATALOGO; })();
const PR = CAT.config.precio, PRODS = CAT.productos, BY = Object.fromEntries(PRODS.map(x => [x.s, x]));
const soles = n => "S/ " + n.toLocaleString("es-PE");
const piezas = x => x.o === "triptico" ? 3 : x.o === "diptico" ? 2 : 1;
const precio = x => (x.pr || (piezas(x) === 3 ? PR.triptico : piezas(x) === 2 ? PR.diptico : PR.pieza)) + (x.p ? PR.personalizar : 0);
const packPrecio = n => Math.floor(n / 3) * PR.triptico + (n % 3 === 2 ? Math.min(PR.diptico, 2 * PR.pieza) : (n % 3) * PR.pieza);

// Páginas generadas (para revisar contenido sin abrir el navegador)
const PAGINAS = [];
(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (/^(\.git|node_modules|tools|functions|admin|vendor|_plantilla)$/.test(f)) continue;
  if (fs.statSync(p).isDirectory()) walk(p); else if (f === "index.html" || f === "404.html") PAGINAS.push(p); } })(ROOT);
const html = p => fs.readFileSync(p, "utf8");
const urlDe = p => "/" + path.relative(ROOT, p).replace(/index\.html$/, "").replace(/\\/g, "/");
const texto = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");
const meta = (h, k) => ((h.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]*)"`)) || [])[1] || "");

let browser;
async function page(dev = PHONE, { storage, init } = {}) {
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1 });
  await ctx.route(/wa\.me|facebook\.com|googletagmanager|clarity/, r => r.abort());
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", e => p.errs.push(e.message));
  if (init) await ctx.addInitScript(init);
  if (storage) { await p.goto(BASE + "/404.html"); await p.evaluate(s => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v))), storage); }
  p.ctx = ctx; p.toques = 0;
  p.toque = async sel => { p.toques++; const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); await p.waitForTimeout(250); };
  return p;
}
const go = async (p, url) => { await p.goto(BASE + url, { waitUntil: "load" }); await p.waitForTimeout(250); };
const msgOf = href => { try { return decodeURIComponent(new URL(href).searchParams.get("text") || ""); } catch { return ""; } };
const waFicha = async p => msgOf(await p.getAttribute("#pWa", "href"));
const waBolsa = async p => { await p.click("#openBag").catch(() => {}); await p.waitForTimeout(200); return msgOf(await p.getAttribute("#bagWa", "href")); };

const R = []; let N = 1, GRUPO = "";
async function esc(quien, objetivo, fn) {
  const r = { id: N++, grupo: GRUPO, quien, objetivo, friccion: [], ok: [], metricas: {} };
  const t0 = Date.now();
  try { await fn(r); } catch (e) { r.friccion.push("Se trabó: " + String(e.message).split("\n")[0].slice(0, 160)); }
  r.metricas.ms = Date.now() - t0; R.push(r);
  process.stdout.write(`${r.friccion.length ? "✗" : "✓"} ${String(r.id).padStart(3)} ${quien} — ${objetivo}${r.friccion.length ? "\n      · " + r.friccion.join("\n      · ") : ""}\n`);
}
const F = (r, cond, msg) => { if (cond) r.friccion.push(msg); else r.ok.push(msg); };
const grupo = g => { GRUPO = g; console.log(`\n── ${g} ──`); };

(async () => {
  browser = await chromium.launch();

  /* ================= A. Personas reales (20) ================= */
  grupo("Personas reales");
  const meta_ = (r, p, max) => { r.metricas.toques = p.toques; F(r, p.toques > max, `Necesitó ${p.toques} toques (meta: ${max})`); F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); };
  const busca = async (p, q) => { await p.toque("#openSearch"); await p.fill("#sq", q); await p.waitForTimeout(150); };

  await esc("Abogada decora su estudio", "busca «abogado», elige y pide", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "abogado"); await p.toque("#sRes a.s-item:not(.s-item--col)"); await p.toque("#pAdd");
    const m = await waBolsa(p); p.toques++; F(r, !/Themis|Mazo/.test(m), "El pedido no lleva el cuadro de abogados"); meta_(r, p, 5); await p.ctx.close(); });
  await esc("Mamá busca un regalo personalizado", "Ayúdame a elegir → personalizado → escribe → pide", async r => {
    const p = await page(); await go(p, "/"); await p.toque("[data-open-quiz]:visible");
    for (const v of ["dormitorio", "pers", "any"]) await p.toque(`#qOpts [data-v="${v}"]`);
    await p.toque("#qRes .card__open"); const ins = await p.$$("#pFieldList input"); for (const i of ins) await i.fill("Familia Torres");
    const m = await waFicha(p); p.toques++; F(r, !/Familia Torres/.test(m), "El mensaje no lleva lo que escribió"); meta_(r, p, 7); await p.ctx.close(); });
  await esc("Empresa pide 10 cuadros", "sube la cantidad a 10 y ve el precio por volumen", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag");
    for (let i = 0; i < 9; i++) await p.click('.qty [data-d="1"]');
    const tot = (await p.textContent("#bagTotal")).trim(); F(r, tot !== soles(packPrecio(10)), `Total ${tot}, esperado ${soles(packPrecio(10))}`);
    F(r, !(await p.$('a[data-wa*="empresa"], a[href*="empresa"]')), "No hay acceso a ventas corporativas"); await p.ctx.close(); });
  await esc("Fiel busca al Señor de los Milagros", "lo encuentra y pide", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "señor de los milagros"); await p.toque("#sRes a.s-item:not(.s-item--col)");
    F(r, !/senor-de-los-milagros/.test(p.url()), "No llegó al cuadro"); const m = await waFicha(p); p.toques++; F(r, !/Señor de los Milagros/.test(m), "El mensaje no lo lleva"); meta_(r, p, 4); await p.ctx.close(); });
  await esc("Pareja por su aniversario", "busca «aniversario», personaliza y pide", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "aniversario"); await p.toque('#sRes a[href="/cuadro/nuestra-fecha/"]');
    const ins = await p.$$("#pFieldList input"); const v = ["Ana & Luis", "14 de febrero de 2020", "Barranco"]; for (const [i, el] of ins.entries()) await el.fill(v[i] || "x");
    const m = await waFicha(p); p.toques++; F(r, !m.includes("Ana & Luis"), "El mensaje no lleva los nombres"); meta_(r, p, 5); await p.ctx.close(); });
  await esc("Persona mayor que solo usa el menú", "menú → Religiosos → un cuadro → pide", async r => {
    const p = await page(); await go(p, "/"); await p.toque("#navToggle"); await p.toque('#nav a[href="/cuadros-religiosos/"]'); await p.toque("#grid .card__open");
    const m = await waFicha(p); p.toques++; F(r, !/cuadro/.test(m), "No llegó a pedir"); meta_(r, p, 5); await p.ctx.close(); });
  await esc("Cliente de Arequipa", "confirma envío gratis a provincia y lo pone en el pedido", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/envío gratis/i.test(t), "No dice envío gratis en la ficha"); await p.click("#pAdd"); await p.click("#openBag");
    await p.evaluate(() => { document.getElementById("bagDet").open = true; }); await p.fill("#bagLugar", "Arequipa");
    const m = msgOf(await p.getAttribute("#bagWa", "href")); F(r, !/Arequipa/.test(m), "El pedido no lleva la ciudad"); await p.ctx.close(); });
  await esc("Médico para su consultorio", "menú Por tema → Profesionales → Salud → agrega", async r => {
    const p = await page(); await go(p, "/cuadros-para-profesionales/"); p.toques = 2; await p.toque('#subFilters [data-sub="salud"]');
    const n = await p.$$eval("#grid .card", c => c.length); F(r, !n, "No hay cuadros de salud"); await p.toque("#grid .card__add"); meta_(r, p, 4); await p.ctx.close(); });
  await esc("Quiere algo sobre el sofá de 2 m", "sala → tríptico → lo ve en su pared → pide", async r => {
    const p = await page(); await go(p, "/cuadros-para-sala/"); await p.toque('#grid a[href="/cuadro/triptico-fuerza-vision-lealtad/"]');
    await p.toque('[data-tab="pared"]'); F(r, !(await p.isVisible("#pWall")), "No se ve en la pared"); const m = await waFicha(p); p.toques++;
    F(r, !/98 cm|Tríptico/.test(m), "El mensaje no dice que es tríptico"); meta_(r, p, 4); await p.ctx.close(); });
  await esc("Estudiante con poco presupuesto", "ordena por precio y arma 3 por S/ 149", async r => {
    const p = await page(); await go(p, "/cuadros-motivacionales/"); await p.selectOption("#sort", "precio"); p.toques++;
    const adds = p.locator("#grid .card__add"); let k = 0; for (let i = 0; k < 3 && i < 8; i++) { const s = await adds.nth(i).getAttribute("data-add"); if (piezas(BY[s]) === 1 && !BY[s].p) { await adds.nth(i).scrollIntoViewIfNeeded(); await adds.nth(i).click(); p.toques++; k++; } }
    const m = await waBolsa(p); p.toques++; F(r, !m.includes(`Total: ${soles(PR.triptico)}`), "No le salen 3 por S/ 149"); meta_(r, p, 6); await p.ctx.close(); });
  await esc("Amante del Perú", "busca «machu picchu» y agrega", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "machu picchu"); await p.toque("#sRes a.s-item:not(.s-item--col)"); await p.toque("#pAdd");
    F(r, (await p.textContent("#bagCount")).trim() !== "1", "No se agregó"); meta_(r, p, 4); await p.ctx.close(); });
  await esc("Indeciso", "Ayúdame a elegir → agrega 2 desde las recomendaciones", async r => {
    const p = await page(); await go(p, "/"); await p.toque("[data-open-quiz]:visible"); for (const v of ["sala", "poder", "uno"]) await p.toque(`#qOpts [data-v="${v}"]`);
    await p.locator("#qRes [data-add]").nth(1).click(); await p.locator("#qRes [data-add]").nth(2).click(); p.toques += 2;
    F(r, (await p.textContent("#bagCount")).trim() !== "2", "No se agregaron 2"); meta_(r, p, 6); await p.ctx.close(); });
  await esc("Visitante que vuelve otro día", "ve «Vistos recientemente» al volver", async r => {
    const p = await page(PHONE, { storage: { cf_vistos: ["leon-fuerza", "tigre-en-el-agua", "ultima-cena"] } }); await go(p, "/");
    F(r, !(await p.isVisible("#recent")), "No aparecen sus vistos recientes"); await p.ctx.close(); });
  await esc("Le pasaron un enlace de selección", "abre el enlace y envía el pedido", async r => {
    const p = await page(); await go(p, "/?seleccion=leon-fuerza,aguila-vision,lobo-lealtad"); await p.waitForTimeout(500);
    const m = msgOf(await p.getAttribute("#bagWa", "href")); F(r, !m.includes(`Total: ${soles(PR.triptico)}`), "La selección compartida no sale 3 por S/ 149"); await p.ctx.close(); });
  await esc("Vio un anuncio del tríptico", "entra a la ficha y pide con un toque", async r => {
    const p = await page(); await go(p, "/cuadro/triptico-fuerza-vision-lealtad/?utm_source=instagram"); await p.toque("#bbWa");
    F(r, !(await waFicha(p)).includes(soles(PR.triptico)), "El mensaje no lleva el precio"); meta_(r, p, 1); await p.ctx.close(); });
  await esc("Gamer arma su setup", "busca «gamer» y encuentra algo", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "gamer"); const k = await p.$$eval("#sRes a.s-item:not(.s-item--sug)", a => a.length);
    F(r, !k, "«gamer» no encuentra nada (y hay fotos de un setup gamer en la web)"); await p.ctx.close(); });
  await esc("Arquitecto", "busca «arquitecto» y agrega", async r => {
    const p = await page(); await go(p, "/"); await busca(p, "arquitecto"); await p.toque("#sRes a.s-item:not(.s-item--col)"); await p.toque("#pAdd"); meta_(r, p, 4); await p.ctx.close(); });
  await esc("Devoto del Papa León XIV", "entra a la colección y pide a precio normal", async r => {
    const p = await page(); await go(p, "/cuadros-del-papa-leon-xiv/"); await p.toque("#grid .card__open"); const m = await waFicha(p); p.toques++;
    F(r, !m.includes(soles(PR.pieza)), "No tiene precio"); meta_(r, p, 3); await p.ctx.close(); });
  await esc("Busca algo minimalista", "agrega 3 minimalistas y ve el descuento", async r => {
    const p = await page(); await go(p, "/?q=minimalista"); const adds = p.locator("#grid .card__add");
    for (let i = 0; i < 3; i++) { await adds.nth(i).scrollIntoViewIfNeeded(); await adds.nth(i).click(); p.toques++; }
    await p.click("#openBag"); p.toques++; F(r, await p.isHidden("#bagDsc"), "No ve el descuento por cantidad"); meta_(r, p, 5); await p.ctx.close(); });
  await esc("Compra por impulso desde la portada", "botón principal → un más pedido → pedir", async r => {
    const p = await page(); await go(p, "/"); await p.toque(".hero__cta .btn--light"); await p.toque("#topGrid .card__open"); await p.toque("#bbWa, #pWa");
    F(r, !(await waFicha(p)).includes("S/"), "El mensaje no tiene precio"); meta_(r, p, 3); await p.ctx.close(); });

  /* ================= B. Contenido y textos (15) ================= */
  grupo("Contenido y textos");
  const TODO = PAGINAS.map(p => ({ p, url: urlDe(p), h: html(p) })), TXT = TODO.map(x => ({ ...x, t: texto(x.h) }));
  await esc("Lee toda la web", "sin faltas de ortografía comunes (tildes)", async r => {
    const malas = /\b(tambien|envio|envios|dias|aqui|facil|rapido|numero|telefono|direccion|informacion|pagina|seleccion|coleccion|ultimo|unico|Peru|Lima,Peru|mas pedidos|Jesus|Maria|corazon|oracion|arcangel|leon de juda)\b/gi;
    const hall = {}; for (const x of TXT) for (const m of x.t.match(malas) || []) (hall[m.toLowerCase()] ||= new Set()).add(x.url);
    for (const [w, us] of Object.entries(hall)) r.friccion.push(`«${w}» sin tilde en ${us.size} página(s), p. ej. ${[...us][0]}`); });
  await esc("Revisa los nombres de los cuadros", "sin palabras sin tilde ni espacios dobles", async r => {
    const malas = PRODS.filter(x => /\b(Leon|Jesus|Maria|Corazon|Oracion|Arcangel|Peru|Juda|Cristo Rey)\b|  |\s$/.test(x.n)); malas.forEach(x => r.friccion.push(`«${x.n}»`)); });
  await esc("Compara precios en los textos", "todos los «S/» son precios reales del catálogo", async r => {
    const validos = new Set([PR.pieza, PR.triptico, PR.diptico, PR.personalizar, PR.pieza + PR.personalizar, ...PRODS.map(precio), 0, 103, 65, 252]);
    const raros = {}; for (const x of TXT) for (const m of x.t.matchAll(/S\/\s?(\d+)/g)) if (!validos.has(+m[1])) (raros[m[1]] ||= x.url);
    Object.entries(raros).forEach(([v, u]) => r.friccion.push(`«S/ ${v}» en ${u}`)); });
  await esc("Compara plazos de entrega", "siempre «4 a 6 días»", async r => {
    const otros = new Set(); for (const x of TXT) for (const m of x.t.matchAll(/(\d+)\s*(?:a|–|-)\s*(\d+)\s*días/g)) if (m[0].replace(/\s/g, "") !== "4a6días" && m[0].replace(/\s/g, "") !== "4–6días") otros.add(`${m[0]} (${x.url})`);
    [...otros].slice(0, 5).forEach(o => r.friccion.push(o)); });
  await esc("Compara medidas", "siempre «30 × 37 cm» (no «30x37»)", async r => {
    const malas = TXT.filter(x => /30\s?x\s?37|30\s?×\s?36|30\s?×\s?40/i.test(x.t)).map(x => x.url); F(r, malas.length, `Medida escrita distinta en ${malas.slice(0, 3).join(", ")}`); });
  await esc("Lee las frases de los cuadros", "ninguna frase repetida entre cuadros", async r => {
    const vis = {}; for (const x of PRODS) (vis[x.f] ||= []).push(x.n); Object.entries(vis).filter(([, v]) => v.length > 1).forEach(([f, v]) => r.friccion.push(`«${f}» en ${v.join(", ")}`)); });
  await esc("Compara descripciones para Google", "ninguna descripción repetida entre páginas", async r => {
    const vis = {}; for (const x of TODO) { const d = meta(x.h, "description"); if (d) (vis[d] ||= []).push(x.url); }
    Object.entries(vis).filter(([, v]) => v.length > 1).forEach(([d, v]) => r.friccion.push(`Repetida en ${v.join(", ")}: «${d.slice(0, 50)}…»`)); });
  await esc("Hace clic en todos los enlaces", "ningún enlace interno roto", async r => {
    const rotos = new Set(), existe = u => { const f = path.join(ROOT, decodeURI(u.split(/[?#]/)[0])); return fs.existsSync(f) && (fs.statSync(f).isFile() || fs.existsSync(path.join(f, "index.html"))); };
    for (const x of TODO) for (const m of x.h.matchAll(/href="(\/[^"]*)"/g)) { const u = m[1]; if (/^\/(api|media)\//.test(u) || u === "/") continue; if (!existe(u)) rotos.add(`${u} (en ${x.url})`); }
    [...rotos].slice(0, 8).forEach(u => r.friccion.push(u)); r.metricas.paginas = TODO.length; });
  await esc("Usa los atajos (#como, #faq, #catalogo, #top)", "cada ancla existe en su página", async r => {
    const idsDe = u => { const f = TODO.find(x => x.url === u); return f ? new Set([...f.h.matchAll(/id="([^"]+)"/g)].map(m => m[1])) : new Set(); };
    const malos = new Set(); for (const x of TODO) for (const m of x.h.matchAll(/href="(\/[^"#]*)#([\w-]+)"/g)) if (!idsDe(m[1] || "/").has(m[2])) malos.add(`${m[1]}#${m[2]}`);
    [...malos].forEach(u => r.friccion.push(`Ancla inexistente: ${u}`)); });
  await esc("Carga todas las imágenes del HTML", "ninguna imagen referenciada falta", async r => {
    const faltan = new Set(); for (const x of TODO) for (const m of x.h.matchAll(/(?:src|href|content)="(\/(?:img|3d)\/[^"?]+)/g)) if (!fs.existsSync(path.join(ROOT, m[1]))) faltan.add(m[1]);
    [...faltan].slice(0, 8).forEach(u => r.friccion.push(`Falta ${u}`)); });
  await esc("Revisa los WhatsApp", "todos los enlaces usan el mismo número", async r => {
    const nums = new Set(); for (const x of TODO) for (const m of x.h.matchAll(/wa\.me\/(\d+)/g)) nums.add(m[1]); r.metricas.numeros = [...nums];
    F(r, nums.size > 1, `Hay ${nums.size} números distintos: ${[...nums].join(", ")}`); F(r, ![...nums].includes(CAT.config.whatsapp), "No aparece el número del catálogo"); });
  await esc("Mira la web con todo cargado", "nunca aparece «undefined», «null» o «NaN»", async r => {
    const p = await page(); for (const u of ["/", "/cuadros-religiosos/", "/cuadro/leon-fuerza/", "/cuadro/tu-cielo/", "/404.html"]) { await go(p, u);
      await p.click("#openBag"); await p.waitForTimeout(150); const t = await p.evaluate(() => document.body.innerText); const m = t.match(/\b(undefined|null|NaN|\[object Object\])\b/); if (m) r.friccion.push(`«${m[1]}» en ${u}`); await p.keyboard.press("Escape"); }
    await p.ctx.close(); });
  await esc("Compara título de la ficha y nombre", "el H1 de cada ficha es el nombre del cuadro", async r => {
    for (const x of TODO.filter(y => y.url.startsWith("/cuadro/"))) { const s = x.url.split("/")[2], h1 = texto((x.h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || "").replace(/\s·\s/g, " · ").trim();
      if (BY[s] && h1.replace(/\s+/g, " ") !== BY[s].n && h1.replace(/ · /g, " ") !== BY[s].n.replace(/ · /g, " ")) r.friccion.push(`${s}: «${h1}» ≠ «${BY[s].n}»`); } });
  await esc("Mira el pie de página", "el año es el actual", async r => {
    const y = new Date().getFullYear(); F(r, !html(path.join(ROOT, "index.html")).includes(`© ${y}`), `El pie no dice © ${y}`); });
  await esc("Busca contradicciones del envío", "nada dice que el envío se cobra", async r => {
    const malas = TXT.filter(x => /envío\s+(?:cuesta|tiene un costo|a cargo del cliente|se paga)|costo de envío|\+\s?envío/i.test(x.t)).map(x => x.url); F(r, malas.length, `Contradicción en ${malas.slice(0, 3).join(", ")}`); });

  /* ================= C. Google y redes (15) ================= */
  grupo("Google y redes");
  const indexables = TODO.filter(x => !/noindex/.test(x.h));
  await esc("Comparte en WhatsApp/Facebook", "todas las páginas tienen título, descripción e imagen para compartir", async r => {
    for (const x of indexables) { const f = ["og:title", "og:description", "og:image"].filter(k => !meta(x.h, k)); if (f.length) r.friccion.push(`${x.url}: falta ${f.join(", ")}`); } });
  await esc("Ve la imagen al compartir", "las imágenes de compartir existen y miden 1200 × 630", async r => {
    const { execSync } = require("child_process"); const vistos = new Set();
    for (const x of indexables) { const u = meta(x.h, "og:image").replace(/^https?:\/\/[^/]+/, "").split("?")[0]; if (!u || vistos.has(u)) continue; vistos.add(u);
      const f = path.join(ROOT, u); if (!fs.existsSync(f)) { r.friccion.push(`Falta ${u}`); continue; }
      try { const d = execSync(`python3 -c "from PIL import Image;print(*Image.open('${f}').size)"`).toString().trim(); if (d !== "1200 630") r.friccion.push(`${u} mide ${d}`); } catch {} }
    r.metricas.imagenes = vistos.size; });
  await esc("Busca en Google", "títulos de 65 caracteres o menos", async r => {
    for (const x of indexables) { const t = ((x.h.match(/<title>([^<]*)<\/title>/) || [])[1] || "").replace(/&amp;/g, "&"); if (t.length > 65) r.friccion.push(`${x.url} (${t.length}): «${t.slice(0, 60)}…»`); }
    r.friccion = r.friccion.slice(0, 10); });
  await esc("Lee el resultado de Google", "descripciones entre 70 y 160 caracteres", async r => {
    for (const x of indexables) { const d = meta(x.h, "description"); if (d.length < 70 || d.length > 160) r.friccion.push(`${x.url}: ${d.length} caracteres`); } r.friccion = r.friccion.slice(0, 10); });
  await esc("Compara resultados de Google", "ningún título repetido", async r => {
    const vis = {}; for (const x of indexables) { const t = (x.h.match(/<title>([^<]*)<\/title>/) || [])[1]; (vis[t] ||= []).push(x.url); }
    Object.entries(vis).filter(([, v]) => v.length > 1).forEach(([t, v]) => r.friccion.push(`«${t}» en ${v.join(", ")}`)); });
  await esc("Google elige la URL correcta", "cada página tiene canonical que apunta a sí misma", async r => {
    for (const x of indexables) { const c = (x.h.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] || ""; if (!c.endsWith(x.url === "/404.html" ? "/404" : x.url)) r.friccion.push(`${x.url}: canonical «${c}»`); } });
  const ld = h => [...h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => { try { return JSON.parse(m[1]); } catch { return { _malo: true }; } });
  await esc("Google lee los productos", "cada ficha tiene datos de producto completos", async r => {
    for (const x of TODO.filter(y => y.url.startsWith("/cuadro/"))) { const pr = ld(x.h).find(o => o["@type"] === "Product");
      if (!pr) { r.friccion.push(`${x.url}: sin Product`); continue; } const o = pr.offers || {};
      const f = [!pr.name && "name", !pr.image && "image", !o.price && "price", o.priceCurrency !== "PEN" && "PEN", !o.availability && "availability", !(o.shippingDetails || {}).shippingRate && "costo de envío"].filter(Boolean);
      if (f.length) r.friccion.push(`${x.url}: falta ${f.join(", ")}`); } r.friccion = r.friccion.slice(0, 8); });
  await esc("Google muestra el precio", "el precio de los datos coincide con el de la ficha", async r => {
    for (const x of TODO.filter(y => y.url.startsWith("/cuadro/"))) { const s = x.url.split("/")[2], pr = ld(x.h).find(o => o["@type"] === "Product");
      if (pr && BY[s] && +pr.offers.price !== precio(BY[s])) r.friccion.push(`${s}: datos ${pr.offers.price} ≠ ${precio(BY[s])}`); } });
  await esc("Google muestra la ruta", "fichas y colecciones tienen migas de pan para Google", async r => {
    for (const x of TODO.filter(y => /^\/(cuadro|cuadros-)/.test(y.url))) if (!ld(x.h).some(o => o["@type"] === "BreadcrumbList")) r.friccion.push(`${x.url}: sin BreadcrumbList`); });
  await esc("Google lee los datos sin errores", "todos los bloques de datos son JSON válido", async r => {
    for (const x of TODO) if (ld(x.h).some(o => o._malo)) r.friccion.push(`${x.url}: JSON-LD inválido`); });
  await esc("Google recorre el sitemap", "todas las páginas están y no sobra ninguna", async r => {
    const sm = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8"), locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(/^https?:\/\/[^/]+/, ""));
    const paginas = new Set(indexables.map(x => x.url).filter(u => u !== "/404.html"));
    for (const u of locs) if (!paginas.has(u)) r.friccion.push(`Sobra en el sitemap: ${u}`); for (const u of paginas) if (!locs.includes(u)) r.friccion.push(`Falta en el sitemap: ${u}`);
    r.metricas.urls = locs.length; r.friccion = r.friccion.slice(0, 8); });
  await esc("Google entra al sitio", "robots.txt permite rastrear y señala el sitemap", async r => {
    const rb = fs.readFileSync(path.join(ROOT, "robots.txt"), "utf8"); F(r, /Disallow:\s*\/\s*$/m.test(rb.split(/User-agent:\s*\*/i)[1] || ""), "robots.txt bloquea todo");
    F(r, !/Sitemap:/i.test(rb), "robots.txt no señala el sitemap"); });
  await esc("Google Shopping", "el catálogo para anuncios tiene precio, foto y enlace válidos", async r => {
    const feeds = fs.existsSync(path.join(ROOT, "feeds")) ? fs.readdirSync(path.join(ROOT, "feeds")).filter(f => f.endsWith(".xml")) : [];
    F(r, !feeds.length, "No hay catálogo para anuncios");
    for (const f of feeds) { const x = fs.readFileSync(path.join(ROOT, "feeds", f), "utf8"); const items = x.split("<item>").slice(1); r.metricas[f] = items.length;
      for (const it of items) { const id = (it.match(/<g:id>([^<]+)/) || [])[1], pr = (it.match(/<g:price>([^<]+)/) || [])[1], img = ((it.match(/<g:image_link>([^<]+)/) || [])[1] || "").replace(/^https?:\/\/[^/]+/, "");
        if (!pr) r.friccion.push(`${f} ${id}: sin precio`); if (img && !fs.existsSync(path.join(ROOT, img.split("?")[0]))) r.friccion.push(`${f} ${id}: falta la foto ${img}`);
        if (BY[id] && pr && parseFloat(pr) !== precio(BY[id])) r.friccion.push(`${f} ${id}: precio ${pr} ≠ ${precio(BY[id])}`); } }
    r.friccion = r.friccion.slice(0, 8); });
  await esc("WhatsApp muestra la vista previa", "las imágenes de compartir usan https y dirección completa", async r => {
    for (const x of indexables) { const u = meta(x.h, "og:image"); if (u && !/^https:\/\//.test(u)) r.friccion.push(`${x.url}: «${u}»`); } });
  await esc("Google entiende la estructura", "un solo H1 por página y en español", async r => {
    for (const x of TODO) { const n = (x.h.match(/<h1[\s>]/g) || []).length; if (n !== 1) r.friccion.push(`${x.url}: ${n} H1`); if (!/<html lang="es/.test(x.h)) r.friccion.push(`${x.url}: sin idioma es`); } });

  /* ================= D. Situaciones difíciles (15) ================= */
  grupo("Situaciones difíciles");
  await esc("Se queda sin internet a mitad del pedido", "puede agregar y armar el mensaje igual", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); await p.ctx.setOffline(true); await p.click("#pAdd"); const m = await waBolsa(p);
    F(r, !/León · Fuerza/.test(m), "Sin internet no arma el pedido"); F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); await p.ctx.close(); });
  await esc("Arma una selección de 20 cuadros", "el cajón funciona y el mensaje no es demasiado largo", async r => {
    const bag = PRODS.filter(x => !x.p && x.i).slice(0, 20).map(x => ({ s: x.s, f: null, qty: 1 }));
    const p = await page(PHONE, { storage: { cf_bag: bag } }); await go(p, "/"); const m = await waBolsa(p); const href = await p.getAttribute("#bagWa", "href");
    r.metricas.caracteres_url = href.length; F(r, href.length > 8000, `El enlace de WhatsApp mide ${href.length} caracteres: algunos celulares lo cortan`);
    F(r, (m.match(/^• /gm) || []).length !== 20, "No están los 20 cuadros en el mensaje"); await p.ctx.close(); });
  await esc("Apellido muy largo", "la vista previa no se desborda", async r => {
    const p = await page(); await go(p, "/cuadro/bendice-este-hogar/"); await p.fill("#pFieldList input", "Familia Fernández de Córdova Villarreal Santisteban"); await p.waitForTimeout(300);
    const fuera = await p.evaluate(() => { const s = document.querySelector("#pStage svg"); if (!s) return false; const vb = s.viewBox.baseVal; return [...s.querySelectorAll("text")].some(t => { const b = t.getBBox(); return b.x < vb.x - 2 || b.x + b.width > vb.x + vb.width + 2; }); });
    F(r, fuera, "El texto largo se sale del cuadro en la vista previa"); await p.ctx.close(); });
  await esc("Escribe con emojis", "el mensaje de WhatsApp los conserva", async r => {
    const p = await page(); await go(p, "/cuadro/nuestra-fecha/"); const ins = await p.$$("#pFieldList input"); for (const i of ins) await i.fill("Ana ❤️ Luis");
    F(r, !(await waFicha(p)).includes("Ana ❤️ Luis"), "Se pierden los emojis"); await p.ctx.close(); });
  await esc("Escribe símbolos raros (<, >, &)", "la vista previa los muestra como texto, sin romperse", async r => {
    const p = await page(); await go(p, "/cuadro/bendice-este-hogar/"); await p.fill("#pFieldList input", "<b>Ríos & Hijos</b>"); await p.waitForTimeout(300);
    const t = await p.evaluate(() => (document.querySelector("#pStage svg") || {}).textContent || ""); F(r, !t.includes("<b>RÍOS & HIJOS</b>") && !t.toLowerCase().includes("<b>ríos & hijos</b>"), "Los símbolos no se muestran tal cual");
    F(r, await p.$("#pStage svg b"), "Se interpretó como código"); await p.ctx.close(); });
  await esc("Vuelve con un cuadro que ya no existe", "su selección guardada no rompe nada", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "helechos", f: null, qty: 1 }, { s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/");
    F(r, (await p.textContent("#bagCount")).trim() !== "1", "No limpió el cuadro retirado"); F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); await p.ctx.close(); });
  await esc("Datos guardados dañados", "la web funciona igual", async r => {
    const p = await page(PHONE, { storage: { cf_bag: "{roto", cf_vistos: "nope", cf_entrega: "[[" } }); await go(p, "/"); await go(p, "/cuadro/leon-fuerza/"); await p.click("#pAdd");
    F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); F(r, (await p.textContent("#bagCount")).trim() !== "1", "No pudo agregar"); await p.ctx.close(); });
  await esc("Navegación privada sin almacenamiento", "puede comprar aunque el navegador bloquee el guardado", async r => {
    const p = await page(PHONE, { init: () => { Object.defineProperty(window, "localStorage", { get() { throw new Error("bloqueado"); } }); Object.defineProperty(window, "sessionStorage", { get() { throw new Error("bloqueado"); } }); } });
    await go(p, "/cuadro/leon-fuerza/"); await p.click("#pAdd"); const m = await waBolsa(p); F(r, !/León · Fuerza/.test(m), "No arma el pedido"); F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); await p.ctx.close(); });
  await esc("Abre dos pestañas", "lo que agrega en una aparece en la otra al recargar", async r => {
    const a = await page(); await go(a, "/cuadro/leon-fuerza/"); const b = await a.ctx.newPage(); await b.goto(BASE + "/"); await a.click("#pAdd"); await b.reload(); await b.waitForTimeout(200);
    F(r, (await b.textContent("#bagCount")).trim() !== "1", "La otra pestaña no ve la selección"); await a.ctx.close(); });
  await esc("Toca «+» muchas veces", "la cantidad y el total siguen bien", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag");
    for (let i = 0; i < 59; i++) await p.click('.qty [data-d="1"]'); const q = +(await p.textContent(".qty span")), tot = (await p.textContent("#bagTotal")).trim();
    r.metricas.cantidad = q; F(r, tot !== soles(packPrecio(q)), `Total ${tot} ≠ ${soles(packPrecio(q))}`); F(r, q > 50, `Permite ${q} unidades sin avisar (el panel guarda hasta 50)`); await p.ctx.close(); });
  await esc("Doble toque rápido en «Pedir»", "se registra un solo pedido", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); await p.click("#pWa"); await p.click("#pWa");
    const n = await p.evaluate(() => (window.CFTrack ? CFTrack.log : []).filter(e => e.name === "generate_lead").length); r.metricas.leads = n; F(r, n > 1, `Se registraron ${n} pedidos por el doble toque`); await p.ctx.close(); });
  await esc("Abre un enlace con filtros inválidos", "ve el catálogo igual", async r => {
    const p = await page(); await go(p, "/?c=noexiste&amb=luna&sub=xx&q="); F(r, p.errs.length, "Errores: " + p.errs.join(" | "));
    F(r, !(await p.$$eval("#grid .card", c => c.length)) && !(await p.isVisible("#empty")), "Página vacía sin explicación"); await p.ctx.close(); });
  await esc("Pega un texto enorme en la búsqueda", "no se traba", async r => {
    const p = await page(); await go(p, "/"); await p.click("#openSearch"); await p.fill("#sq", "león ".repeat(80)); await p.waitForTimeout(300); F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); await p.ctx.close(); });
  await esc("Pide un personalizado sin escribir datos", "se le pide completar y no se envía vacío", async r => {
    const p = await page(); await go(p, "/cuadro/tu-cielo/"); await p.click("#pWa"); const foco = await p.evaluate(() => document.activeElement.tagName);
    F(r, foco !== "INPUT", "No lo lleva al campo vacío"); F(r, !/Completa/.test(await p.textContent("#toast")), "No hay aviso"); await p.ctx.close(); });
  await esc("Abre un cuadro retirado desde un enlace viejo", "ve una salida útil", async r => {
    const red = fs.readFileSync(path.join(ROOT, "_redirects"), "utf8"); F(r, !/\/cuadro\/helechos\/\*/.test(red), "No hay redirección para los cuadros retirados"); });

  /* ================= E. Celular real (15) ================= */
  grupo("Celular real");
  const LAND = devices["iPhone 13 landscape"];
  await esc("Celular en horizontal", "portada sin desbordes y con el botón principal", async r => {
    const p = await page(LAND); await go(p, "/"); F(r, await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), "Se desborda a lo ancho");
    F(r, !(await p.isVisible(".hero__cta .btn--light")), "No se ve el botón principal"); await p.ctx.close(); });
  await esc("Celular en horizontal", "en la ficha la barra de compra no tapa más de un tercio", async r => {
    const p = await page(LAND); await go(p, "/cuadro/leon-fuerza/"); await p.evaluate(() => scrollTo(0, 600)); await p.waitForTimeout(300);
    const pct = await p.evaluate(() => { const b = document.querySelector("#buyBar"); return b && b.classList.contains("is-on") ? b.getBoundingClientRect().height / innerHeight : 0; });
    r.metricas.barra = Math.round(pct * 100) + "%"; F(r, pct > 0.33, `La barra tapa el ${Math.round(pct * 100)}% de la pantalla`); await p.ctx.close(); });
  for (const esquema of ["dark", "light"]) await esc(`Celular en modo ${esquema === "dark" ? "oscuro" : "claro"}`, "la web se ve igual y legible", async r => {
    const ctx = await browser.newContext({ ...PHONE, colorScheme: esquema }); const p = await ctx.newPage(); await p.goto(BASE + "/");
    const [bg, fg] = await p.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]); r.metricas.colores = `${bg} / ${fg}`;
    F(r, !/rgb\((\d{1,2}), (\d{1,2}), (\d{1,2})\)/.test(bg), `Fondo inesperado: ${bg}`); await ctx.close(); });
  for (const u of ["/", "/cuadro/triptico-fuerza-vision-lealtad/"]) await esc("Letra agrandada al 150% en el celular", `${u}: sin desbordes ni botones cortados`, async r => {
    const p = await page(); await go(p, u); await p.addStyleTag({ content: "html{font-size:150%!important}" }); await p.waitForTimeout(300);
    const res = await p.evaluate(() => { const o = []; if (document.documentElement.scrollWidth > innerWidth + 1) o.push(`Se desborda: ${document.documentElement.scrollWidth} px`);
      document.querySelectorAll("main .btn, .bb .btn").forEach(b => { const r = b.getBoundingClientRect(); if (r.width && (b.scrollWidth > b.clientWidth + 2 || r.right > innerWidth + 1)) o.push(`Botón cortado: «${b.textContent.trim().slice(0, 25)}»`); }); return [...new Set(o)].slice(0, 5); });
    res.forEach(m => r.friccion.push(m)); await p.ctx.close(); });
  await esc("Hace zoom con dos dedos", "la web permite acercar", async r => {
    const v = (html(path.join(ROOT, "index.html")).match(/<meta name="viewport" content="([^"]+)"/) || [])[1] || "";
    F(r, /user-scalable=no|maximum-scale=1(\.0)?\b/.test(v), `El zoom está bloqueado: «${v}»`); });
  await esc("Escribe el apellido con el teclado abierto", "el campo queda visible", async r => {
    const p = await page(); await go(p, "/cuadro/bendice-este-hogar/"); await p.focus("#pFieldList input"); await p.setViewportSize({ width: 390, height: 360 }); await p.waitForTimeout(300);
    await p.evaluate(() => document.activeElement.scrollIntoView({ block: "nearest" }));
    const ok = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(), bb = document.querySelector("#buyBar"); const tapa = bb && bb.classList.contains("is-on") ? bb.getBoundingClientRect().top : innerHeight; return r.top >= 0 && r.bottom <= tapa; });
    F(r, !ok, "El campo queda tapado (por el teclado o la barra de compra)"); await p.ctx.close(); });
  await esc("Escribe su distrito en la selección con el teclado abierto", "el campo queda visible", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.click("#bagDet summary");
    await p.focus("#bagLugar"); await p.setViewportSize({ width: 390, height: 360 }); await p.waitForTimeout(300); await p.evaluate(() => document.activeElement.scrollIntoView({ block: "nearest" }));
    const ok = await p.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }); F(r, !ok, "El campo queda fuera de la pantalla"); await p.ctx.close(); });
  for (const [que, abrir, sel] of [["la búsqueda", "#openSearch", "#search[open]"], ["la foto ampliada", "#pZoom", "#zoom[open]"], ["su selección", "#openBag", '#bag[aria-hidden="false"]']])
    await esc("Usa el botón «atrás» de Android", `con ${que} abierta, «atrás» la cierra sin salir de la página`, async r => {
      const p = await page(); await go(p, "/cuadros-religiosos/"); await go(p, "/cuadro/leon-fuerza/"); await p.click(abrir); await p.waitForTimeout(200);
      await p.goBack(); await p.waitForTimeout(500); const url = p.url();
      F(r, !url.includes("/cuadro/leon-fuerza/"), `«Atrás» lo saca de la página (${url.replace(BASE, "")}) en vez de cerrar ${que}`);
      if (url.includes("/cuadro/leon-fuerza/")) F(r, await p.$(sel), `${que} sigue abierta`); await p.ctx.close(); });
  await esc("Toca un campo de texto en iPhone", "la pantalla no se acerca sola (letra ≥ 16 px)", async r => {
    const p = await page(); const chicos = new Set();
    for (const u of ["/", "/cuadro/bendice-este-hogar/"]) { await go(p, u); await p.click("#openBag"); await p.evaluate(() => { const d = document.getElementById("bagDet"); if (d) d.open = true; });
      (await p.$$eval("input:not([type=checkbox]), select, textarea", es => es.filter(e => e.getClientRects().length).map(e => (e.id || e.name || e.placeholder) + ": " + getComputedStyle(e).fontSize))).forEach(x => { if (parseFloat(x.split(": ")[1]) < 16) chicos.add(x); }); }
    [...chicos].forEach(x => r.friccion.push(`Campo con letra chica (iPhone acerca la pantalla): ${x}`)); await p.ctx.close(); });
  await esc("iPhone con muesca y barra inferior", "la barra de compra respeta la zona segura", async r => {
    const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8"); F(r, !/viewport-fit=cover/.test(html(path.join(ROOT, "index.html"))), "Falta viewport-fit=cover");
    F(r, !/\.bb[^{]*\{[^}]*safe-area-inset-bottom/.test(css) && !/body\.bb-on[^{]*\{[^}]*safe-area/.test(css), "La barra fija no usa safe-area-inset-bottom"); });
  await esc("Desliza hacia abajo para recargar", "el gesto no está bloqueado", async r => {
    const p = await page(); await go(p, "/"); const ob = await p.evaluate(() => getComputedStyle(document.body).overscrollBehaviorY + "/" + getComputedStyle(document.documentElement).overscrollBehaviorY);
    F(r, /none/.test(ob), `overscroll-behavior: ${ob}`); await p.ctx.close(); });

  /* ================= F. Compatibilidad de navegadores (10) ================= */
  grupo("Navegadores (simulados; solo hay Chromium aquí)");
  const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
  await esc("iPhone con Safari (simulado)", "portada y ficha cargan sin errores", async r => {
    const p = await page({ ...PHONE, userAgent: SAFARI_UA }); await go(p, "/"); await go(p, "/cuadro/leon-fuerza/"); await p.click("#pAdd");
    F(r, p.errs.length, "Errores: " + p.errs.join(" | ")); await p.ctx.close(); });
  const CSS = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8"), JS = fs.readFileSync(path.join(ROOT, "app.js"), "utf8");
  await esc("Safari 15 / Firefox antiguo", "lo que usa :has() es solo decorativo", async r => {
    const usos = [...CSS.matchAll(/([^{}]*:has\([^)]*\)[^{]*)\{/g)].map(m => m[1].trim()); r.metricas.usos = usos;
    F(r, usos.some(u => !/\.more|\.revs/.test(u)), `:has() en reglas importantes: ${usos.join(" | ")}`); });
  await esc("Navegadores sin text-wrap: balance", "los títulos siguen bien (solo pierden el balanceo)", async r => { F(r, !/text-wrap:balance/.test(CSS), "No se usa"); });
  await esc("iPhone: «Ver en mi pared» (realidad aumentada)", "el visor 3D incluye el modo de iPhone (Quick Look)", async r => { F(r, !/quick-look/.test(JS), "Falta quick-look en ar-modes"); });
  await esc("Safari antiguo e imágenes", "todas las imágenes son WebP/JPG/PNG/SVG (sin formatos nuevos)", async r => {
    const raros = new Set(); for (const x of TODO) for (const m of x.h.matchAll(/\.(avif|jxl|heic)\b/g)) raros.add(m[1]); F(r, raros.size, `Formatos no compatibles: ${[...raros].join(", ")}`); });
  await esc("Safari 15.0–15.3", "las ventanas (<dialog>) tienen alternativa", async r => {
    F(r, !/HTMLDialogElement|showModal\s*\?|dialog-polyfill/.test(JS), "Usa <dialog> sin alternativa: en iPhone con iOS 15.0–15.3 (≈1% de usuarios) no abren búsqueda ni «Ayúdame a elegir»"); });
  await esc("Navegadores sin sendBeacon", "la medición tiene plan B (fetch)", async r => { F(r, !/sendBeacon[\s\S]{0,120}fetch\(/.test(fs.readFileSync(path.join(ROOT, "medicion.js"), "utf8")), "Sin plan B"); });
  await esc("Navegadores sin «Compartir» nativo", "puede copiar el enlace", async r => { F(r, !/execCommand\("copy"\)/.test(JS), "Sin alternativa para copiar"); });
  await esc("Safari 15.0–15.3 y Android viejo", "el código no usa funciones muy nuevas sin respaldo (.at(), structuredClone)", async r => {
    const usa = [[/\.at\(-?\d/, ".at()"], [/structuredClone\(/, "structuredClone"], [/\.findLast\(/, ".findLast()"], [/Object\.groupBy/, "Object.groupBy"]].filter(([re]) => re.test(JS)).map(([, n]) => n);
    F(r, usa.length, `Usa ${usa.join(", ")}: falla en iOS < 15.4 / Chrome < 92`); });
  await esc("Firefox", "no depende de estilos solo de Chrome (-webkit-) para funcionar", async r => {
    const sin = [...CSS.matchAll(/-webkit-line-clamp:\d/g)].length, con = [...CSS.matchAll(/(?<!-webkit-)line-clamp:\d/g)].length; r.metricas.clamp = { webkit: sin, estandar: con }; r.ok.push("line-clamp con -webkit- funciona también en Firefox ≥ 68"); });

  /* ================= G. Medición (10) ================= */
  grupo("Medición");
  async function capturar(p) { p.ev = []; p.ped = []; await p.ctx.route(/\/api\/(ev|pedido)/, async route => { const b = route.request().postData() || ""; try { const j = JSON.parse(b); route.request().url().includes("pedido") ? p.ped.push(j) : p.ev.push(...[].concat(j)); } catch {} route.fulfill({ status: 200, body: '{"ok":true}', contentType: "application/json" }); }); }
  const nombres = async p => p.evaluate(() => (window.CFTrack ? CFTrack.log : []).map(e => e.name));
  await esc("Entra a la portada", "se registra la visita", async r => { const p = await page(); await capturar(p); await go(p, "/"); F(r, !(await nombres(p)).includes("page_view"), "No registra page_view"); await p.ctx.close(); });
  await esc("Ve un cuadro", "se registra qué cuadro y su valor", async r => { const p = await page(); await go(p, "/cuadro/ultima-cena/");
    const e = await p.evaluate(() => CFTrack.log.find(x => x.name === "view_item")); F(r, !e || e.items[0].item_id !== "ultima-cena" || e.value !== 84, `view_item incorrecto: ${JSON.stringify(e).slice(0, 100)}`); await p.ctx.close(); });
  await esc("Agrega a su selección", "se registra el cuadro agregado", async r => { const p = await page(); await go(p, "/cuadro/leon-fuerza/"); await p.click("#pAdd");
    const e = await p.evaluate(() => CFTrack.log.find(x => x.name === "add_to_cart")); F(r, !e || e.items[0].item_id !== "leon-fuerza", "add_to_cart incorrecto"); await p.ctx.close(); });
  await esc("Abre su selección", "se registra con el total con descuento", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 3 }] } }); await go(p, "/"); await p.click("#openBag");
    const e = await p.evaluate(() => CFTrack.log.find(x => x.name === "view_cart")); F(r, !e, "No registra view_cart"); F(r, e && e.value !== PR.triptico, `Valor ${e && e.value}, esperado ${PR.triptico} (con descuento)`); await p.ctx.close(); });
  await esc("Escribe su distrito", "se registra el dato de envío", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.click("#bagDet summary");
    await p.fill("#bagLugar", "Surco"); await p.press("#bagLugar", "Tab"); F(r, !(await nombres(p)).includes("add_shipping_info"), "No registra add_shipping_info"); await p.ctx.close(); });
  await esc("Envía el pedido por WhatsApp", "se registra con código de pedido", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.click("#bagWa");
    const e = await p.evaluate(() => CFTrack.log.find(x => x.name === "generate_lead")); F(r, !e || !/^CF-/.test(e.transaction_id), "Sin código de pedido");
    F(r, !(await nombres(p)).includes("begin_checkout"), "No registra begin_checkout"); const m = msgOf(await p.getAttribute("#bagWa", "href")); F(r, e && !m.includes(e.transaction_id), "El código no va en el mensaje"); await p.ctx.close(); });
  await esc("El pedido llega al panel", "se envía con código, cuadros y descuento", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }, { s: "aguila-vision", f: null, qty: 1 }, { s: "lobo-lealtad", f: null, qty: 1 }] } });
    await capturar(p); await go(p, "/"); await p.click("#openBag"); await p.click("#bagWa"); await p.waitForTimeout(500);
    const d = p.ped[0]; F(r, !d, "No se envió el pedido al panel"); if (d) { const tot = d.items.reduce((a, i) => a + i.precio * i.qty, 0) - (d.descuento || 0); r.metricas.total = tot;
      F(r, tot !== PR.triptico, `El panel calcularía S/ ${tot}, esperado ${PR.triptico}`); F(r, d.items.length !== 3, "No van los 3 cuadros"); } await p.ctx.close(); });
  await esc("Pide directo desde la ficha", "el pedido también llega al panel", async r => {
    const p = await page(); await capturar(p); await go(p, "/cuadro/tigre-en-el-agua/"); await p.click("#pWa"); await p.waitForTimeout(500);
    F(r, !p.ped.length, "No se envió el pedido al panel"); await p.ctx.close(); });
  await esc("Busca algo", "se registra la búsqueda y cuántos resultados tuvo", async r => {
    const p = await page(); await go(p, "/"); await p.click("#openSearch"); await p.fill("#sq", "jesus"); await p.waitForTimeout(1500);
    const e = await p.evaluate(() => CFTrack.log.find(x => x.name === "search")); F(r, !e || e.search_term !== "jesus", "No registra la búsqueda"); await p.ctx.close(); });
  await esc("Llega desde un anuncio y pide", "el pedido guarda de qué anuncio vino", async r => {
    const p = await page(); await capturar(p); await go(p, "/cuadro/leon-fuerza/?utm_source=facebook&utm_campaign=navidad"); await go(p, "/cuadro/tigre-en-el-agua/");
    await p.click("#pWa"); await p.waitForTimeout(500); const d = p.ped[0]; F(r, !d || (d.origen || {}).utm_source !== "facebook", `Origen guardado: ${JSON.stringify(d && d.origen).slice(0, 80)}`);
    await p.evaluate(() => dispatchEvent(new Event("pagehide"))); await p.waitForTimeout(300); F(r, !p.ev.some(e => e.fu === "facebook"), "Los eventos no llevan la fuente del anuncio"); await p.ctx.close(); });

  await browser.close();
  const mal = R.filter(r => r.friccion.length), porGrupo = {};
  for (const r of R) { const g = (porGrupo[r.grupo] ||= [0, 0]); g[0]++; if (!r.friccion.length) g[1]++; }
  console.log("\nResumen por grupo:"); for (const [g, [t, ok]] of Object.entries(porGrupo)) console.log(`  ${g}: ${ok}/${t}`);
  console.log(`\n${R.length} escenarios · ${R.length - mal.length} sin fricción · ${mal.length} con fricción`);
  const i = process.argv.indexOf("--json"); if (i > 0) fs.writeFileSync(process.argv[i + 1], JSON.stringify(R, null, 1));
})();
