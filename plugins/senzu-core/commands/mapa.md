---
description: Mapa del proyecto — qué es, cómo arrancarlo, estructura, flujos críticos y dónde tocar para cada cosa
---

Uso: `/mapa [área opcional, p. ej. "pagos"]` — el argumento es opcional; si no llega, mapea el proyecto entero.

Aplica `code-quality §references/mapa-proyecto.md` (solo lectura, no cambia código):

1. Lee manifiestos, configuración y `.env.example` (nunca `.env`), la estructura de carpetas y los
   puntos de entrada (rutas, comandos, colas, tareas programadas, webhooks).
2. Sigue 3-5 flujos críticos de principio a fin anotando archivo y función en cada paso.
3. Ejecuta `node <skills-dir>/backend-audit/scripts/hotspots.mjs` para las zonas de riesgo.
4. Escribe `docs/MAPA.md` con la estructura de la referencia: lo esencial en la primera pantalla y la
   tabla "dónde tocar para…" con las tareas frecuentes.
5. Propón enlazarlo desde `CLAUDE.md` o `CLAUDE.project.md` para que el agente lo lea al empezar.
