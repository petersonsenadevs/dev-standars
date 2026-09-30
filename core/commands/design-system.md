---
description: Genera (o revisa) el design system del proyecto con ui-ux-pro-max
---

Uso: `/design-system [producto/industria, p. ej. "saas facturación autónomos"]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `ui-ux-pro-max` §2:

1. Si existe `design-system/*/MASTER.md`, resúmelo (estilo, paleta, tipografía, patrón) y pregunta qué ajustar.
2. Si no existe: detecta el stack (§1), ejecuta el buscador con lo que el usuario escribió tras el comando (o dedúcelo del proyecto) y persiste:
   `py -3 <skills-dir>/ui-ux-pro-max/scripts/search.py "<producto e industria que indicó el usuario>" --design-system -p "<Proyecto>" --persist -o .`
   (fuera de Windows: `python3`). Ajusta primary/tipografías a la marca existente si la hay y presenta el resultado
   (patrón, estilo, paleta con tokens, tipografía, evitar) antes de maquetar nada.
