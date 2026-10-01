---
description: Ejecuta la siguiente tarea del plan (task-protocol de project-planner)
---

Uso: `/siguiente [id de tarea opcional, p. ej. F1-T3]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `project-planner` § task-protocol sobre `senzu/plan/PLAN.md`:

1. Tarea objetivo: la que el usuario escribió tras el comando, si la indicó; si no, la `doing` actual o la primera `todo` sin dependencias pendientes.
2. Márcala `doing`, lee SOLO la skill y sección que indica su tarjeta, implementa completo.
3. Verifica exactamente como dice la tarjeta y pega la salida; devlog + commit con `Tarea: <id>` en el cuerpo.
4. Márcala `done` con el enlace al devlog y propón la siguiente. Si no hay plan, dilo y ofrece `/plan`.
