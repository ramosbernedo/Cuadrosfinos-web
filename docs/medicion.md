# Medición de Cuadros Finos

Cómo saber **qué cuadros se miran, cuáles se piden y en qué paso se cae la venta**.

## 1. Activarlo (una sola vez)

Pon los IDs en `data/catalogo.json` → `config.medicion`, ejecuta `python3 tools/build.py` y sube los cambios:

```json
"medicion": { "ga4": "G-XXXXXXXXXX", "metaPixel": "123456789012345", "clarity": "abcd1234ef" }
```

| Herramienta | Para qué | Dónde se saca el ID |
|---|---|---|
| **Google Analytics 4** | Embudo, productos más vistos y agregados, origen del tráfico | analytics.google.com → Administrar → Flujos de datos → Web → «ID de medición» (`G-…`) |
| **Píxel de Meta** | Anuncios en Facebook/Instagram y audiencias («vio un cuadro y no pidió») | business.facebook.com → Administrador de eventos → Conectar orígenes de datos → Web → «Identificador del píxel» |
| **Microsoft Clarity** (gratis) | Grabaciones de sesiones y mapas de calor: *ver* dónde se traba la gente | clarity.microsoft.com → Nuevo proyecto → Configuración → «ID del proyecto» |

Sin IDs no se carga nada. Con IDs aparece un aviso de cookies (Ley 29733): Analytics funciona sin cookies hasta que el visitante acepta; el Píxel y Clarity solo se cargan si acepta.

**Probar sin ensuciar los datos:** abre cualquier página con `?medir=debug` y mira la consola del navegador (cada evento aparece en verde). `?medir=off` lo apaga.

## 2. El embudo

| Paso | Evento (GA4) | Píxel de Meta | Cuándo |
|---|---|---|---|
| 1 | `view_item_list` | — | Ve el catálogo, una colección o un ambiente |
| 2 | `select_item` | — | Toca un cuadro (dice desde dónde: colección, búsqueda, guía, relacionados…) |
| 3 | `view_item` | ViewContent | Abre la página del cuadro |
| 4 | `ver_pared`, `ver_3d`, `ver_foto`, `zoom`, `personalizar`, `realidad_aumentada` | (personalizado) | Interactúa con el cuadro |
| 5 | `add_to_cart` | AddToCart | Lo agrega a «Mi selección» |
| 6 | `view_cart` | — | Abre «Mi selección» |
| 7 | `add_shipping_info`, `add_payment_info` | AddPaymentInfo | Escribe su distrito / elige pago |
| 8 | `begin_checkout` | InitiateCheckout | Toca «Enviar pedido por WhatsApp» (o «Pedir este por WhatsApp») |
| 9 | **`generate_lead`** | **Lead** | Mismo clic: **es la conversión**. Lleva valor en S/, cuadros y código de pedido |

Otros: `search` (qué buscan), `filtrar`, `share` (WhatsApp / Facebook / copiar), `ayuda_inicio` / `ayuda_resultado` (guía), `contacto_whatsapp` (botón flotante), `remove_from_cart`, `consentimiento`.

## 3. Configurar GA4 (10 minutos)

1. **Marcar la conversión:** Administrar → Eventos → activa «Marcar como evento clave» en `generate_lead`.
2. **Ver el embudo:** Explorar → «Exploración de embudo» → pasos: `view_item` → `add_to_cart` → `view_cart` → `begin_checkout` → `generate_lead`. Desglosa por «Fuente / medio» o «Nombre del artículo».
3. **Producto más visitado / agregado:** Informes → Monetización → Compras de comercio electrónico (usa `view_item` y `add_to_cart`).
4. **Qué buscan:** Informes → Interacción → Eventos → `search` → parámetro `search_term` (regístralo en Administrar → Definiciones personalizadas).
5. Registra también como dimensiones personalizadas: `via`, `ambiente`, `method`, `item_list_id`.

## 4. El código de pedido (unir WhatsApp con la web)

Cada pedido que llega por WhatsApp trae una línea **«Código: CF-7K2Q»**. Ese mismo código llega a GA4 como `transaction_id` del evento `generate_lead`, junto con el origen de la visita (`utm_source`, `utm_campaign`, `fbclid`, `gclid`…).

Cuando cierres la venta en WhatsApp, anota el código en tu hoja de pedidos: así sabes **qué campaña o anuncio trajo esa venta** y qué pedidos no se concretaron.

## 5. Enlaces de campañas (UTM)

Usa siempre UTM en los enlaces que publiques, por ejemplo:

```
https://cuadrosfinos.pe/cuadro/leon-fuerza/?utm_source=instagram&utm_medium=bio&utm_campaign=lanzamiento
https://cuadrosfinos.pe/cuadros-religiosos/?utm_source=facebook&utm_medium=anuncio&utm_campaign=fe-octubre
```

Los botones «Compartir» del sitio ya agregan `utm_source=whatsapp|facebook&utm_campaign=compartir`, para medir cuánto traen los clientes que comparten.
