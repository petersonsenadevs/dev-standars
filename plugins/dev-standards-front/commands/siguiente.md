---
description: Ejecuta la siguiente tarea del plan (task-protocol de project-planner)
argument-hint: [id de tarea opcional, p. ej. F1-T3]
---

Aplica `project-planner` § task-protocol sobre `plan/PLAN.md`:

1. Tarea objetivo: `$ARGUMENTS` si se indica; si no, la `doing` actual o la primera `todo` sin dependencias pendientes.
2. Márcala `doing`, lee SOLO la skill y sección que indica su tarjeta, implementa completo.
3. Verifica exactamente como dice la tarjeta y pega la salida; devlog + commit con `Tarea: <id>` en el cuerpo.
4. Márcala `done` con el enlace al devlog y propón la siguiente. Si no hay plan, dilo y ofrece `/plan`.
