---
description: Audita la UI (rúbrica + verificación en navegador si hay Chrome disponible)
---

Uso: `/revisar-ui [url o ruta de la vista, p. ej. http://localhost:5173 o Pages/Home.vue]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

1. Si está disponible la skill `ui-verify` y hay navegador (Chrome MCP), síguela con el objetivo que el usuario escribió tras el comando:
   capturas en 375/768/1440, dark mode, consola y accesibilidad; adjunta resultados.
2. Audita con `ui-ux-pro-max/references/es/review-rubric.md`: puntúa las 10 dimensiones (1-5) con evidencia
   (archivo:línea o captura) y propón las 3-5 acciones de mayor impacto ordenadas por impacto/esfuerzo.
3. No apliques cambios todavía: entrega el informe y espera mi decisión.
