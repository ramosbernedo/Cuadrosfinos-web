# Diseñar cuadros con ChatGPT (practicante de diseño)

El cupo de ChatGPT es **compartido**: no se quema. Una idea → un mosaico → ok → una final.

## Las reglas (siempre)
1. **Primero un mosaico de prueba**: una sola imagen 3×3 con 9 ideas chiquitas, baja calidad. Solo para ver composición y tonos.
2. **Se muestra y se espera el ok.** Nada de seguir sin que elijan una.
3. **La final, una sola, al tamaño exacto** (tabla abajo). Nunca más grande ni en HD si no hace falta.
4. **Sin variantes extra** ni "hazme 4 opciones".
5. **Si algo sale mal, se corrige sobre la elegida** ("cambia solo el fondo"), no se regenera desde cero.
6. **Para explicar medidas o armado** → diagrama o boceto, no imagen de IA.
7. **De 1 en 1 o de 2 en 2**: se muestran y se espera el ok antes del resto. Nunca tandas sin mirar.

## Tamaños de la tienda
Todas las imágenes de cuadros de la web son proporción **2:3** (se imprimen a 30 × 37 cm con marco negro).

| Formato | Tamaño final a pedir |
|---|---|
| Vertical (la mayoría) | **1000 × 1500 px** |
| Horizontal | **1500 × 1000 px** |
| Tríptico / díptico | Cada pieza por separado, vertical 1000 × 1500 px |
| Mosaico de prueba | 1024 × 1024 px, baja calidad |

## Estilo de Cuadros Finos
- **Blanco y negro**, sin color. Grises suaves, negros profundos.
- Fondo limpio, mucho aire alrededor del motivo; que se vea fino y elegante en una pared.
- Sin marco dibujado (el marco lo pone la web y el taller), sin texto salvo que el cuadro sea de frase.
- Sin marcas de agua, firmas, logos ni bordes.

---

## Plantilla 1 — Mosaico de prueba (copiar y pegar)

```
Haz UNA sola imagen tipo mosaico 3×3 (9 recuadros) en baja calidad, 1024×1024,
solo para elegir composición. No es la imagen final.

Tema del cuadro: [ej.: un león de perfil, mirada serena]
Para: [sala / dormitorio / oficina / comedor / consultorio…]
Estilo: blanco y negro, sin color, elegante y minimalista, fondo limpio,
mucho espacio alrededor del motivo. Formato vertical 2:3 en cada recuadro.
Varía en los 9: encuadre, tamaño del motivo y tipo de fondo.
NO quiero: color, texto, marcos dibujados, firmas, marcas de agua, bordes.
Numera cada recuadro del 1 al 9.
```

→ Mandar el mosaico y **esperar que elijan un número**.

## Plantilla 2 — Imagen final (solo con el ok)

```
Ahora la versión final del recuadro N.º [X] del mosaico, igual composición.
Una sola imagen, vertical, exactamente 1000×1500 px. Sin variantes.
Blanco y negro, sin color, fondo limpio.
NO quiero: texto, marco dibujado, firma, marca de agua, bordes.
```

## Plantilla 3 — Corregir (sobre la elegida)

```
Sobre esta misma imagen, cambia SOLO [el fondo / la luz / el tamaño del motivo…].
Todo lo demás igual. Mismo tamaño 1000×1500.
```

---

## Cuando una imagen queda aprobada
1. Guárdala con un nombre corto sin tildes ni espacios: `leon-sereno.webp` (o `.png`).
2. Pásala para subirla a la web (va en `img/cuadros/` y se agrega en `data/catalogo.json`).
