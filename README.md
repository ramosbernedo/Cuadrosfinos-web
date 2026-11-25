# Plantify Cuadros — sitio nuevo

Versión rediseñada de https://cuadros.plantify.pe/ como sitio estático: HTML, CSS y JS, sin build ni dependencias.

## Qué incluye
- **Los 84 cuadros reales** (`data.js`) con sus colecciones, subcolecciones, ambientes, etiquetas “Más pedido” / “Nuevo” y campos de personalización. Las imágenes están en `img/cuadros/`.
- **Ficha de cada cuadro** en ventana propia, con enlace compartible (`#cuadro/slug`).
- **“En tu pared”**: el cuadro a escala real (30 × 37 cm, tríptico ≈ 98 cm) sobre un sofá, una cama, un escritorio o un aparador, con color de pared a elección.
- **Mi selección**: se guardan varios cuadros, incluso personalizados, y se mandan en **un solo mensaje de WhatsApp** con total.
- **Ayúdame a elegir**: 3 preguntas (pared, estilo, formato) → 6 recomendaciones.
- Catálogo con filtros por colección y subcolección, ambiente, orden y búsqueda sin tildes. Búsqueda rápida con la tecla `/`.
- Personalizados (+ S/ 40) con sus campos; los del Papa León XIV se cotizan al 912 012 451.
- Responsive y accesible (teclado, `prefers-reduced-motion`, ARIA).

## Cambiar precios, WhatsApp o colecciones
En `app.js`, arriba del todo: `CONFIG` (WhatsApp, precios) y `COLECCIONES`.
Para agregar un cuadro: una línea en `data.js` + su imagen en `img/cuadros/<slug>.webp`
(trípticos y dípticos: `<slug>-1.webp`, `-2.webp`, `-3.webp`).

## Ver en local
```bash
python3 -m http.server 8000   # y abrir http://localhost:8000
```
