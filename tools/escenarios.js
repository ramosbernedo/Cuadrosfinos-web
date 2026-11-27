/* 100 escenarios de usuarios reales: navegabilidad, UX/UI y facilidad para comprar.
   No busca errores de código: mide fricción (cuántos toques, cuánto scroll, si el precio
   y el botón de compra se ven, si una búsqueda termina en callejón sin salida…).
   Uso:  python3 -m http.server 8765 &  node tools/escenarios.js  [--json salida.json]  */
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE || "http://localhost:8765";
const PHONE = devices["iPhone 13"], SMALL = devices["iPhone SE"], DESK = { viewport: { width: 1366, height: 800 } };

let browser;
async function page(dev = PHONE, { storage } = {}) {
  const ctx = await browser.newContext({ ...dev, deviceScaleFactor: 1 });
  await ctx.route(/wa\.me|facebook\.com|googletagmanager|clarity/, r => r.abort());
  const p = await ctx.newPage();
  if (storage) { await p.goto(BASE + "/404.html"); await p.evaluate(s => Object.entries(s).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))), storage); }
  p.ctx = ctx; return p;
}
const go = async (p, url) => { await p.goto(BASE + url, { waitUntil: "load" }); await p.waitForTimeout(250); };
const vh = p => p.viewportSize().height;
// Posición (y en la página) de un elemento visible
const yOf = (p, sel) => p.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.offsetParent || e.getClientRects().length); if (!el) return null; const r = el.getBoundingClientRect(); return Math.round(r.top + scrollY); }, sel);
const visibleNow = (p, sel) => p.evaluate(s => { const el = [...document.querySelectorAll(s)].find(e => e.getClientRects().length); if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
  return r.bottom > 0 && r.top < innerHeight && cs.visibility !== "hidden" && +cs.opacity > 0.1; }, sel);
const firstCardY = p => yOf(p, "#grid .card, .cards .card");
const waHref = p => p.evaluate(() => (document.querySelector("#pWa") || {}).href || "");
const msgOf = href => { try { return decodeURIComponent(new URL(href).searchParams.get("text") || ""); } catch { return ""; } };
const textOf = (p, sel) => p.evaluate(s => (document.querySelector(s) || {}).textContent || "", sel);

/* Resultado de cada escenario: fricciones (lo que le cuesta al usuario) y notas */
const R = [];
async function esc(id, quien, objetivo, fn) {
  const r = { id, quien, objetivo, friccion: [], ok: [], metricas: {} };
  try { await fn(r); } catch (e) { r.friccion.push("Se trabó: " + String(e.message).split("\n")[0]); }
  R.push(r);
  process.stdout.write(`${r.friccion.length ? "✗" : "✓"} ${String(id).padStart(3)} ${quien} — ${objetivo}${r.friccion.length ? "\n      · " + r.friccion.join("\n      · ") : ""}\n`);
}
const F = (r, cond, msg) => { if (cond) r.friccion.push(msg); else r.ok.push(msg); };

/* ---------- llegadas desde anuncios / enlaces directos a una ficha ---------- */
async function llegadaFicha(r, slug, dev = PHONE) {
  const p = await page(dev); await go(p, `/cuadro/${slug}/`);
  const h = vh(p);
  const priceY = await yOf(p, "#pPrice"), titleY = await yOf(p, "#pTitle");
  r.metricas.precioY = priceY; r.metricas.tituloY = titleY;
  const barra = await p.evaluate(() => document.querySelector("#buyBar")?.classList.contains("is-on"));
  const precioVisible = (priceY !== null && priceY < h - 40) || barra;
  F(r, !precioVisible, `Precio no visible al entrar (y=${priceY}, pantalla ${h})`);
  F(r, !(await visibleNow(p, "#pTitle")) && !barra, "El nombre del cuadro no se ve sin hacer scroll");
  const ctaVisible = (await visibleNow(p, "#pWa")) || barra;
  F(r, !ctaVisible, "Botón de compra no visible al entrar");
  return p;
}

