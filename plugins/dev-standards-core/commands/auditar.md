---
description: Auditoría del backend y la arquitectura con pruebas — herramientas reales, evidencia por hallazgo, informe y plan
argument-hint: [área opcional, p. ej. "pagos", "API pública" o "antes de producción"]
---

Aplica `backend-audit §references/protocolo.md` completo para $ARGUMENTS (o todo el backend):

1. **Alcance**: acuerda con el usuario en una pregunta el área y el objetivo (antes de refactorizar,
   heredar el proyecto, un incidente o salir a producción). Si no lo sabe, propón empezar por los hotspots.
2. **Medición**: ejecuta `node <skills-dir>/backend-audit/scripts/hotspots.mjs` y las herramientas del
   stack (`references/herramientas-por-stack.md`) que el proyecto ya tenga. Las que falten, propónlas;
   no instales nada sin preguntar.
3. **Lectura dirigida** de lo que las herramientas señalan, recorriendo `references/catalogo-hallazgos.md`.
4. **Verifica cada hallazgo** antes de reportarlo: sin evidencia (salida, archivo:línea, test que falla
   o medición) va a sospechas, no a hallazgos. Esta tarea NO modifica código de la aplicación.
5. **Informe** con `references/informe.md` en `docs/auditoria/<fecha>-<area>.md`. Enseña el resumen y
   los 3-5 hallazgos principales y pregunta qué se arregla.
6. Lo aprobado → tarjetas en `plan/PLAN.md` con la receta que lo arregla; los cambios de estructura
   se hacen después con `/refactor`. Devlog con las herramientas ejecutadas y el resultado.
