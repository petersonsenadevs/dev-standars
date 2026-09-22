# Deploy por stack: dónde y cómo publica cada uno

## Índice
- [Astro](#astro)
- [Next.js](#nextjs)
- [Vue SPA](#vue-spa)
- [Laravel](#laravel)
- [Python (FastAPI / LangGraph)](#python-fastapi--langgraph)
- [Común: DNS y SSL](#común-dns-y-ssl)
- [Común: previews por rama](#común-previews-por-rama)

## Astro
- **Estático (sin SSR)** — el caso feliz: Netlify / Cloudflare Pages / Vercel conectados al repo.
  Build `npm run build`, publish `dist/`. Redirects y headers en `netlify.toml` / `_redirects` /
  `_headers` (Cloudflare). Nada de servidores.
- **SSR** (`output: 'server'`): adapter de la plataforma (`@astrojs/netlify`, `@astrojs/vercel`,
  `@astrojs/cloudflare`) → corre en funciones; o `@astrojs/node` + pm2/Docker en VPS si necesitas
  procesos largos/WebSockets (las funciones serverless tienen timeout).
- Variables de entorno en la UI de la plataforma; las `PUBLIC_*` se incrustan en build (¡no pongas
  secretos con prefijo PUBLIC!). Cambiaste una env → redeploy (el build la fija).

## Next.js
- **Vercel** es el camino feliz (ISR, imágenes, edge, previews: todo funciona solo). Root directory y
  framework preset detectados; env vars por entorno en la UI.
- **Self-host** cuando hay motivo (coste, datos en tu VPS): `output: 'standalone'` en next.config →
  `node .next/standalone/server.js` con pm2/systemd o Docker (ver `docker.md`). OJO fuera de Vercel:
  `next/image` necesita sharp instalado; ISR funciona en un solo nodo (con varios, hace falta caché
  compartida); los cron de vercel.json no existen (usa cron real).
- Nginx delante como reverse proxy + SSL; assets `.next/static` cacheados `immutable`.

## Vue SPA
- Estático: build a `dist/` y CUALQUIER hosting estático + **rewrite SPA**: todas las rutas → `index.html`
  (Netlify: `/* /index.html 200`; nginx: `try_files $uri /index.html;`). Sin esto, F5 en /ruta = 404.
- La API vive aparte (Laravel u otro backend): configura CORS allí y `VITE_API_URL` por entorno.

## Laravel
- **Recomendado agencia: VPS (Hetzner/DO) gestionado con Forge o Ploi**: aprovisionan nginx+PHP-FPM+
  MySQL/Redis, SSL automático, deploy por git con script, daemons para colas, scheduler — sin ser sysadmin.
- **Script de deploy** (el orden importa):
  ```bash
  cd /home/forge/misitio.com
  git pull origin main
  composer install --no-dev --optimize-autoloader
  npm ci && npm run build            # si hay front compilado
  php artisan migrate --force
  php artisan storage:link
  php artisan config:cache && php artisan route:cache && php artisan view:cache
  php artisan queue:restart          # los workers cargan el código NUEVO
  ```
- **Zero-downtime** (cuando pese): releases en carpetas + symlink `current` (Deployer o el "zero downtime"
  de Ploi/Envoyer). Para la mayoría de webs de cliente, el script simple con 1-2 s de recarga basta.
- Docker como alternativa si el equipo ya lo usa (ver `docker.md` — FrankenPHP simplifica mucho).
- **Shared hosting sin SSH: no** — sin colas, sin scheduler fiable, sin deploy por git, sin control.
  Si el cliente lo impone, que sea decisión suya documentada con sus límites por escrito.

## Python (FastAPI / LangGraph)
- **Docker + uvicorn** es la base: imagen slim, `uvicorn app:app --host 0.0.0.0 --port 8000`, workers
  según CPU (`--workers`), detrás de nginx/Caddy. En VPS sin Docker: venv + systemd unit.
- Atajos gestionados: Fly.io / Railway (deploy del Dockerfile, secretos en su UI, escala a cero) — bien
  para agents/APIs pequeñas; VPS propio cuando el coste o la persistencia mandan.
- Procesos largos de agentes: NUNCA dentro del request HTTP — cola/worker (ver production-runtime).

## Común: DNS y SSL
- Registros: `A/AAAA` a IP del VPS; `CNAME` al target de la plataforma (Netlify/Vercel te lo dan).
  **Una canónica**: www→raíz (o al revés) con 301 desde la plataforma o nginx — decidido, no las dos.
- TTL: bájalo a 300 ANTES de una migración de DNS; súbelo después. La "propagación" es el TTL viejo
  expirando — no es magia, es espera.
- SSL: Let's Encrypt automático en todas las plataformas y en Forge; wildcard (`*.dominio`) solo si hay
  subdominios dinámicos (exige challenge DNS). **Nunca** aceptar "ya pondremos el SSL luego": HTTPS
  desde el minuto uno, HTTP→HTTPS con 301.
- Emails del dominio: el deploy no debe romper MX/SPF/DKIM existentes — inventaría los registros ANTES
  de cambiar nameservers.

## Común: previews por rama
Netlify/Vercel/Cloudflare crean deploy de preview por PR (URL propia): úsalo como "staging gratis" para
enseñar al cliente ANTES de prod. En VPS, un vhost `staging.dominio` apuntando a la rama develop cumple
el mismo papel. Regla: lo que el cliente aprueba es una URL de preview, no un pantallazo.
