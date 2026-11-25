/* Genera las imágenes del catálogo de los personalizados con los mismos
   diseños de personaliza.js (texto de ejemplo). Uso, con el sitio servido:
     python3 -m http.server 8765 &
     node tools/personalizados.js [http://localhost:8765]
   Luego: python3 tools/imagenes.py --todo && python3 tools/build.py */
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const path = require("path");
const BASE = process.argv[2] || "http://localhost:8765";
const OUT = path.join(__dirname, "..", "img", "cuadros");
const SLUGS = ["familia-apellido", "nuestra-fecha", "tu-cielo", "bendice-este-hogar", "tu-ciudad"];

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 1170 }, deviceScaleFactor: 1 });
  await p.goto(BASE + "/cuadro/familia-apellido/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  for (const s of SLUGS) {
    await p.evaluate(slug => {
      document.body.innerHTML = `<div id="arte" style="position:fixed;inset:0;width:900px;height:1170px">${CFPersonal.svg(slug, [])}</div>`;
      const svg = document.querySelector("#arte svg"); svg.style.width = "900px"; svg.style.height = "1170px"; svg.style.display = "block";
    }, s);
    await p.waitForTimeout(400);
    const png = path.join(OUT, s + ".png");
    await p.locator("#arte").screenshot({ path: png });
    execFileSync("python3", ["-c", `from PIL import Image;import os;i=Image.open(${JSON.stringify(png)}).convert("RGB");i.save(${JSON.stringify(path.join(OUT, s + ".webp"))},"WEBP",quality=86,method=6);os.remove(${JSON.stringify(png)})`]);
    console.log("ok", s);
  }
  await b.close();
})();
