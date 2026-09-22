# Prohibiciones específicas — Node API

Además de las globales (`core/methodology/prohibited-actions.md`):

- `prisma migrate reset`, `db push --force-reset`, `sequelize.sync({ force: true })`, `synchronize: true`
  (TypeORM) en producción — destruyen datos. Aprobación explícita.
- Editar migraciones ya versionadas/aplicadas — migración nueva.
- Desactivar la validación global (`ValidationPipe`, schemas del borde) o el middleware de errores.
- `console.log` en código de la API (bloqueado por hook): usa el logger (pino) del proyecto.
- Exponer stack traces o mensajes internos en respuestas HTTP.
- CORS `*` con credenciales, endpoints sensibles sin auth, secrets hardcodeados.
