# Checklist de deploy (/desplegar): con evidencia, no de memoria

Cada punto se marca con su evidencia (comando+salida, captura o URL). El deploy a producción exige
**aprobación explícita del usuario en el momento** — el guard bloquea los `--prod` directos hasta tenerla.

## PRE (no se despliega sin esto)
- [ ] Suites en verde AHORA: `verify-build.mjs` (lint/types/tests/build) con salida pegada.
- [ ] Si es web pública y es su primer deploy o un cambio grande: `/lanzar` en APTA.
- [ ] **Backup fresco y VERIFICADO** de BD+uploads (de hoy; comprobado que no está vacío). En estáticos
  sin BD: N/A explícito.
- [ ] **Plan de rollback escrito en una línea**: "si falla → X" (deploy anterior de Netlify / tag docker
  anterior / release symlink previo / restore del backup). Decidido AHORA, no durante el incendio.
- [ ] Migraciones revisadas: ¿expansivas? (las destructivas van en un deploy posterior — production-runtime).
- [ ] ¿Ventana? Si el deploy puede cortar servicio, avisado el cliente y elegida hora valle.
- [ ] **Aprobación explícita del usuario para ESTE deploy** (pedida y recibida en la conversación).

## DEPLOY
- [ ] Por el camino reproducible (pipeline con environment aprobado, deploy hook, script de Forge) —
  no comandos sueltos inventados sobre la marcha.
- [ ] Con `SENZU_ALLOW_DEPLOY=1` solo tras la aprobación de arriba, y documentándolo.
- [ ] Si es VPS/Laravel: el script completo (pull → deps → build → migrate → caches → **queue:restart**).

## POST (los 10 minutos que separan "desplegado" de "terminado")
- [ ] **Smoke inmediato**: home carga · `/health` en 200 · 1 flujo crítico real (formulario de contacto /
  login / añadir al carrito según el negocio).
- [ ] Logs de error de los últimos minutos: limpios (o solo ruido conocido).
- [ ] Sentry sin errores nuevos en los primeros ~10 min.
- [ ] Si hubo migraciones: un dato de la tabla afectada consultado y correcto.
- [ ] Analítica/medición sigue disparando (una conversión de prueba si el cambio la tocaba).
- [ ] **Devlog**: versión/SHA desplegado, hora, qué incluía, resultado del smoke.

## ROLLBACK (si algo del POST falla)
1. No debugues en prod caído: **ejecuta el plan de rollback de PRE** (para eso lo escribiste).
2. Verifica que el rollback restauró servicio (mismo smoke).
3. Reproduce el fallo en local/staging, arregla, y vuelve a empezar por PRE.
4. Post-mortem corto al devlog (backups-monitoring §incidente).

## Frecuencia y tamaño
Deploys pequeños y frecuentes > el "deploy del viernes" con 3 semanas de cambios: menos superficie de
fallo, rollback más obvio, smoke más corto. Si un deploy da miedo, es demasiado grande — trocéalo.