/* ---------- main ---------- */
(async () => {
  browser = await chromium.launch();
  const conImagen = ["leon-fuerza", "tigre-en-el-agua", "ultima-cena", "caballo-negro", "senor-de-los-milagros", "themis-justicia", "vara-de-esculapio", "monstera", "machu-picchu-niebla", "flor-de-la-vida"];

  // 1–10: Llega desde un anuncio de Instagram/Facebook directo a la ficha (celular)
  let n = 1;
  for (const s of conImagen) await esc(n++, "Llega de un anuncio (celular)", `ver precio y pedir «${s}» sin buscar`, async r => {
    const p = await llegadaFicha(r, s);
    const t0 = Date.now(); const pop = p.waitForEvent("popup").catch(() => null);
    await p.click("#bbWa:visible, #pWa:visible");
    const msg = msgOf(await waHref(p));
    F(r, !/S\/\s?\d+/.test(msg), "El mensaje de WhatsApp no lleva el precio");
    F(r, !msg.includes("/cuadro/"), "El mensaje no lleva el enlace del cuadro");
    r.metricas.toques = 1; r.metricas.ms = Date.now() - t0; await p.ctx.close();
  });

  // 11: tríptico, 12: personalizado, 13: cuadro del Papa (cotizar), 14: sin imagen, 15: iPhone SE
  await esc(n++, "Llega a un tríptico", "entender que son 3 piezas y cuánto miden", async r => {
    const p = await llegadaFicha(r, "triptico-fuerza-vision-lealtad");
    const t = await p.evaluate(() => document.body.innerText);
    F(r, !/3 piezas|tres|tríptico/i.test(t), "No queda claro que son 3 piezas");
    F(r, !/98 cm/.test(t), "No dice el ancho total");
    await p.ctx.close();
  });
  await esc(n++, "Quiere un regalo con nombre", "personalizar «Bendice este hogar» y pedir", async r => {
    const p = await llegadaFicha(r, "bendice-este-hogar");
    const y = await yOf(p, "#pFieldList input"); r.metricas.campoY = y;
    F(r, y > vh(p) * 2.2, `Los campos para personalizar están muy abajo (y=${y})`);
    await p.click("#bbWa:visible, #pWa:visible");
    const focus = await p.evaluate(() => document.activeElement?.tagName);
    F(r, focus !== "INPUT", "Al pedir sin datos no lo lleva al campo a completar");
    const inputs = await p.$$("#pFieldList input");
    for (const [i, el] of inputs.entries()) await el.fill(i ? "2026" : "Familia Quispe");
    const msg = msgOf(await waHref(p));
    F(r, !/Quispe/.test(msg), "El mensaje no incluye los datos personalizados");
    await p.ctx.close();
  });
  await esc(n++, "Fiel católico (Papa León XIV)", "saber cuánto cuesta un cuadro del Papa", async r => {
    const p = await page(); await go(p, "/cuadro/papa-frente-a-machu-picchu/");
    const pr = await textOf(p, "#pPrice");
    F(r, /cotiza/i.test(pr), `No hay precio, solo «${pr.trim()}»: pedir cotización frena la compra por impulso`);
    await p.ctx.close();
  });
  await esc(n++, "Llega a un cuadro sin foto", "ver cómo es antes de comprar", async r => {
    const p = await page(); await go(p, "/cuadro/paso-a-paso/");
    const img = await p.$("#pStage img");
    F(r, !img, "La ficha no muestra imagen (solo «Vista previa por WhatsApp»): baja la confianza");
    await p.ctx.close();
  });
  await esc(n++, "Celular pequeño (iPhone SE)", "ver precio y botón al entrar a una ficha", async r => { const p = await llegadaFicha(r, "leon-fuerza", SMALL); await p.ctx.close(); });

  // 16–25: Llega a la portada por Google / Instagram bio (celular)
  await esc(n++, "Entra a la portada (celular)", "ver un cuadro con precio en la primera pantalla", async r => {
    const p = await page(); await go(p, "/");
    const y = await firstCardY(p); r.metricas.primerCuadroY = y;
    F(r, y > vh(p), `El primer cuadro con precio aparece en y=${y} (pantalla ${vh(p)}): ${Math.round(y / vh(p) * 10) / 10} pantallas de scroll`);
    const precio = await p.evaluate(() => { const els = [...document.querySelectorAll("body *")].filter(e => /S\/\s?\d/.test(e.textContent) && !e.children.length); return els.map(e => Math.round(e.getBoundingClientRect().top + scrollY)).sort((a, b) => a - b)[0]; });
    r.metricas.primerPrecioY = precio;
    F(r, precio > vh(p), `El primer precio aparece en y=${precio}`);
    await p.ctx.close();
  });
  await esc(n++, "Entra a la portada (celular)", "ver el botón principal sin hacer scroll", async r => {
    const p = await page(); await go(p, "/");
    F(r, !(await visibleNow(p, ".hero__cta .btn")), "El botón «Encuentra tu cuadro» queda bajo el pliegue");
    await p.ctx.close();
  });
  await esc(n++, "Entra a la portada (celular)", "llegar a los más pedidos", async r => {
    const p = await page(); await go(p, "/");
    const y = await yOf(p, "#topGrid .card"); r.metricas.masPedidosY = y;
    F(r, y > vh(p) * 3, `Los más pedidos están a ${Math.round(y / vh(p) * 10) / 10} pantallas de scroll`);
    await p.ctx.close();
  });
  await esc(n++, "Entra a la portada (celular)", "llegar al catálogo completo", async r => {
    const p = await page(); await go(p, "/");
    const y = await yOf(p, "#grid .card"); r.metricas.catalogoY = y;
    F(r, y > vh(p) * 8, `El catálogo está a ${Math.round(y / vh(p) * 10) / 10} pantallas de scroll`);
    await p.ctx.close();
  });
  await esc(n++, "Entra a la portada (celular)", "largo total razonable", async r => {
    const p = await page(); await go(p, "/");
    const H = await p.evaluate(() => document.documentElement.scrollHeight); r.metricas.alto = H;
    F(r, H > vh(p) * 18, `La portada mide ${Math.round(H / vh(p))} pantallas: mucho scroll para un comprador por impulso`);
    await p.ctx.close();
  });
  await esc(n++, "Toca «Encuentra tu cuadro»", "ver cuadros enseguida", async r => {
    const p = await page(); await go(p, "/");
    await p.click(".hero__cta .btn--light"); await p.waitForTimeout(900);
    const vis = await p.evaluate(() => [...document.querySelectorAll(".card")].some(c => { const b = c.getBoundingClientRect(); return b.top >= 0 && b.top < innerHeight - 100; }));
    F(r, !vis, "Tras tocar el botón principal aún no se ve ningún cuadro (lleva a una lista de temas)");
    await p.ctx.close();
  });
  await esc(n++, "Entra a la portada (celular)", "agregar un más pedido con un toque", async r => {
    const p = await page(); await go(p, "/");
    await p.locator("#topGrid .card__add").first().scrollIntoViewIfNeeded(); await p.locator("#topGrid .card__add").first().click();
    await p.waitForTimeout(500); const c = await textOf(p, "#bagCount"); F(r, c.trim() !== "1", "El contador de la selección no subió");
    F(r, !(await visibleNow(p, "#toast")), "No hay confirmación visible");
    await p.ctx.close();
  });
  await esc(n++, "Escritorio: portada", "ver precio en la primera pantalla", async r => {
    const p = await page(DESK); await go(p, "/");
    const precio = await p.evaluate(() => [...document.querySelectorAll("body *")].some(e => !e.children.length && /S\/\s?\d/.test(e.textContent) && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0));
    F(r, !precio, "En escritorio no se ve ningún precio en la primera pantalla");
    await p.ctx.close();
  });
  await esc(n++, "Escritorio: portada", "ver algún cuadro del catálogo en la primera pantalla", async r => {
    const p = await page(DESK); await go(p, "/");
    const y = await firstCardY(p); F(r, y > 800, `Primer cuadro en y=${y} en escritorio`);
    await p.ctx.close();
  });
  await esc(n++, "Escritorio: portada", "el hero rota sin distraer del CTA", async r => {
    const p = await page(DESK); await go(p, "/");
    F(r, !(await visibleNow(p, ".hero__cta .btn")), "CTA no visible en escritorio"); await p.ctx.close();
  });

  // 26–40: Colecciones y ambientes como página de aterrizaje (celular)
  const cols = ["cuadros-motivacionales", "cuadros-religiosos", "cuadros-abstractos", "cuadros-botanicos", "cuadros-de-peru-y-ciudades", "cuadros-de-geometria-sagrada", "cuadros-para-profesionales", "cuadros-del-papa-leon-xiv", "mas-pedidos", "nuevos", "cuadros-personalizados", "cuadros-para-sala", "cuadros-para-dormitorio", "cuadros-para-oficina", "cuadros-para-comedor"];
  for (const c of cols) await esc(n++, "Llega a una colección desde Google/anuncio", `ver cuadros enseguida en /${c}/`, async r => {
    const p = await page(); await go(p, `/${c}/`);
    const y = await firstCardY(p); r.metricas.primerCuadroY = y;
    F(r, y === null, "No hay cuadros");
    F(r, y > vh(p) * 1.3, `El primer cuadro aparece a ${Math.round(y / vh(p) * 10) / 10} pantallas (y=${y})`);
    await p.ctx.close();
  });

  // 41–60: Búsquedas reales (desde la lupa)
  const busq = [["abogado", 1], ["médico", 1], ["león", 1], ["jesús", 1], ["machu picchu", 1], ["regalo", 1], ["bebé", 1], ["baño", 1], ["perro", 1], ["amor", 1], ["café", 1], ["restaurante", 1], ["barato", 1], ["dinero", 1], ["música", 1], ["yoga", 1], ["fútbol", 1], ["envío", 1], ["tríptico", 1], ["cuadro grande", 1]];
  for (const [q] of busq) await esc(n++, "Busca con la lupa", `«${q}» y encontrar algo que comprar`, async r => {
    const p = await page(); await go(p, "/"); await p.click("#openSearch"); await p.fill("#sq", q); await p.waitForTimeout(80);
    const k = await p.$$eval("#sRes a.s-item:not(.s-item--col):not(.s-item--sug)", a => a.length); r.metricas.resultados = k;
    const sug = await p.$$eval("#sRes a.s-item--sug", a => a.length);
    F(r, !k && !sug, `«${q}»: 0 cuadros y ninguna sugerencia → callejón sin salida`);
    if (!k && sug) r.ok.push(`«${q}»: sin coincidencia exacta, pero ofrece ${sug} cuadros más pedidos`);
    if (k) { await p.keyboard.press("Enter"); await p.waitForTimeout(500); F(r, !/\/cuadro\/|cuadros-/.test(p.url()) && !(await p.$("#product[open]")), "Enter no lleva a ningún lado"); }
    await p.ctx.close();
  });

  // 61–66: Menú y navegación
  await esc(n++, "Abre el menú (celular)", "llegar a «Para sala» en 2 toques", async r => {
    const p = await page(); await go(p, "/"); await p.click("#navToggle"); await p.waitForTimeout(300);
    const l = p.locator('#nav a[href="/cuadros-para-sala/"]:visible'); const vis = await l.count();
    if (!vis) { const b = p.locator(".nav__dd:visible").first(); if (await b.count()) { await b.click(); r.metricas.toques = 3; } }
    await p.locator('#nav a[href="/cuadros-para-sala/"]').first().click(); await p.waitForLoadState();
    F(r, !p.url().includes("para-sala"), "No llegó"); F(r, r.metricas.toques === 3, "Necesita 3 toques (submenú)");
    await p.ctx.close();
  });
  await esc(n++, "Abre el menú (celular)", "ver la selección/carrito desde el menú", async r => {
    const p = await page(); await go(p, "/");
    F(r, !(await visibleNow(p, "#openBag")), "El ícono de selección no se ve");
    const txt = await textOf(p, "#openBag"); const bolsa = await p.$("#openBag svg path");
    F(r, !/selecci|carrito|bolsa/i.test(txt) || !bolsa, "El ícono de «selección» es un cuadradito sin texto: no se entiende que es el carrito");
    await p.ctx.close();
  });
  await esc(n++, "Escritorio: menú «Por tema»", "abrir y elegir Religiosos", async r => {
    const p = await page(DESK); await go(p, "/");
    await p.locator(".nav__dd").nth(1).click(); await p.locator('#nav a[href="/cuadros-religiosos/"]').first().click(); await p.waitForLoadState();
    F(r, !p.url().includes("religiosos"), "No llegó"); await p.ctx.close();
  });
  await esc(n++, "Usuario con scroll largo", "volver arriba / al menú fácilmente", async r => {
    const p = await page(); await go(p, "/"); await p.evaluate(() => scrollTo(0, 6000)); await p.waitForTimeout(300);
    F(r, !(await visibleNow(p, "#openSearch")), "El encabezado no queda fijo al bajar");
    await p.ctx.close();
  });
  await esc(n++, "Ve un cuadro y toca «Atrás»", "volver al mismo lugar del catálogo", async r => {
    const p = await page(); await go(p, "/cuadros-motivacionales/");
    const card = p.locator("#grid .card").nth(5); await card.scrollIntoViewIfNeeded(); const y0 = await p.evaluate(() => scrollY);
    await card.locator(".card__open").click(); await p.waitForTimeout(600); await p.goBack(); await p.waitForTimeout(700);
    const y1 = await p.evaluate(() => scrollY); F(r, Math.abs(y1 - y0) > 200, `Vuelve a otra altura (${y0} → ${y1})`);
    await p.ctx.close();
  });
  await esc(n++, "Escribe una URL vieja/rota", "la 404 le ayuda a seguir", async r => {
    const p = await page(); await go(p, "/404.html");
    const links = await p.$$eval("main a, a.card__open", a => a.length); F(r, links < 3, "La 404 no ofrece caminos");
    await p.ctx.close();
  });

  // 67–76: Selección (carrito) y pedido
  await esc(n++, "Arma una selección de 3 cuadros", "pedir todo en un mensaje con el precio por cantidad", async r => {
    const p = await page(); await go(p, "/cuadros-religiosos/");
    for (let i = 0; i < 3; i++) { const b = p.locator("#grid .card__add").nth(i); await b.scrollIntoViewIfNeeded(); await b.click(); }
    await p.click("#openBag"); await p.waitForTimeout(300);
    const msg = msgOf(await p.getAttribute("#bagWa", "href"));
    F(r, !/Total: S\/ 149/.test(msg), "3 cuadros sueltos no salen al precio del tríptico (S/ 149): " + (msg.match(/Total: [^\n]+/) || [""])[0]);
    F(r, !(await visibleNow(p, "#bagWa")), "El botón «Enviar pedido» no se ve sin scroll en el cajón");
    await p.ctx.close();
  });
  await esc(n++, "Agrega desde la tarjeta", "ver un aviso que lo lleve a pedir", async r => {
    const p = await page(); await go(p, "/cuadros-religiosos/"); const b = p.locator("#grid .card__add").first(); await b.scrollIntoViewIfNeeded(); await b.click();
    const t = await textOf(p, "#toast"); F(r, !/Ver selecci|Pedir/i.test(t), "El aviso no ofrece ir a pedir"); await p.ctx.close();
  });
  await esc(n++, "Agrega 2 iguales", "subir cantidad en la selección", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); await p.click("#pAdd"); await p.click("#pAdd");
    await p.click("#openBag"); await p.waitForTimeout(200); const q = await textOf(p, ".qty span"); F(r, q !== "2", `Cantidad ${q}`); await p.ctx.close();
  });
  await esc(n++, "Selección con 1 cuadro", "ver sugerencia de completar (tríptico / otro)", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.waitForTimeout(200);
    const t = await p.evaluate(() => document.querySelector("#bag").innerText);
    F(r, !/combina|tambi|completa|agrega|sugerido|tríptico/i.test(t), "El carrito no sugiere nada para subir el ticket (p. ej. armar el tríptico)");
    await p.ctx.close();
  });
  await esc(n++, "Selección con 3 cuadros sueltos del tríptico", "enterarse que el tríptico sale más barato", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }, { s: "aguila-vision", f: null, qty: 1 }, { s: "lobo-lealtad", f: null, qty: 1 }] } });
    await go(p, "/"); await p.click("#openBag"); await p.waitForTimeout(200);
    const t = await p.evaluate(() => document.querySelector("#bag").innerText);
    F(r, !/ahorr|149|tríptico/i.test(t), "Paga S/ 252 por 3 piezas que como tríptico cuestan S/ 149 y nadie se lo avisa");
    await p.ctx.close();
  });
  await esc(n++, "Selección vacía", "saber qué hacer", async r => {
    const p = await page(); await go(p, "/"); await p.click("#openBag"); await p.waitForTimeout(200);
    F(r, !(await visibleNow(p, ".bag-empty a")), "No hay camino para seguir"); await p.ctx.close();
  });
  await esc(n++, "Quita un cuadro por error", "deshacer", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.click("[data-rm]");
    const t = await textOf(p, "#toast"); F(r, !/Deshacer/.test(t), "No hay deshacer"); await p.ctx.close();
  });
  await esc(n++, "Compra de 2+ cuadros", "ver incentivo (envío/descuento) por llevar más", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/");
    const t = await p.evaluate(() => document.body.innerText);
    F(r, !/(2|dos|3|tres) cuadros|por volumen|lleva|descuento|envío gratis/i.test(t), "No hay ningún incentivo para llevar más de uno");
    await p.ctx.close();
  });
  await esc(n++, "Comparte su selección con su pareja", "enlace que la reconstruye", async r => {
    const p = await page(); await go(p, "/?seleccion=leon-fuerza,tigre-en-el-agua*2"); await p.waitForTimeout(600);
    const c = await textOf(p, "#bagCount"); F(r, c.trim() !== "3", `Contador ${c}`); await p.ctx.close();
  });
  await esc(n++, "Llega con el cajón abierto", "ver el total claro y medios de pago", async r => {
    const p = await page(PHONE, { storage: { cf_bag: [{ s: "leon-fuerza", f: null, qty: 1 }] } }); await go(p, "/"); await p.click("#openBag"); await p.waitForTimeout(200);
    const t = await p.evaluate(() => document.querySelector("#bag").innerText); F(r, !/Yape|Plin/i.test(t), "No muestra medios de pago en el cajón"); await p.ctx.close();
  });

  // 77–84: Ficha: confianza, objeciones, venta cruzada
  await esc(n++, "Duda del tamaño", "ver el cuadro a escala en su pared", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); await p.click('[data-tab="pared"]'); await p.waitForTimeout(400);
    F(r, !(await visibleNow(p, "#pWall")), "No se ve la vista en pared"); await p.ctx.close();
  });
  await esc(n++, "Duda si es confiable", "ver reseñas o fotos de clientes", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/reseña|opini|clientes|★|estrellas|pedidos entregados|testimonio/i.test(t), "No hay prueba social (reseñas, clientes, pedidos entregados)");
    await p.ctx.close();
  });
  await esc(n++, "Pregunta por provincia", "saber costo y tiempo de envío a Arequipa", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/(provincia|agencia).{0,80}(S\/|soles|costo|pago en destino|a cargo)/i.test(t) && !/envío.{0,40}(S\/|gratis)/i.test(t), "No dice cuánto cuesta el envío (Lima ni provincia): duda que frena el pedido");
    await p.ctx.close();
  });
  await esc(n++, "Quiere pagar con tarjeta", "saber que se puede", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText); F(r, !/tarjeta/i.test(t), "No menciona tarjeta"); await p.ctx.close();
  });
  await esc(n++, "Mira la ficha de un león", "ver sugerencia de armar el tríptico", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/Tríptico Fuerza/i.test(t), "No sugiere el tríptico del que es parte"); await p.ctx.close();
  });
  await esc(n++, "Mira una ficha", "ver cuadros parecidos sin bajar demasiado", async r => {
    const p = await page(); await go(p, "/cuadro/tigre-en-el-agua/"); const y = await yOf(p, ".pd__related .card, #pRelated .card, .sec--tight .card"); r.metricas.relY = y;
    F(r, y === null || y > vh(p) * 4, `«Combinan con este» aparece a ${y ? Math.round(y / vh(p) * 10) / 10 : "?"} pantallas`); await p.ctx.close();
  });
  await esc(n++, "Mira una ficha", "la barra fija no tapa contenido importante", async r => {
    const p = await page(); await go(p, "/cuadro/tigre-en-el-agua/"); await p.evaluate(() => scrollTo(0, document.body.scrollHeight)); await p.waitForTimeout(300);
    const tapa = await p.evaluate(() => { const b = document.querySelector("#buyBar"), f = document.querySelector(".wa-float"); if (!b || !f) return false; const x = b.getBoundingClientRect(), y = f.getBoundingClientRect(); return b.classList.contains("is-on") && y.bottom > x.top && y.top < x.bottom; });
    F(r, tapa, "El botón flotante de WhatsApp choca con la barra de compra"); await p.ctx.close();
  });
  await esc(n++, "Ficha: zoom", "ver el detalle de la obra", async r => {
    const p = await page(); await go(p, "/cuadro/tigre-en-el-agua/"); await p.click("#pZoom"); await p.waitForTimeout(200);
    F(r, !(await p.$("#zoom[open]")), "No abre el zoom"); await p.ctx.close();
  });

  // 85–90: Ayúdame a elegir
  for (const [room, style, fmt] of [["sala", "poder", "set"], ["oficina", "oficio", "uno"], ["dormitorio", "fe", "uno"], ["comedor", "calma", "any"], ["sala", "pers", "any"], ["oficina", "lugares", "set"]])
    await esc(n++, "Indeciso usa «Ayúdame a elegir»", `${room} · ${style} · ${fmt}`, async r => {
      const p = await page(); await go(p, "/"); await p.locator("[data-open-quiz]:visible").first().click();
      for (const v of [room, style, fmt]) await p.click(`#qOpts [data-v="${v}"]`);
      const k = await p.$$eval("#qRes .card", c => c.length); F(r, k < 3, `Solo ${k} recomendaciones`);
      const precios = await p.$$eval("#qRes .card__price", c => c.length); F(r, !precios, "Las recomendaciones no muestran precio");
      const add = await p.$$eval("#qRes [data-add]", c => c.length); F(r, !add, "No se puede agregar desde las recomendaciones (obliga a abrir cada uno)");
      if (fmt === "set") { const t = await p.$$eval("#qRes h3", h => h.map(x => x.textContent).join("|")); F(r, !/Tríptico|Díptico/.test(t), "Pidió conjunto y no le sale ningún tríptico"); }
      await p.ctx.close();
    });

  // 91–95: Catálogo / filtros
  await esc(n++, "Filtra Religiosos + Dormitorio", "ver resultados al instante", async r => {
    const p = await page(); await go(p, "/?c=fe&amb=dormitorio"); await p.waitForTimeout(400);
    const k = await p.$$eval("#grid .card", c => c.length); F(r, !k, "Sin resultados"); await p.ctx.close();
  });
  await esc(n++, "Ordena por precio", "ver los más baratos primero", async r => {
    const p = await page(); await go(p, "/cuadros-motivacionales/"); await p.selectOption("#sort", "precio"); await p.waitForTimeout(200);
    const pr = await p.$$eval("#grid .card__price", c => c.slice(0, 3).map(x => x.textContent)); F(r, !/84/.test(pr[0]), `Primero: ${pr[0]}`); await p.ctx.close();
  });
  await esc(n++, "Filtra hasta 0 resultados", "tener una salida", async r => {
    const p = await page(); await go(p, "/?c=papa&amb=comedor"); await p.waitForTimeout(300);
    F(r, !(await p.$("#empty:not([hidden])")) && !(await p.$$eval("#grid .card", c => c.length)), "Sin mensaje"); await p.ctx.close();
  });
  await esc(n++, "Toca «Ver más cuadros»", "seguir viendo sin perder el lugar", async r => {
    const p = await page(); await go(p, "/"); await p.locator("#more").scrollIntoViewIfNeeded(); const y0 = await p.evaluate(() => scrollY); await p.click("#more"); await p.waitForTimeout(200);
    const y1 = await p.evaluate(() => scrollY); F(r, Math.abs(y1 - y0) > 300, "Salta de posición"); await p.ctx.close();
  });
  await esc(n++, "Tarjetas del catálogo", "precio legible y botón + fácil de tocar (≥40px)", async r => {
    const p = await page(); await go(p, "/cuadros-motivacionales/"); const b = await p.locator("#grid .card__add").first().boundingBox();
    F(r, b.width < 40 || b.height < 40, `Botón + de ${Math.round(b.width)}×${Math.round(b.height)} px`); await p.ctx.close();
  });

  // 96–100: Contacto / WhatsApp / confianza general
  await esc(n++, "Quiere hablar con alguien", "encontrar WhatsApp en todo momento", async r => {
    const p = await page(); await go(p, "/cuadros-religiosos/"); F(r, !(await visibleNow(p, ".wa-float")), "No hay WhatsApp visible"); await p.ctx.close();
  });
  await esc(n++, "Empresa (pedido corporativo)", "saber que atienden volumen", async r => {
    const p = await page(); await go(p, "/cuadros-para-oficina/"); const t = await p.evaluate(() => document.body.innerText); F(r, !/empresa|corporativ|volumen/i.test(t), "No menciona empresas"); await p.ctx.close();
  });
  await esc(n++, "Comprador por impulso en la ficha", "sentir urgencia / razón para pedir hoy", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/hoy|esta semana|llega el|recíbelo el|antes del/i.test(t), "No hay fecha estimada de llegada ni motivo para pedir hoy");
    await p.ctx.close();
  });
  await esc(n++, "Regalo (Navidad / cumpleaños)", "ver opción de regalo clara", async r => {
    const p = await page(); await go(p, "/cuadro/leon-fuerza/"); const t = await p.evaluate(() => document.body.innerText);
    F(r, !/regalo/i.test(t), "La ficha no menciona que se puede pedir para regalo"); await p.ctx.close();
  });
  await esc(n++, "Escritorio: ficha", "precio y botón visibles en la primera pantalla", async r => { const p = await llegadaFicha(r, "ultima-cena", DESK); await p.ctx.close(); });

  await browser.close();
  const mal = R.filter(r => r.friccion.length);
  console.log(`\n${R.length} escenarios · ${R.length - mal.length} sin fricción · ${mal.length} con fricción`);
  const i = process.argv.indexOf("--json"); if (i > 0) require("fs").writeFileSync(process.argv[i + 1], JSON.stringify(R, null, 1));
})();
