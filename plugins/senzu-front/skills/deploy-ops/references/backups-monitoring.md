# Backups y monitorización: dormir tranquilo con webs de clientes

## Índice
- [Backups: la regla de oro](#backups-la-regla-de-oro)
- [Qué se respalda y con qué](#qué-se-respalda-y-con-qué)
- [El simulacro de restore](#el-simulacro-de-restore)
- [Endpoint /health](#endpoint-health)
- [Uptime y alertas](#uptime-y-alertas)
- [Errores: Sentry](#errores-sentry)
- [Plan de incidente mínimo](#plan-de-incidente-mínimo)
- [Checklist](#checklist)

## Backups: la regla de oro
**Un backup sin restore PROBADO no existe.** No es una frase: es la diferencia entre "tenemos backups"
y descubrir en el peor día que el dump estaba vacío, cifrado con una clave perdida o del entorno
equivocado. Todo lo demás de esta referencia orbita alrededor de esa regla.

- Automatizados (cron/plataforma), NUNCA manuales "cuando me acuerdo".
- **Fuera del servidor que respaldan** (S3/R2/B2 u otro proveedor): el backup en el mismo disco muere
  con el disco.
- Retención simple que funciona: **7 diarios + 4 semanales + 12 mensuales**.
- Cifrados si llevan datos personales (RGPD también aplica a los backups).

## Qué se respalda y con qué
| Qué | Herramienta |
|---|---|
| BD (MySQL/Postgres) | `spatie/laravel-backup` (BD+archivos+notificaciones, la vía Laravel) · `mysqldump`/`pg_dump` + cron + subida a S3 · backups gestionados del proveedor (DO/Hetzner managed DB) |
| Uploads/storage | Incluidos en spatie-backup, o `rclone sync` a R2/B2; si ya usas S3 como storage, versioning del bucket |
| El VPS entero | Snapshots del proveedor (semanal) — complemento, no sustituto del backup de BD |
| El código | Git ES el backup del código (por eso todo se commitea); lo irrecuperable es la BD y los uploads |
| Config de infra | El panel (Forge) exporta poco: documenta en el devlog lo no reproducible (crons, daemons, vhosts custom) |

Estáticos en Netlify/Pages sin BD: el repo es el backup completo — no inventes trabajo.

## El simulacro de restore
Trimestral (o al montar el sistema y tras cambios grandes):
1. Coge el backup de AYER (no uno a propósito).
2. Restáuralo en local o staging (`mysql < dump.sql`, descomprimir uploads).
3. Arranca la app contra lo restaurado y toca 2-3 flujos.
4. Apunta en el devlog: fecha, backup usado, tiempo que costó, sorpresas.
El tiempo del paso 3 es tu RTO real. Si el simulacro nunca se ha hecho, el sistema de backups está
**pendiente de verificar**, digan lo que digan los cron.

## Endpoint /health
Una ruta `/health` (o `/up` en Laravel 11+) que comprueba de verdad y devuelve 200/503:
- BD: un `SELECT 1`.
- Cola: profundidad razonable / worker vivo (timestamp del último job procesado < X min).
- Disco: espacio libre > umbral.
- (Opcional) redis, servicios externos críticos.
Sin secretos ni detalles internos en la respuesta pública (un JSON `{"ok":true}` basta; el detalle,
logueado). Este endpoint es lo que vigila el uptime y lo que consulta el smoke post-deploy.

## Uptime y alertas
- **UptimeRobot / BetterStack** (tier gratis sobra para una agencia): check HTTP a `/health` de cada web
  de cliente cada 1-5 min + check de que el SSL no caduca.
- Heartbeats para lo programado (healthchecks.io): el cron de backups hace ping al terminar; si no llega
  el ping, alerta — así cazas el backup que murió en silencio.
- Las alertas van a un canal que SE MIRA (email + Telegram/Slack de la agencia). Una alerta que nadie ve
  es ruido; ajusta umbrales hasta que cada alerta signifique "actúa".

## Errores: Sentry
- SDK por stack: `sentry-laravel`, `@sentry/astro`, `@sentry/nextjs`, `@sentry/vue`, `sentry-sdk` (Python).
  DSN por entorno (env var); entorno etiquetado (staging/prod); release = SHA del deploy (así sabes qué
  deploy introdujo el error).
- Alertas: primer evento de un error NUEVO → aviso; umbral de frecuencia para los conocidos.
- Sin PII en los eventos (scrubbing activado); los errores 500 de prod se miran en Sentry, no grepeando
  logs a mano.

## Plan de incidente mínimo
1. **Detectar**: alerta de uptime/Sentry (no el cliente llamando — si te entera el cliente, la
   monitorización falló y eso también se apunta).
2. **Estabilizar**: ¿fue el último deploy? → **rollback primero, investigar después** (tag/release
   anterior; por eso existe). ¿Servidor? → restart del servicio; ¿disco lleno? → logs/backups viejos.
3. **Comunicar**: si el cliente lo notó, mensaje corto y honesto (qué pasó, ya restaurado, qué haremos).
4. **Post-mortem al devlog** (10 líneas): qué pasó, por qué, qué cambia para que no se repita. Sin culpas,
   con una tarjeta si hay trabajo derivado.

## Checklist
- [ ] Backups automáticos de BD+uploads, fuera del servidor, retención 7/4/12, cifrados si hay PII.
- [ ] **Restore probado con fecha en el devlog** (el punto que convierte todo lo demás en real).
- [ ] /health con checks reales; uptime + SSL vigilados; heartbeat en el cron de backups.
- [ ] Sentry en prod con release por deploy y alertas a un canal vivo.
- [ ] Rollback conocido y probado una vez; plan de incidente escrito (aunque sea este).
