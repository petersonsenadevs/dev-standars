---
name: deploy-ops
description: "Despliegue y operaciones para TODOS los stacks: deploy por plataforma (Netlify/Vercel/Forge/VPS), Docker, CI/CD con GitHub Actions, secretos por entorno, colas y cron en prod, backups con restore probado y monitorización. Deploy NUNCA sin aprobación."
---

# deploy-ops (Senzu)

Poner y MANTENER en producción, para cualquier stack. Construir y verificar es de las otras skills
(`/verificar`, `/lanzar`); esta empieza donde acaba el "APTA": publicar, operar y que no se caiga —
y si se cae, volver atrás en minutos.

## Lectura mínima por tarea
| Tarea | Lee solo |
|---|---|
| Desplegar un proyecto (dónde y cómo, por stack) | `references/deploy-by-stack.md` |
| Dockerizar (Dockerfile, compose de dev, imagen de prod) | `references/docker.md` |
| CI/CD: pipeline en GitHub Actions, previews, deploy con aprobación | `references/ci-cd.md` |
| Entregar el proyecto al cliente: manual, accesos, mantenimiento (/entregar) | `references/entrega-cliente.md` |
| Entornos y secretos (.env, staging, rotación, fugas) | `references/envs-secrets.md` |
| Colas, cron, workers, storage y logs EN producción | `references/production-runtime.md` |
| Backups (con restore probado), uptime, Sentry, /health, incidentes | `references/backups-monitoring.md` |
| Ejecutar un deploy concreto (checklist con evidencia) | `references/deploy-checklist.md` (comando `/desplegar`) |
| Verificar la WEB antes de publicar (SEO, legales, medición) | `ui-verify §references/launch-checklist.md` (/lanzar) |
| Diseño de colas/jobs (el QUÉ; aquí solo el correr en prod) | `code-quality §references/jobs-and-queues.md` |

## Principios duros (aplican siempre)
1. **Deploy a producción NUNCA sin aprobación explícita del usuario** en ese momento (el guard bloquea
   `--prod` directo; el escape `SENZU_ALLOW_DEPLOY=1` solo tras aprobación, documentada en devlog).
2. **Antes de tocar prod**: backup fresco VERIFICADO + plan de rollback escrito. Sin eso, no hay deploy.
3. **Secretos jamás en el repo ni en logs**: viven en la plataforma (Netlify/Vercel/Forge/GH Environments);
   `.env.example` al día; secreto commiteado = rotarlo YA (protocolo en envs-secrets §fuga).
4. **Reproducible o no cuenta**: el deploy es un script/pipeline, no una lista de pasos en la cabeza de
   alguien. Si solo funciona "cuando lo hace X a mano", está roto.
5. **Después del deploy se VIGILA**: smoke (home + /health + 1 flujo crítico) y logs durante ~10 min.
   Desplegar y cerrar el portátil no es terminar.
6. Staging si el proyecto lo tiene; nunca "probar en prod" cambios de riesgo (migraciones destructivas,
   pagos, auth).
7. Cambios de infra se documentan en el devlog como cualquier código (qué, por qué, cómo se revierte).

## Recomendaciones por defecto (agencia, sin sobre-ingeniería)
- Web estática/Astro/SPA → **Netlify o Cloudflare Pages** (deploy por git, previews gratis, cero servidor).
- Next.js → **Vercel** salvo motivo (coste/datos) para self-host.
- Laravel → **VPS + Forge/Ploi** (o Docker si el equipo ya lo domina). Shared hosting sin SSH: no.
- Python/agents → **Docker** en VPS o Fly.io/Railway.
- CI: **GitHub Actions** espejo de `verify-build` en cada PR; prod solo desde main con aprobación.

## Relación con otras skills
`/lanzar` verifica la web → `deploy-ops` la publica y mantiene · colas: diseño en code-quality, prod aquí ·
seguridad de la app en `security-owasp`; aquí la del despliegue (secretos, superficies, accesos).
