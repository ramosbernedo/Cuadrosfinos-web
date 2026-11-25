/* Pruebas de navegación, SEO y accesibilidad de Cuadros Finos.
   Uso: python3 -m http.server 8765  (en la raíz)  y luego  node tools/pruebas.js [http://localhost:8765]
   Requiere Playwright con Chromium. */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8765";
const results = []; let fails = 0;
const ok = (name, cond, extra = "") => { results.push(`${cond ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); if (!cond) fails++; };

async function newPage(b, vp = { width: 1366, height: 860 }) {
  const p = await b.newPage({ viewport: vp });
  p._errors = [];
  p.on("pageerror", e => p._errors.push(e.message));
  p.on("console", m => m.type() === "error" && !/fonts\.(googleapis|gstatic)/.test(m.text()) && p._errors.push(m.text()));
  p.on("requestfailed", r => !/fonts\.(googleapis|gstatic)|wa\.me/.test(r.url()) && p._errors.push("falló " + r.url()));
  p.on("response", r => r.status() >= 400 && r.url().startsWith(BASE) && p._errors.push(`${r.status()} ${r.url()}`));
  return p;
}

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const get = async u => { const r = await ctx.request.get(BASE + u, { failOnStatusCode: false }); return { status: r.status(), text: () => r.text() }; };

  /* 1. Recorrer todo el sitio desde el sitemap */
  const sm = await (await get("/sitemap.xml")).text();
  const urls = [...sm.matchAll(/<loc>https?:\/\/[^/]+(\/[^<]*)<\/loc>/g)].map(m => m[1]).filter(u => !/\.(webp|jpg|png)$/.test(u));
  ok("Sitemap con todas las páginas", urls.length >= 100, `${urls.length} URLs`);
  const titles = new Map(), descs = new Map(); let seoBad = [], overflow = [], errs = [], linkSet = new Set();
  const p = await newPage(b, { width: 390, height: 844 });
  for (const u of urls) {
    p._errors = [];
    const r = await p.goto(BASE + u, { waitUntil: "domcontentloaded" });
    await p.waitForTimeout(60);
    if (!r || r.status() !== 200) { errs.push(`${u} → ${r && r.status()}`); continue; }
    const info = await p.evaluate(() => {
      const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => { try { JSON.parse(s.textContent); return true; } catch { return false; } });
      return {
        title: document.title, desc: document.querySelector('meta[name=description]')?.content || "",
        canon: document.querySelector('link[rel=canonical]')?.href || "", h1: document.querySelectorAll("h1").length,
        ldOk: ld.length > 0 && ld.every(Boolean), og: !!document.querySelector('meta[property="og:image"]'),
        noAlt: [...document.images].filter(i => !i.hasAttribute("alt")).length,
        sw: document.documentElement.scrollWidth, lang: document.documentElement.lang,
        links: [...document.querySelectorAll('a[href^="/"]')].map(a => a.getAttribute("href").split("#")[0].split("?")[0]),
      };
    });
    info.links.forEach(l => linkSet.add(l));
    if (titles.has(info.title)) seoBad.push(`título duplicado ${u}`); titles.set(info.title, u);
    if (descs.has(info.desc)) seoBad.push(`descripción duplicada ${u}`); descs.set(info.desc, u);
    if (info.desc.length < 50 || info.desc.length > 170) seoBad.push(`descripción ${info.desc.length} car. ${u}`);
    if (info.title.length > 75) seoBad.push(`título largo (${info.title.length}) ${u}`);
    if (!info.canon.endsWith(u)) seoBad.push(`canonical ${u}`);
    if (info.h1 !== 1) seoBad.push(`${info.h1} h1 en ${u}`);
    if (!info.ldOk) seoBad.push(`JSON-LD ${u}`);
    if (!info.og) seoBad.push(`og:image ${u}`);
    if (info.noAlt) seoBad.push(`${info.noAlt} imágenes sin alt ${u}`);
    if (info.lang !== "es-PE") seoBad.push(`lang ${u}`);
    if (info.sw > 391) overflow.push(`${u} (${info.sw}px)`);
    if (p._errors.length) errs.push(`${u}: ${p._errors.slice(0, 2).join(" | ")}`);
  }
  ok("Todas las páginas cargan sin errores (celular 390 px)", !errs.length, errs.slice(0, 5).join("; "));
  ok("SEO por página (título, descripción, canonical, 1 h1, JSON-LD, og, alt, idioma)", !seoBad.length, seoBad.slice(0, 6).join("; "));
  ok("Sin desplazamiento horizontal en celular", !overflow.length, overflow.slice(0, 5).join("; "));
  const broken = [];
  for (const l of linkSet) { if (/\.(xml|txt|webmanifest)$/.test(l)) continue; const r = await get(l); if (r.status !== 200) broken.push(`${l} ${r.status}`); }
  ok("Enlaces internos sin romper", !broken.length, `${linkSet.size} enlaces revisados${broken.length ? ": " + broken.join(", ") : ""}`);
  for (const f of ["/robots.txt", "/llms.txt", "/llms-full.txt", "/manifest.webmanifest", "/404.html", "/img/og/inicio.jpg", "/img/icon-512.png"]) {
    const r = await get(f); ok(`Existe ${f}`, r.status === 200);
  }
  await p.close();

  /* 2. Ficha en ventana + historial del navegador */
  for (const [name, vp] of [["escritorio", { width: 1366, height: 860 }], ["celular", { width: 390, height: 844 }]]) {
    const q = await newPage(b, vp);
    await q.goto(BASE + "/", { waitUntil: "networkidle" });
    await q.click('#grid .card[data-s="gorila-respeto"] .card__open');
    await q.waitForTimeout(400);
    ok(`[${name}] Tocar un cuadro abre la ficha y cambia la URL`, await q.evaluate(() => document.querySelector("#product").open) && q.url().endsWith("/cuadro/gorila-respeto/"));
    ok(`[${name}] El título de la pestaña cambia`, (await q.title()).startsWith("Gorila"));
    await q.goBack(); await q.waitForTimeout(300);
    ok(`[${name}] Botón Atrás cierra la ficha y vuelve al inicio`, !(await q.evaluate(() => document.querySelector("#product").open)) && new URL(q.url()).pathname === "/");
    await q.click('#grid .card[data-s="leon-fuerza"] .card__open'); await q.waitForTimeout(300);
    await q.click('#pRelated .card__open'); await q.waitForTimeout(300);
    const relUrl = q.url();
    await q.keyboard.press("Escape"); await q.waitForTimeout(400);
    ok(`[${name}] Escape cierra la ficha (también tras abrir un relacionado)`, !(await q.evaluate(() => document.querySelector("#product").open)) && new URL(q.url()).pathname === "/", relUrl);
    await q.goForward(); await q.waitForTimeout(400);
    ok(`[${name}] Adelante reabre la ficha`, await q.evaluate(() => document.querySelector("#product").open));
    await q.click("#product [data-close]"); await q.waitForTimeout(300);
    ok(`[${name}] Sin errores de JavaScript`, !q._errors.length, q._errors.slice(0, 3).join(" | "));
    await q.close();
  }

  /* 3. Teclado */
  {
    const q = await newPage(b);
    await q.goto(BASE + "/", { waitUntil: "networkidle" });
    await q.keyboard.press("Tab");
    ok("Primer Tab: enlace «Saltar al contenido»", (await q.evaluate(() => document.activeElement.className)) === "skip");
    await q.keyboard.press("Enter");
    ok("«Saltar al contenido» lleva al contenido", (await q.evaluate(() => location.hash)) === "#main");
    await q.focus('#grid .card[data-s="tigre-en-el-agua"] .card__open'); await q.keyboard.press("Enter"); await q.waitForTimeout(300);
    ok("Enter en un cuadro abre la ficha", await q.evaluate(() => document.querySelector("#product").open));
    ok("El foco queda dentro de la ficha", await q.evaluate(() => document.querySelector("#product").contains(document.activeElement)));
    await q.keyboard.press("Escape"); await q.waitForTimeout(300);
    await q.keyboard.press("/"); await q.waitForTimeout(200);
    ok("Tecla / abre la búsqueda", await q.evaluate(() => document.querySelector("#search").open));
    await q.keyboard.type("machu"); await q.waitForTimeout(150); await q.keyboard.press("Enter"); await q.waitForTimeout(400);
    ok("Buscar «machu» + Enter abre Machu Picchu", q.url().includes("/cuadro/machu-picchu"), q.url());
    await q.keyboard.press("Escape"); await q.waitForTimeout(300);
    await q.focus('#colFilters [data-col="fe"]'); await q.keyboard.press("ArrowRight");
    ok("Flechas recorren las pestañas de colección", (await q.evaluate(() => document.activeElement.dataset.col)) === "abstracto");
    await q.close();
  }

  /* 4. Filtros, búsqueda y URLs con parámetros */
  {
    const q = await newPage(b);
    await q.goto(BASE + "/?q=leon", { waitUntil: "networkidle" });
    const n = await q.$$eval("#grid .card", c => c.length);
    ok("?q=leon filtra el catálogo (búsqueda sin tildes)", n > 0 && n < 84, `${n} resultados`);
    await q.goto(BASE + "/?c=fe&amb=dormitorio", { waitUntil: "networkidle" });
    ok("?c=fe&amb=dormitorio aplica ambos filtros", /de 84/.test(await q.textContent("#count")) && (await q.$eval("#room", s => s.value)) === "dormitorio");
    await q.click('#colFilters [data-col="poder"]');
    ok("Elegir Poder muestra subcolecciones", (await q.$$eval("#subFilters .chip", c => c.length)) === 4);
    ok("La URL guarda el filtro (se puede compartir)", q.url().includes("c=poder"));
    await q.fill("#q", "zzzz"); await q.waitForTimeout(300);
    ok("Sin resultados muestra mensaje y salida", await q.isVisible("#empty"));
    await q.click("#clearFilters");
    ok("«Ver todos» limpia filtros", (await q.textContent("#count")) === "84 cuadros");
    await q.goto(BASE + "/cuadros-religiosos/", { waitUntil: "networkidle" });
    ok("Página de colección llega filtrada", (await q.$eval('#colFilters [data-col="fe"]', e => e.getAttribute("aria-selected"))) === "true" && /17 de 84/.test(await q.textContent("#count")));
    await q.goto(BASE + "/cuadros-para-sala/", { waitUntil: "networkidle" });
    ok("Página de ambiente llega filtrada", (await q.$eval("#room", s => s.value)) === "sala");
    ok("Sin errores en filtros", !q._errors.length, q._errors.join(" | "));
    await q.close();
  }

  /* 5. Selección / pedido por WhatsApp entre páginas */
  {
    const q = await newPage(b, { width: 390, height: 844 });
    await q.goto(BASE + "/", { waitUntil: "networkidle" });
    await q.evaluate(() => localStorage.clear()); await q.reload({ waitUntil: "networkidle" });
    await q.click('#grid [data-add="gorila-respeto"]');
    ok("«+» agrega a la selección y actualiza el contador", (await q.textContent("#bagCount")) === "1");
    await q.goto(BASE + "/cuadro/triptico-fuerza-vision-lealtad/", { waitUntil: "networkidle" });
    ok("La selección se mantiene al cambiar de página", (await q.textContent("#bagCount")) === "1");
    await q.click("#pAdd");
    await q.goto(BASE + "/cuadro/bendice-este-hogar/", { waitUntil: "networkidle" });
    await q.click("#pAdd");
    ok("Personalizado exige completar sus datos", (await q.textContent("#bagCount")) === "2");
    await q.fill('#pFieldList input', "Familia Pérez"); await q.click("#pAdd");
    await q.reload({ waitUntil: "networkidle" });
    ok("Los datos escritos se recuerdan", (await q.inputValue("#pFieldList input")) === "Familia Pérez");
    await q.click("#openBag"); await q.waitForTimeout(400);
    const msg = decodeURIComponent((await q.getAttribute("#bagWa", "href")).split("text=")[1]);
    await q.fill("#bagLugar", "Surco, Lima"); await q.selectOption("#bagPago", "Yape"); await q.check("#bagRegalo");
    const msg2 = decodeURIComponent((await q.getAttribute("#bagWa", "href")).split("text=")[1]);
    ok("Entrega, pago y regalo van en el mensaje", /Entrega en: Surco, Lima/.test(msg2) && /Pago: Yape/.test(msg2) && /regalo/.test(msg2));
    ok("Mensaje de WhatsApp con los 3 cuadros, datos y total", /Gorila/.test(msg) && /Tríptico/.test(msg) && /Familia Pérez/.test(msg) && /Total: S\/ 357/.test(msg));
    ok("El número de WhatsApp es el de la tienda", (await q.getAttribute("#bagWa", "href")).startsWith("https://wa.me/51944136347"));
    await q.click(".rm >> nth=0"); await q.waitForTimeout(200);
    ok("Quitar un cuadro funciona", (await q.textContent("#bagCount")) === "2");
    await q.click("#toast button"); await q.waitForTimeout(300);
    ok("«Deshacer» lo devuelve", (await q.textContent("#bagCount")) === "3");
    await q.keyboard.press("Escape"); await q.waitForTimeout(300);
    ok("Escape cierra la selección", (await q.getAttribute("#bag", "aria-hidden")) === "true");
    await q.goto(BASE + "/?seleccion=leon-fuerza*2,aguila-vision", { waitUntil: "networkidle" }); await q.waitForTimeout(500);
    ok("Enlace de selección compartida se carga", (await q.textContent("#bagCount")) === "6");
    ok("Sin errores en la selección", !q._errors.length, q._errors.join(" | "));
    await q.close();
  }

  /* 6. Ficha como página, vista en pared, guía y menú */
  {
    const q = await newPage(b, { width: 390, height: 844 });
    await q.goto(BASE + "/cuadro/gorila-respeto/?vista=pared", { waitUntil: "networkidle" });
    ok("Página del cuadro: h1 con el nombre", (await q.textContent("h1")).includes("Gorila"));
    ok("?vista=pared abre la vista en la pared", await q.isVisible("#pScene"));
    await q.click('#sceneRoom [data-v="oficina"]');
    await q.waitForTimeout(300);
    ok("Cambiar ambiente en la pared (foto real)", (await q.getAttribute("#pSceneBg", "src")).includes("pared-oficina") && await q.evaluate(() => document.querySelector("#pSceneBg").naturalWidth > 0));
    const sticky = await q.$eval("#pBuy", e => getComputedStyle(e).position);
    ok("Botones de compra fijos abajo en celular", sticky === "sticky");
    await q.goto(BASE + "/cuadro/foco-disciplina-ejecucion/", { waitUntil: "networkidle" });
    ok("Ficha con galería de fotos reales", (await q.$$eval("#pViews .view", v => v.length)) >= 10);
    await q.click("#pViews .view >> nth=2"); await q.waitForTimeout(300);
    ok("Tocar una miniatura muestra la foto", await q.isVisible("#pPhotoImg") && (await q.getAttribute("#pPhotoImg", "src")).includes("/img/ambiente/"));
    await q.click("#pZoom"); await q.waitForTimeout(300);
    ok("Zoom abre la imagen a pantalla completa", await q.evaluate(() => document.querySelector("#zoom").open));
    await q.click("#zoomImg"); await q.waitForTimeout(400);
    ok("Tocar la imagen acerca", await q.evaluate(() => document.querySelector("#zoom").classList.contains("is-z")));
    await q.keyboard.press("Escape"); await q.waitForTimeout(300);
    ok("Escape cierra el zoom", !(await q.evaluate(() => document.querySelector("#zoom").open)));
    await q.goto(BASE + "/cuadro/manos-en-oracion/", { waitUntil: "networkidle" });
    const lastView = await q.getAttribute("#pViews .view >> nth=-1", "data-src");
    ok("El detalle del marco es del mismo cuadro", lastView === "/img/ambiente/detalle-manos-en-oracion.webp");
    await q.click("#tabPared"); await q.waitForTimeout(1500);
    const t0 = Date.now(); await q.click('#sceneRoom [data-v="dormitorio"]');
    await q.waitForFunction(() => document.querySelector("#pSceneBg").getAttribute("src").includes("dormitorio") && !document.querySelector("#pScene").classList.contains("is-swapping"));
    const dt = Date.now() - t0;
    ok("Cambiar de ambiente es inmediato (fotos precargadas)", dt < 400, `${dt} ms`);
    await q.click("#navToggle"); await q.waitForTimeout(450);
    ok("Menú móvil abre", (await q.getAttribute("#navToggle", "aria-expanded")) === "true" && await q.isVisible("#navLinks a"));
    await q.keyboard.press("Escape");
    ok("Escape cierra el menú móvil", (await q.getAttribute("#navToggle", "aria-expanded")) === "false");
    await q.goto(BASE + "/", { waitUntil: "networkidle" });
    await q.click(".hero__dots button >> nth=2"); await q.waitForTimeout(300);
    ok("Portada: los puntos cambian la foto y el pie", (await q.$eval(".hero__slide.is-on", i => i.dataset.pie)) === (await q.textContent("#heroCapTxt")) && (await q.$$eval(".hero__slide", s => s.findIndex(x => x.classList.contains("is-on")))) === 2);
    await q.locator("[data-open-quiz]").first().click();
    await q.click('#qOpts [data-v="sala"]'); await q.click('#qOpts [data-back]');
    ok("Guía: «Volver» regresa al paso anterior", (await q.textContent("#qStep")) === "Paso 1 de 3");
    await q.click('#qOpts [data-v="sala"]'); await q.click('#qOpts [data-v="fe"]'); await q.click('#qOpts [data-v="set"]');
    ok("Guía: entrega 6 recomendaciones", (await q.$$eval("#qRes .card", c => c.length)) === 6);
    await q.click("#qRes .card__open >> nth=0"); await q.waitForTimeout(400);
    ok("Guía: tocar una recomendación abre su ficha", await q.evaluate(() => document.querySelector("#product").open));
    await q.goto(BASE + "/#cuadro/tigre-en-el-agua", { waitUntil: "networkidle" });
    ok("Enlaces antiguos #cuadro/… redirigen", q.url().endsWith("/cuadro/tigre-en-el-agua/"));
    await q.goto(BASE + "/cuadro/leon-fuerza/", { waitUntil: "networkidle" });
    ok("«Vistos recientemente» aparece tras ver varios cuadros", await q.isVisible("#recent") && (await q.$$eval("#recentGrid .card", c => c.length)) >= 2);
    await q.goto(BASE + "/404.html", { waitUntil: "networkidle" });
    ok("Página 404 con salida al catálogo", (await q.textContent("h1")).length > 0 && (await q.$$eval(".card", c => c.length)) > 0);
    ok("Sin errores", !q._errors.length, q._errors.join(" | "));
    await q.close();
  }

  await b.close();
  console.log(results.join("\n"));
  console.log(`\n${results.length - fails} de ${results.length} pruebas OK`);
  process.exit(fails ? 1 : 0);
})();
