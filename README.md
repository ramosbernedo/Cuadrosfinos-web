# Cuadros Finos — sitio web

Sitio estático (HTML + CSS + JS, sin dependencias ni build) para una tienda de cuadros y enmarcado a medida.

## Funciones
- **Estudio en línea**: sube tu foto (se procesa solo en el navegador), elige moldura, tamaño, orientación y acabados; vista previa en ambientes (sala, dormitorio, oficina) y precio en tiempo real.
- **Pedido por WhatsApp** con el resumen completo del cuadro.
- **Colección** filtrable por categorías.
- Proceso, garantía de calidad, testimonios, FAQ, CTA y botón flotante de WhatsApp.
- Responsive, accesible (teclado, ARIA, `prefers-reduced-motion`) y rápido (todas las obras de muestra son CSS, cero imágenes).

## Personalizar
En `app.js`, arriba del todo:
- `WHATSAPP`: tu número (ej. `51987654321`).
- `FRAMES`, `SIZES`: molduras, medidas y precios.
- `CATALOG`: productos de la colección.

Textos, correo y testimonios están en `index.html`.

## Ver en local
```bash
python3 -m http.server 8000
```
Abre http://localhost:8000
