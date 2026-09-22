---
description: Deploy con red — checklist PRE/DEPLOY/POST/ROLLBACK con evidencia y aprobación explícita
argument-hint: [entorno u objetivo, p. ej. "producción" o "staging"]
---

Aplica `deploy-ops §references/deploy-checklist.md` para $ARGUMENTS, con evidencia por punto:

1. **PRE**: suites en verde (verify-build), `/lanzar` APTA si aplica, **backup fresco verificado**,
   plan de rollback escrito en una línea, migraciones revisadas (¿expansivas?), y — para producción —
   **pide la aprobación explícita del usuario AHORA** (sin ella, el guard bloquea y no se despliega).
2. **DEPLOY**: por el camino reproducible del stack (`references/deploy-by-stack.md`): pipeline/hook/
   script, nunca comandos improvisados. `DEV_STANDARDS_ALLOW_DEPLOY=1` solo tras la aprobación.
3. **POST** (10 min): smoke (home + /health + 1 flujo crítico), logs limpios, Sentry sin errores nuevos,
   devlog con SHA/hora/resultado.
4. Si el POST falla → **ROLLBACK primero** (el plan de PRE), verificar, investigar en local después.

Primer deploy de un proyecto: antes revisa `references/envs-secrets.md` (secretos en la plataforma,
APP_DEBUG=false) y `references/backups-monitoring.md` (backups + uptime + Sentry montados).
