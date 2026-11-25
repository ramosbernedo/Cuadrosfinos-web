# Cuadros Finos — sitio web

Tienda de cuadros en blanco y negro con marco. Sitio estático (HTML, CSS y JS) generado con Python y publicado en Cloudflare Pages.
Catálogo e imágenes tomados de cuadros.plantify.pe (mismos dueños), con marca propia.

**En línea (provisional):** https://cuadrosfinos.pages.dev

## Cómo está armado
| Archivo / carpeta | Qué es |
|---|---|
| `data/catalogo.json` | **Única fuente de datos**: precios, WhatsApp, dominio, colecciones, ambientes y los 84 cuadros |
| `tools/build.py` | Genera todas las páginas, `data.js`, `sitemap.xml`, `robots.txt`, `llms.txt`… |
| `tools/imagenes.py` | Genera miniaturas (`img/cuadros/t/`), imágenes para compartir (`img/og/`) e íconos |
| `tools/marco3d.py` | Genera los marcos 3D a tamaño real (`3d/*.glb`) para la vista 3D y la realidad aumentada |
| `tools/paredes.py` | Convierte fotos reales en paredes vacías calibradas a escala para «En tu pared» |
| `personaliza.js`, `tools/personalizados.js` | Diseños en vivo de los personalizados y sus imágenes de catálogo |
| `tools/pruebas.js` | 81 pruebas de navegación, SEO, 3D y accesibilidad con Playwright |
| `app.js`, `styles.css` | Interacción y diseño |
| `index.html`, `cuadro/…`, `cuadros-…/` | Páginas generadas (no editar a mano) |

## Cambiar algo
1. Edita `data/catalogo.json` (precio, número de WhatsApp, textos, un cuadro nuevo…).
2. Si agregaste imágenes nuevas en `img/cuadros/`: `python3 tools/imagenes.py`
3. `python3 tools/build.py`
4. Sube los cambios a GitHub: Cloudflare publica solo.

**Pasar al dominio propio:** cambia `config.sitio` a `https://cuadrosfinos.pe` en `data/catalogo.json`, ejecuta `build.py` y súbelo.

## Probar
```bash
python3 -m http.server 8765 &
node tools/pruebas.js
```

## Qué incluye
- 100 páginas: inicio, 84 fichas (`/cuadro/<slug>/`), 8 colecciones, 3 especiales (más pedidos, nuevos, personalizados) y 4 por ambiente (sala, dormitorio, oficina, comedor).
- Cada cuadro tiene su página propia para compartir (WhatsApp, Facebook, copiar enlace) y para Google; Atrás vuelve al catálogo en el mismo lugar.
- “En tu pared”: el cuadro a escala sobre fotos reales de sala, dormitorio, oficina y escritorio.
- **3D y realidad aumentada**: el cuadro en 3D girable y «Ver en mi pared» con la cámara del celular, a tamaño real (model-viewer 4.3.1, alojado en `vendor/`).
- Personalizados con vista previa en vivo.
- Selección de varios cuadros → un solo pedido por WhatsApp; se puede compartir por enlace (`?seleccion=`).
- “Ayúdame a elegir”, búsqueda sin tildes (tecla `/`), filtros compartibles (`?q=`, `?c=`, `?amb=`).
- **SEO:** títulos y descripciones únicos, canonical, Open Graph con imagen propia por cuadro (WhatsApp/Facebook), datos estructurados (Store/LocalBusiness, Product con precio en PEN y envío, BreadcrumbList, FAQPage, ItemList, WebSite con buscador), sitemap con imágenes.
- **GEO (buscadores con IA):** `llms.txt` y `llms-full.txt` con datos clave y catálogo completo, `robots.txt` que permite a GPTBot, ClaudeBot, PerplexityBot, etc.; descripciones factuales por cuadro.
- **SEO local:** Lima / Perú en datos estructurados, `geo.region`, páginas por ambiente y menciones de envío a provincias.
- Rendimiento: miniaturas de 400 px, imagen principal precargada, caché larga con versión, cabeceras de seguridad (`_headers`).
- Accesibilidad: teclado completo, foco atrapado en ventanas, `aria-*`, contraste, `prefers-reduced-motion`.
