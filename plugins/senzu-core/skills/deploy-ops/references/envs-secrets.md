# Entornos y secretos: local, staging, prod sin fugas

## Índice
- [Los tres entornos](#los-tres-entornos)
- [El .env bien llevado](#el-env-bien-llevado)
- [Dónde viven los secretos por plataforma](#dónde-viven-los-secretos-por-plataforma)
- [Config por entorno según stack](#config-por-entorno-según-stack)
- [Rotación](#rotación)
- [Protocolo de fuga (secreto commiteado)](#protocolo-de-fuga-secreto-commiteado)
- [Checklist](#checklist)

## Los tres entornos
| | local | staging/preview | producción |
|---|---|---|---|
| Datos | de juguete/seed | copia ANONIMIZADA o seed realista — nunca datos reales de clientes | reales |
| Emails | trampa (Mailpit) SIEMPRE | trampa o dominio de prueba | reales |
| Pagos | claves test del proveedor | claves test | claves live |
| Debug | on | on con acceso restringido | **OFF, sin excepciones** |
| Errores | pantalla | Sentry | Sentry + alertas |

Staging "gratis": las preview URLs de Netlify/Vercel por PR. En VPS: vhost `staging.` con su BD propia.
Regla: cambios de riesgo (migraciones destructivas, auth, pagos) pasan por staging ANTES de prod.

## El .env bien llevado
- `.env` en `.gitignore` desde el commit 1 (nuestro secrets-guard además bloquea editarlo por accidente).
- **`.env.example` SIEMPRE al día**: cada variable nueva se añade ahí CON comentario y valor dummy en el
  mismo commit que la introduce. Es el contrato de "qué necesita esta app para arrancar".
- La app **falla al arrancar** si falta una variable crítica (validación de env al boot: `astro:env`,
  zod en Node, `config()` + excepción en Laravel) — mejor un error claro que un fallo silencioso a las 3 AM.
- Nada de `.env.production` commiteado "porque es cómodo": eso es el secreto en el repo con otro nombre.

## Dónde viven los secretos por plataforma
| Plataforma | Dónde | Notas |
|---|---|---|
| Netlify / Vercel / Cloudflare | Environment variables de la UI, con scope por entorno (production/preview) | Las `PUBLIC_*`/`NEXT_PUBLIC_*` van al navegador: NUNCA secretos ahí |
| Forge/Ploi (Laravel VPS) | Editor de .env del panel (escribe el .env del servidor) | El .env del servidor NO está en git: el panel es su fuente |
| GitHub Actions | Secrets del repo y del environment `production` | Los de prod SOLO en el environment (ver ci-cd) |
| Docker | Env del runtime (compose `env_file` fuera del repo, secrets de Fly/Railway) | JAMÁS `ENV SECRET=` en el Dockerfile ni en la imagen |

## Config por entorno según stack
- **Laravel**: `APP_ENV=production`, `APP_DEBUG=false` (debug=true en prod expone secretos en cada error:
  es un incidente, no un descuido); tras cambiar .env → `php artisan config:cache` (y recuerda: con config
  cacheada, `env()` solo funciona dentro de archivos de config).
- **Node/Next/Astro**: `NODE_ENV=production` lo pone la plataforma; distingue variables de servidor vs
  las públicas incrustadas en build (cambio de pública = rebuild).
- **Python**: settings con pydantic-settings leyendo env; `DEBUG=false` explícito.

## Rotación
- Rota: al irse alguien del equipo/proveedor, tras cualquier sospecha, y las críticas ~1 vez al año.
- Rotar = crear clave nueva → desplegar con ambas válidas si el proveedor lo permite → revocar la vieja
  → verificar que nada quedó usando la vieja (logs del proveedor).
- Documenta en el devlog QUÉ se rotó y cuándo (no el valor, obviamente).

## Protocolo de fuga (secreto commiteado)
1. **ROTA la credencial YA** — este es el paso que importa. Borrarla del historial NO la des-expone:
   cualquier clon/fork/caché ya la tiene. La clave vieja está muerta desde que tocó git.
2. Después limpia el historial si quieres higiene (`git filter-repo`) y fuerza push SOLO con aprobación
   explícita del usuario (es reescritura de historia).
3. Revisa logs del proveedor por uso no reconocido durante la ventana de exposición.
4. Devlog: qué se filtró, cuánto tiempo, qué se rotó, qué se revisó. Sin drama y sin esconderlo.

## Checklist
- [ ] `.env` ignorado; `.env.example` completo y con dummies; validación de env al arrancar.
- [ ] Secretos en la plataforma correcta con scope por entorno; PUBLIC_* sin secretos.
- [ ] `APP_DEBUG=false`/equivalente en prod, verificado tras cada deploy.
- [ ] Claves de pagos/APIs en modo test fuera de prod.
- [ ] Sabes rotar cada credencial crítica (está apuntado dónde se cambia cada una).
