/* Pruebas del panel (/admin) y de la API, contra el servidor de Pages con D1.
   Uso local:  npx wrangler pages dev . --port 8788   y luego   node tools/pruebas-panel.js http://localhost:8788
   Requiere una base vacía (o que el correo de prueba exista con la clave de prueba). */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://localhost:8788";
const SETUP = process.argv[3] || "CLAVE-LOCAL";
const results = []; let fails = 0;
const ok = (n, c, x = "") => { results.push(`${c ? "✔" : "✘"} ${n}${x ? " — " + x : ""}`); if (!c) fails++; };
const UA = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, userAgent: UA });
  ctx.on("page", np => { if (np.url().includes("wa.me")) np.close().catch(() => {}); });
  const api = ctx.request;
  const errs = [];

  // 1. Seguridad básica sin sesión
  let r = await api.get(BASE + "/api/admin/pedidos", { failOnStatusCode: false });
  ok("La API privada rechaza sin sesión", r.status() === 401);
  r = await api.post(BASE + "/api/pedido", { data: { codigo: "malo", items: [] }, failOnStatusCode: false });
  ok("Un pedido inválido se rechaza", r.status() === 400);
  r = await api.post(BASE + "/api/pedido", { headers: { origin: "https://otro-sitio.com" }, data: { codigo: "CF-2345", items: [{ s: "x", n: "x", qty: 1, precio: 1 }] }, failOnStatusCode: false });
  ok("Otros sitios no pueden escribir pedidos", r.status() === 403);

  // 2. Instalación: crea la cuenta de administrador
  const p = await ctx.newPage();
  p.on("pageerror", e => errs.push(e.message));
  await p.goto(BASE + "/admin/", { waitUntil: "networkidle" });
  const est = await (await api.get(BASE + "/api/admin/estado")).json();
  if (est.necesitaSetup) {
    await p.fill("[name=clave]", "clave-equivocada"); await p.fill("[name=nombre]", "Prueba"); await p.fill("[name=email]", "admin@prueba.pe"); await p.fill("[name=password]", "una-clave-segura-123");
    await p.click("button"); await p.waitForTimeout(500);
    ok("La instalación exige la clave correcta", await p.isVisible("#err"));
    await p.fill("[name=clave]", SETUP); await p.click("button"); await p.waitForSelector(".kpis", { timeout: 10000 });
    ok("Crear la cuenta de administrador entra al panel", await p.isVisible(".kpis"));
  } else {
    await p.fill("[name=email]", "admin@prueba.pe"); await p.fill("[name=password]", "una-clave-segura-123"); await p.click("button"); await p.waitForSelector(".kpis");
    ok("Ingreso al panel", true);
  }
  r = await api.post(BASE + "/api/admin/setup", { data: { clave: SETUP, email: "otro@x.pe", password: "0123456789ab" }, failOnStatusCode: false });
  ok("La instalación no se puede repetir", r.status() === 409);

  // 3. Un cliente hace un pedido desde la web (selección → WhatsApp)
  const c = await ctx.newPage();
  await c.goto(BASE + "/cuadro/gorila-respeto/?utm_source=instagram&utm_campaign=prueba-panel", { waitUntil: "networkidle" });
  await c.evaluate(() => localStorage.removeItem("cf_bag"));
  await c.reload({ waitUntil: "networkidle" });
  await c.click("#pAdd");
  await c.goto(BASE + "/cuadro/bendice-este-hogar/", { waitUntil: "networkidle" });
  await c.fill("#pFieldList input", "Familia <img src=x onerror=alert(1)> Pérez"); await c.click("#pAdd");
  await c.click("#openBag"); await c.waitForTimeout(300);
  await c.fill("#bagLugar", "Arequipa"); await c.selectOption("#bagPago", "Yape");
  await c.click("#bagWa"); await c.waitForTimeout(1500);
  const href = decodeURIComponent(await c.getAttribute("#bagWa", "href"));
  const codigo = (href.match(/CF-[2-9A-Z]{4}/) || [])[0];
  ok("El cliente envía su pedido por WhatsApp con código", !!codigo, codigo);

  // 4. El pedido aparece en el panel
  await p.goto(BASE + "/admin/#/pedidos", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  ok("El pedido aparece solo en el panel", await p.isVisible(`[data-cod="${codigo}"]`));
  let alerted = false; p.on("dialog", d => { alerted = true; d.dismiss(); });
  await p.click(`[data-cod="${codigo}"]`); await p.waitForSelector(".drawer");
  const txtDrawer = await p.textContent(".drawer");
  ok("El detalle trae cuadros, personalización, distrito, pago y origen", /Gorila/.test(txtDrawer) && /Bendice/.test(txtDrawer) && /Arequipa/.test(await p.inputValue("[name=lugar]")) && (await p.inputValue("[name=pago]")) === "Yape" && /instagram/.test(txtDrawer));
  ok("Texto malicioso del cliente se muestra como texto (no se ejecuta)", !alerted && /<img src=x/.test(txtDrawer));

  // 5. Gestión: datos del cliente, estados y entregas
  await p.fill("[name=cliente]", "María Pérez"); await p.fill("[name=telefono]", "987654321"); await p.fill("[name=total_final]", "200");
  await p.click(".guardar .btn--p"); await p.waitForTimeout(800);
  ok("Guardar datos del cliente", (await p.inputValue("[name=cliente]")) === "María Pérez");
  ok("Con celular aparecen los mensajes rápidos de WhatsApp", (await p.$$(".wa-plantillas a")).length === 5 && (await p.getAttribute(".wa-plantillas a", "href")).startsWith("https://wa.me/51987654321"));
  ok("Siguiente paso en un toque: «Confirmar pedido»", (await p.textContent(".acciones .btn--p")).includes("Confirmar"));
  await p.click(".mas-estados summary"); await p.click('#pasos [data-e="pagado"]'); await p.waitForTimeout(900);
  ok("Marcar como pagado pone fecha prometida automática", (await p.inputValue("[name=fecha_prometida]")).length === 10 && (await p.textContent(".hist")).includes("Nuevo → Pagado"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  await p.goto(BASE + "/admin/#/entregas", { waitUntil: "networkidle" }); await p.waitForTimeout(600);
  ok("El pedido pagado aparece en Entregas › Por producir", (await p.textContent(".col-ent > div:nth-child(2)")).includes(codigo));
  await p.click(`[data-sig="${codigo}"]`); await p.waitForTimeout(700);
  ok("Avanzar a «En producción» desde Entregas", (await p.textContent(".col-ent > div:nth-child(2)")).includes("En producción"));

  // 5b. Inicio: «Para hoy», semáforo, tablero, buscador y tema
  const c2 = await ctx.newPage();
  await c2.goto(BASE + "/cuadro/leon-fuerza/", { waitUntil: "networkidle" });
  await c2.click("#pWa"); await c2.waitForTimeout(1200);
  const cod2 = (decodeURIComponent(await c2.getAttribute("#pWa", "href")).match(/CF-[2-9A-Z]{4}/) || [])[0];
  await p.goto(BASE + "/admin/#/resumen", { waitUntil: "networkidle" }); await p.waitForSelector(".hoy");
  ok("Inicio: «Responder ya» muestra el pedido nuevo con su tiempo de espera", (await p.textContent(".hoy .rojo")).includes(cod2) && !!(await p.$(".hoy .rojo .esp")));
  ok("Inicio: semáforo con las 6 cifras clave", (await p.$$(".salud .ind")).length === 6);
  ok("Aviso de pedidos nuevos en el menú y en la pestaña", (await p.title()).startsWith("(") && !!(await p.$('.side a[href="#/pedidos"] .badge')));
  await p.goto(BASE + "/admin/#/pedidos", { waitUntil: "networkidle" }); await p.waitForTimeout(400);
  await p.click('.top .seg [data-v="tablero"]'); await p.waitForSelector(".kanban");
  await p.dragAndDrop(`.kcard[data-cod="${cod2}"]`, '.kcol[data-col="confirmado"]'); await p.waitForTimeout(900);
  ok("Tablero: arrastrar un pedido cambia su estado", (await p.textContent('.kcol[data-col="confirmado"]')).includes(cod2));
  await p.click('.top .seg [data-v="lista"]'); await p.waitForTimeout(300);
  await p.keyboard.press("Control+k"); await p.waitForSelector(".paleta input");
  await p.fill(".paleta input", cod2); await p.waitForTimeout(700); await p.keyboard.press("Enter"); await p.waitForSelector(".drawer");
  ok("Buscador global (Ctrl+K) abre el pedido", (await p.textContent(".drawer h1")).includes(cod2));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  const t0 = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.click("#tema"); await p.waitForTimeout(300);
  ok("Cambiar entre modo claro y oscuro", (await p.evaluate(() => document.documentElement.dataset.theme)) !== t0);
  await p.click("#tema");
  await c2.close();

  // 6. Resumen
  await p.goto(BASE + "/admin/#/resumen", { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  const res = await (await api.get(BASE + "/api/admin/resumen?dias=30")).json();
  ok("Resumen: cuenta el pedido, la venta cobrada y la fuente", res.kpi.pedidos >= 1 && res.kpi.ventas >= 200 && res.fuentes.some(f => f.fuente === "instagram"), `ventas S/ ${res.kpi.ventas}`);
  ok("Resumen: el embudo recibe las visitas de la web", (res.embudo.page_view || 0) >= 1 && (res.embudo.generate_lead || 0) >= 1, JSON.stringify(res.embudo));
  ok("Resumen: cuadros más pedidos y más vistos", res.top.some(t => t.s === "gorila-respeto") && res.vistos.some(v => v.s === "gorila-respeto"));

  // 6b. Marketing
  const mk = await (await api.get(BASE + "/api/admin/marketing?dias=30")).json();
  ok("Marketing: fuentes, productos con interés vs ventas y embudo por fuente", mk.ok && mk.fuentes.some(f => f.fuente === "instagram") && mk.productos.some(x => x.s === "gorila-respeto" && x.vieron >= 1 && x.pedidos >= 1) && mk.embudoFuente.length >= 1);
  await p.goto(BASE + "/admin/#/marketing", { waitUntil: "networkidle" }); await p.waitForTimeout(700);
  ok("Marketing: la vista carga sin errores", (await p.textContent("h1")).includes("Marketing") && await p.isVisible(".kpis"));

  // 6c. Productos: crear, subir imagen, publicar, cambiar precio, ocultar y restaurar (sin gastar IA)
  {
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mNgYGAAAAAEAAHI6uv5AAAAAElFTkSuQmCC", "base64");
    const cr = await (await api.post(BASE + "/api/admin/productos", { data: { nuevo: true, estado: "borrador", datos: { n: "Prueba · Panel", f: "Creado en las pruebas.", c: "poder", a: ["sala"], o: "vertical" } } })).json();
    ok("Productos: crear un cuadro nuevo (borrador)", cr.ok && /^prueba-panel/.test(cr.slug), cr.slug);
    const up = await api.put(BASE + `/api/admin/media/${cr.slug}/obra.webp`, { headers: { "content-type": "image/png" }, data: png });
    await api.put(BASE + `/api/admin/media/${cr.slug}/t.webp`, { headers: { "content-type": "image/png" }, data: png });
    ok("Productos: subir su imagen", up.status() === 200 && (await api.get(BASE + `/media/${cr.slug}/obra.webp`)).status() === 200);
    let r2 = await api.get(BASE + `/cuadro/${cr.slug}/`, { failOnStatusCode: false });
    ok("Productos: un borrador no aparece en la web", r2.status() === 404);
    await api.post(BASE + "/api/admin/productos", { data: { slug: cr.slug, estado: "publicado", datos: { n: "Prueba · Panel", f: "Creado en las pruebas.", c: "poder", a: ["sala"], o: "vertical", i: 1, m: "t1" } } });
    r2 = await api.get(BASE + `/cuadro/${cr.slug}/`);
    const htm = await r2.text();
    ok("Productos: al publicar tiene su página con título, Google (JSON-LD) y su imagen", r2.status() === 200 && htm.includes("<title>Prueba · Panel · Cuadro con marco") && htm.includes('"@type":"Product"') && htm.includes(`/media/${cr.slug}/og.jpg`));
    const dj = await (await api.get(BASE + "/data.js?x=" + Date.now())).text();
    ok("Productos: entra al catálogo de la web y al mapa del sitio", dj.includes(`"s":"${cr.slug}"`) && (await (await api.get(BASE + "/sitemap.xml")).text()).includes(`/cuadro/${cr.slug}/`));
    const nv = await b.newContext(); const pv = await nv.newPage();
    await pv.goto(BASE + `/cuadro/${cr.slug}/`, { waitUntil: "networkidle" });
    ok("Productos: la página del cuadro nuevo funciona (imagen, precio y botones)", (await pv.$eval("#pStage img", i => i.src)).includes(`/media/${cr.slug}/obra.webp`) && (await pv.textContent("#pPrice")) === "S/ 84" && await pv.isVisible("#pAdd"));
    await nv.close();
    await api.post(BASE + "/api/admin/productos", { data: { slug: "leon-fuerza", estado: "publicado", datos: { ...{ n: "León · Fuerza", f: "El que no necesita rugir.", c: "poder", u: "animales", a: ["oficina", "sala"], o: "vertical", i: 1, t: 1 }, pr: 95 } } });
    const nv2 = await b.newContext(); const pv2 = await nv2.newPage();
    await pv2.goto(BASE + "/cuadro/leon-fuerza/", { waitUntil: "networkidle" });
    ok("Productos: precio especial en un cuadro de la web", (await pv2.textContent("#pPrice")) === "S/ 95");
    await nv2.close();
    await api.patch(BASE + `/api/admin/productos/${cr.slug}`, { data: { estado: "oculto" } });
    ok("Productos: ocultar lo saca de la web", (await api.get(BASE + `/cuadro/${cr.slug}/`, { failOnStatusCode: false })).status() === 404);
    await api.delete(BASE + `/api/admin/productos/${cr.slug}`); await api.delete(BASE + "/api/admin/productos/leon-fuerza");
    ok("Productos: deshacer devuelve el cuadro original", (await api.get(BASE + "/cuadro/leon-fuerza/")).status() === 200 && !(await (await api.get(BASE + "/data.js?y=" + Date.now())).text()).includes('"pr":95'));
    await p.goto(BASE + "/admin/#/productos", { waitUntil: "networkidle" }); await p.waitForSelector(".prod");
    ok("Productos: la sección lista los cuadros", (await p.$$(".prod")).length >= 80);
  }

  // 7. Pedido manual, usuarios y límite de intentos
  const man = await (await api.post(BASE + "/api/admin/pedidos", { data: { items: [{ s: "leon-fuerza", n: "León · Fuerza", qty: 2, precio: 84 }], cliente: "Tienda", fuente: "instagram" } })).json();
  ok("Pedido manual desde el panel", man.ok && /^CF-/.test(man.codigo));
  const nu = await (await api.post(BASE + "/api/admin/usuarios", { data: { email: "equipo@prueba.pe", nombre: "Equipo" }, failOnStatusCode: false })).json();
  ok("Dar acceso a otra persona del equipo (con contraseña temporal)", nu.ok && !!nu.temporal || /ya tiene acceso/.test(nu.error || ""));
  const anon = await chromium.launch().then(x => x.newContext());
  let bloqueado = false;
  for (let i = 0; i < 9; i++) { const rr = await anon.request.post(BASE + "/api/admin/login", { data: { email: "admin@prueba.pe", password: "mala" + i }, failOnStatusCode: false }); if (rr.status() === 429) bloqueado = true; }
  ok("Tras 8 intentos fallidos se bloquea el ingreso 15 minutos", bloqueado);
  ok("Sin errores de JavaScript en el panel", !errs.length, errs.join(" | "));

  await b.close();
  console.log(results.join("\n"));
  console.log(`\n${results.length - fails} de ${results.length} pruebas del panel OK`);
  process.exit(fails ? 1 : 0);
})();
