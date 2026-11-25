# Cuadros Finos — sitio web

Tienda de cuadros en blanco y negro con marco, como sitio estático: HTML, CSS y JS, sin build ni dependencias.
Catálogo e imágenes tomados de cuadros.plantify.pe (mismos dueños), con marca propia.

## Qué incluye
- **Los 84 cuadros reales** (`data.js`) con sus colecciones, subcolecciones, ambientes, etiquetas “Más pedido” / “Nuevo” y campos de personalización. Las imágenes están en `img/cuadros/`.
- **Ficha de cada cuadro** en ventana propia, con enlace compartible (`#cuadro/slug`).
- **“En tu pared”**: el cuadro a escala real (30 × 37 cm, tríptico ≈ 98 cm) sobre un sofá, una cama, un escritorio o un aparador, con color de pared a elección.
- **Mi selección**: se guardan varios cuadros, incluso personalizados, y se mandan en **un solo mensaje de WhatsApp** con total.
- **Ayúdame a elegir**: 3 preguntas (pared, estilo, formato) → 6 recomendaciones.
- Catálogo con filtros por colección y subcolección, ambiente, orden y búsqueda sin tildes. Búsqueda rápida con la tecla `/`.
- Personalizados (+ S/ 40) con sus campos; los del Papa León XIV se cotizan por WhatsApp.
- Responsive y accesible (teclado, `prefers-reduced-motion`, ARIA).

## Cambiar precios, WhatsApp o colecciones
En `app.js`, arriba del todo: `CONFIG` (WhatsApp, precios) y `COLECCIONES`.
Para agregar un cuadro: una línea en `data.js` + su imagen en `img/cuadros/<slug>.webp`
(trípticos y dípticos: `<slug>-1.webp`, `-2.webp`, `-3.webp`).

## Ver en local
```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```

## Publicar en Cloudflare Pages
Workers & Pages → Create → Pages → Connect to Git → este repositorio y su rama.
Build command: (vacío) · Build output directory: `/`. Luego, en Custom domains, agrega tu dominio.
