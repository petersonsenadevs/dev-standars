---
description: Crea o retoma el plan del proyecto (plan/PLAN.md) con la skill project-planner
---

Uso: `/plan [descripción del proyecto o feature]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica la skill `project-planner`:

1. Si existe `plan/PLAN.md`, léelo (cabecera + fase activa) y resume: progreso, tarea `doing` y siguientes; propón continuar.
2. Si no existe (o lo que el usuario escribió tras el comando describe algo nuevo): descubrimiento breve del proyecto, brief con alcance IN/OUT en
   `plan/brief.md`, y plan completo en `plan/PLAN.md` (fases entregables; tarjetas `### F1-T1 · título  [S] [todo]` con
   skill+sección, "hecho cuando" y "verificar"). Presenta el plan y espera mi OK antes de ejecutar.

Petición: lo que el usuario escribió tras el comando
