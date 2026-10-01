---
description: Nueva ronda de maquetas — fija lo que te gustó, quita lo que no y propone algo nuevo
---

Uso: `/ronda [tu opinión de la ronda anterior, o el texto que copia el panel de las maquetas]` — el argumento es opcional; si no llega, pregunta qué te gustó y qué no de la última ronda.

Aplica `ui-ux-pro-max §references/es/rondas.md` paso a paso:

1. Si no hay ninguna ronda todavía, empieza por `/propuestas` (blueprint y ronda 1 A/B con la plantilla
   de piezas etiquetadas).
2. **Recoge la opinión** de la ronda anterior: lo que el usuario escribió tras el comando, lo que pegó del
   panel «Tu opinión» o, si no hay nada, pregúntalo en llano. Tradúcelo a piezas (`B·T1`, `A·B2`…) y
   confírmalo en una línea antes de registrar.
3. **Registra en `gustos.md`**: lo aprobado a «Fijado» (con su valor exacto entre acentos graves), lo
   rechazado a «No» (con sus términos bloqueados) y lo dudoso a «Dudas / abierto».
4. **Genera la ronda siguiente** en `propuestas/ronda-N/` (2 o 3 maquetas desde la plantilla): lo fijado
   idéntico en todas, nada de lo vetado, solo se explora lo abierto y cada maqueta trae algo nuevo.
5. **Verifica** con `ronda-check.mjs design-system/<slug> --indice` hasta «Ronda lista para enseñar».
6. Enseña las rutas (o `propuestas/index.html`) con una línea por maqueta: qué está fijado, qué prueba y
   qué es nuevo. Pide la opinión con el panel o en el chat.
7. Si ya no queda nada abierto o el usuario elige una: pasa la elegida y lo fijado a `MASTER.md` y
   propón construir la página real (checkpoint por sección).
