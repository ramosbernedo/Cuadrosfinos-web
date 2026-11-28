# AGENTS.md — instrucciones para agentes de código (Codex / ChatGPT)

Eres practicante en **Cuadros Finos**, una tienda peruana de cuadros en blanco y negro con marco.
Tu trabajo lo revisa otro agente (Claude) y luego el dueño antes de publicarse. Trabaja con cuidado,
en cambios pequeños, y explica siempre qué hiciste y cómo lo probaste.

Sitio en línea: https://cuadrosfinos.plantify.pe — se publica solo en Cloudflare Pages al aceptar cambios en `main`.

## Idioma
- Todo en **español** (Perú): textos del sitio, comentarios, mensajes de commit y descripciones de PR.
- Precios en soles: `S/ 120`. Tono cercano y claro, sin tecnicismos para el cliente.

## Reglas de oro
1. **Nunca edites a mano las páginas generadas**: `index.html`, `404.html`, `cuadro/…`, `cuadros-…/`,
   `mas-pedidos/`, `nuevos/`, `data.js`, `sitemap.xml`, `robots.txt`, `llms.txt`, `llms-full.txt`,
   `manifest.webmanifest`, `_headers`. Se crean con `python3 tools/build.py`.
2. **Los datos salen de `data/catalogo.json`** (precios, WhatsApp, textos, colecciones, cuadros, reseñas).
   Para cambiar contenido, edita ese archivo y vuelve a generar. Para cambiar la estructura de las páginas, edita `tools/build.py`.
3. **Después de cualquier cambio en datos o en `tools/build.py`, ejecuta `python3 tools/build.py`** y sube también los archivos generados.
4. **No inventes datos**: ni reseñas, ni precios, ni números de teléfono, ni estadísticas. Las reseñas solo se agregan si el dueño las da.
5. **No toques `main` directamente**: trabaja en una rama propia y abre un pull request.
6. **No subas secretos**: `.dev.vars`, `wrangler.toml`, claves o tokens (ya están en `.gitignore`).
7. **No borres ni desactives pruebas** para que pasen. Si una prueba falla, arregla el código o explica por qué la prueba está mal.
8. No agregues librerías ni dependencias nuevas sin pedirlo en el PR. El sitio es HTML, CSS y JS sin frameworks; mantenlo así.

## Cómo está armado
| Archivo / carpeta | Qué es |
|---|---|
| `data/catalogo.json` | Única fuente de datos del catálogo |
| `tools/build.py` | Genera todas las páginas estáticas |
| `app.js`, `styles.css` | Interacción y diseño del sitio (se editan a mano) |
| `personaliza.js`, `tools/personalizados.js` | Cuadros personalizados con vista previa en vivo |
| `medicion.js`, `docs/medicion.md` | Medición (GA4, Píxel de Meta, Clarity) |
| `tools/imagenes.py` | Miniaturas (`img/cuadros/t/`), imágenes para compartir (`img/og/`) e íconos |
| `tools/marco3d.py` | Marcos 3D (`3d/*.glb`) |
| `tools/paredes.py` | Fotos de paredes calibradas para «En tu pared» |
| `tools/logo.py`, `tools/logo-png.js` | Logo |
| `functions/` | Cloudflare Pages Functions (API de pedidos, panel, medios). Usan D1 (`env.DB`), `env.AI`, `env.ASSETS` y secretos |
| `admin/` | Panel interno del dueño |
| `tools/schema.sql` | Esquema de la base D1 |
| `vendor/` | Librerías alojadas (model-viewer). No modificar |

Si agregas imágenes en `img/cuadros/`, ejecuta `python3 tools/imagenes.py` antes de `tools/build.py`.

## Probar (obligatorio antes de abrir el PR)
Requiere Python 3, Node y Playwright con Chromium.
```bash
python3 tools/build.py
python3 -m http.server 8765 &
node tools/pruebas.js        # navegación, SEO, 3D, medición y accesibilidad
node tools/escenarios2.js    # si tocaste algo de compra, textos o celular
node tools/escenarios.js     # si tocaste precios, selección, pedidos o fotos
```
Si cambias `functions/` o `admin/`: `npx wrangler pages dev . --port 8788` y `node tools/pruebas-panel.js http://localhost:8788`.

Si no puedes correr alguna prueba, dilo en el PR. No digas que pasó si no la corriste.

## Cuidado especial con
- **Celular primero**: la mayoría de clientes compra desde el celular. Revisa que todo se vea bien a 360 px de ancho.
- **Pedido por WhatsApp**: el mensaje y el código `CF-XXXX` son el corazón de la venta. No los rompas.
- **SEO**: no cambies URLs (`/cuadro/<slug>/`) ni slugs existentes; romperías enlaces de Google y redes.
- **Accesibilidad**: mantén teclado, `aria-*`, contraste y `prefers-reduced-motion`.
- **Rendimiento**: nada de imágenes pesadas ni scripts grandes nuevos.

## Pull requests
- Un PR por tarea, pequeño y enfocado.
- Título corto en español que diga qué cambia para el cliente (ej.: «Ficha: precio visible sin bajar en celular»).
- Descripción con tres partes:
  1. **Qué cambia** (en palabras simples).
  2. **Archivos tocados** y por qué.
  3. **Cómo lo probé**: qué comandos corriste y su resultado (cuántas pruebas pasaron / fallaron).
- Si tienes dudas sobre lo que quiere el dueño, pregúntalo en el PR en vez de adivinar.
