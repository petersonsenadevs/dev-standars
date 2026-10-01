# Runtime de producción: colas, cron, procesos, storage y logs

## Índice
- [Colas en producción](#colas-en-producción)
- [Cron / tareas programadas](#cron--tareas-programadas)
- [Process managers](#process-managers)
- [Storage en producción](#storage-en-producción)
- [Logs](#logs)
- [Migraciones en el deploy](#migraciones-en-el-deploy)
- [Zero-downtime](#zero-downtime)

El DISEÑO de colas/jobs (idempotencia, reintentos, payloads) está en
`code-quality §references/jobs-and-queues.md`; esto es hacerlas correr de verdad en prod.

## Colas en producción
- **Laravel en VPS**: workers como daemon supervisado — Forge/Ploi lo llaman "Daemon"
  (`php artisan queue:work --tries=3 --max-time=3600`), o supervisor/systemd a mano; **Horizon** si
  Redis (dashboard + balanceo + métricas: instálalo en cuanto haya más de una cola).
  Regla vital: **`queue:restart` en cada deploy** — los workers son procesos largos con el código VIEJO
  en memoria hasta que los reinicias (el bug fantasma clásico: "he desplegado y sigue igual").
- **Docker**: contenedor(es) worker con la MISMA imagen y `command: php artisan queue:work` (o celery/
  BullMQ worker); escala añadiendo réplicas del worker, no hilos mágicos.
- **Serverless (Netlify/Vercel)**: no hay workers residentes — colas externas (SQS/QStash/Inngest) o
  background functions; ya decidido en jobs-and-queues, aquí solo recuerda: nada de `setTimeout` largo
  en una función.
- Dimensiona: 1-2 workers por defecto; monitoriza profundidad de cola (Horizon o un check en /health);
  cola creciendo sin parar = workers caídos o job envenenado.

## Cron / tareas programadas
- **UNA sola entrada de cron real** que delega en el scheduler del framework:
  `* * * * * php /ruta/artisan schedule:run >> /dev/null 2>&1` (Forge lo crea con un clic).
  Node: node-cron dentro de un proceso pm2 dedicado, o cron del sistema llamando a un script.
- Serverless: scheduled functions de la plataforma (Netlify scheduled, Vercel cron) — con el mismo
  principio de jobs-and-queues: el cron decide y ENCOLA, no ejecuta trabajo pesado.
- Toda tarea programada: lock anti-solape, log de ejecución, y una alerta si NO corre (heartbeat a
  healthchecks.io o similar: el cron que muere en silencio es el backup que no existía).

## Process managers
- **systemd** (nativo, VPS): unit con `Restart=always`, `EnvironmentFile=`, logs a journal. Para
  uvicorn, node standalone, workers.
- **pm2** (Node): `pm2 start --name app server.js`, `pm2 startup` + `pm2 save` (o no sobrevive al reboot).
- Docker: `restart: unless-stopped` + HEALTHCHECK; el orquestador ES el process manager.
- Sea cual sea: el proceso debe SOBREVIVIR a un reboot del servidor sin manos. Pruébalo una vez
  (reboot de staging) y apúntalo.

## Storage en producción
- Disco local del VPS: válido para empezar (uploads en `storage/`/carpeta servida) — PERO entra en el
  backup y NO sobrevive a contenedores desechables ni a múltiples nodos.
- **S3/R2** (R2 sin coste de egress) cuando: Docker/serverless, más de un servidor, o los uploads pesan.
  Laravel: driver s3 y cambiar el disk — si seguiste las reglas de code-quality, es config, no refactor.
- Nunca servir uploads con permisos de escritura del servidor web sobre todo el proyecto; los archivos
  subidos no se ejecutan (ya en security-owasp).

## Logs
- **Docker/serverless**: stdout/stderr y que la plataforma los recoja — punto.
- **VPS**: archivos CON logrotate (Forge lo trae; a mano: logrotate.d) — el disco lleno por logs es la
  caída más tonta y común de un VPS. Laravel: canal `daily` con `LOG_DAILY_DAYS=14`.
- Nivel en prod: `info`/`warning` (debug llena discos); errores con contexto → Sentry (backups-monitoring).
- Qué mirar tras un deploy: los últimos 50 del error log, no "todo bien porque la home carga".

## Migraciones en el deploy
- Orden del script: código nuevo en disco → `migrate --force` → caches → `queue:restart`.
- Migraciones EXPANSIVAS por defecto (añadir columna nullable, crear tabla) — compatibles con el código
  viejo que aún corre durante el deploy. Las destructivas (drop/rename) en un deploy POSTERIOR, cuando
  ya nada usa lo viejo (expand → migrate → contract).
- Migración que falla a medias = incidente: por eso el backup fresco pre-deploy no es opcional.

## Zero-downtime
- Plataformas (Netlify/Vercel/Fly): lo hacen solas (atomic deploys) — gratis, no lo pienses.
- VPS Laravel: releases + symlink `current` (Deployer/Envoyer/Ploy zero-downtime) cuando el sitio no
  puede parpadear; para la web media de cliente, los ~2 s del script simple no los nota nadie.
- Docker: levanta el contenedor nuevo, espera HEALTHCHECK ok, cambia el proxy, apaga el viejo
  (compose con `--wait` o el rolling del orquestador).
