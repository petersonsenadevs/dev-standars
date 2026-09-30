---
description: Estimación y presupuesto — horas por tarea, partidas olvidadas, riesgos y rango final para el cliente
---

Uso: `/estimar [qué estimar, p. ej. "la web del restaurante" o "fase 2"]` — el argumento es opcional; si no llega, estima el plan actual.

Aplica `project-planner §references/estimacion.md` sobre lo que el usuario escribió tras el comando
(o sobre `plan/PLAN.md`):

1. Si no hay plan ni troceo, trocea primero en fases y tareas S/M/L; sin troceo no se estima.
2. Pregunta ANTES lo que cambia el tamaño y no se sabe (pagos, idiomas, quién pone los textos). Lo que
   quede sin respuesta pasa a supuesto escrito.
3. Horas optimista, probable y pesimista por tarea; añade las partidas que siempre se olvidan (reuniones,
   QA, rondas de cambios, contenido, despliegue, entrega y gestión).
4. Riesgos concretos con su efecto en horas y factor de incertidumbre.
5. Rango final (mínimo, previsto y máximo). Si hay tarifa, importe por fase; no inventes la tarifa.
6. Escribe `plan/estimacion.md` con resumen para el cliente, detalle por fase, supuestos y exclusiones,
   y enséñale el resumen al usuario.
