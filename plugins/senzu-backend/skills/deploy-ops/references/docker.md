# Docker: contenedores bien hechos (cuándo y cómo)

## Índice
- [Cuándo sí y cuándo no](#cuándo-sí-y-cuándo-no)
- [Reglas de oro de toda imagen](#reglas-de-oro-de-toda-imagen)
- [Dockerfile por stack (multi-stage)](#dockerfile-por-stack-multi-stage)
- [docker-compose de DESARROLLO](#docker-compose-de-desarrollo)
- [Publicar y desplegar la imagen](#publicar-y-desplegar-la-imagen)
- [Checklist](#checklist)

## Cuándo sí y cuándo no
- **SÍ**: paridad dev/prod ("en mi máquina funciona" se acaba), VPS propio con varias apps, Python/agents,
  Laravel si el equipo ya domina Docker, y siempre que el destino sea Fly/Railway/Cloud Run.
- **NO**: webs estáticas (Netlify/Pages hace todo mejor y gratis), Next en Vercel, o si nadie del equipo
  va a mantener las imágenes — Docker mal mantenido es peor que Forge bien usado.

## Reglas de oro de toda imagen
1. **Multi-stage**: la imagen final NO lleva node_modules de build, compiladores ni devDependencies.
2. **Usuario no-root** (`USER node` / crear uno); puertos > 1024.
3. **Logs a stdout/stderr** — nada de escribir a archivos dentro del contenedor.
4. **HEALTHCHECK** definido (curl a /health) — el orquestador necesita saber si estás vivo.
5. `.dockerignore` SIEMPRE (node_modules, .git, .env, dist, vendor, storage/logs) — o el contexto pesa
   gigas y el .env acaba dentro de la imagen (fuga clásica).
6. Estado FUERA: BD/redis en sus contenedores o gestionados; volúmenes solo para persistencia real
   (uploads, BD); el contenedor de la app es desechable.
7. Versiones fijadas (`node:22-alpine`, no `latest`); imagen pequeña = deploy rápido y menos superficie.

## Dockerfile por stack (multi-stage)

**Estático (Astro/Vue build) → nginx**
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf   # con try_files para SPA si aplica
HEALTHCHECK CMD wget -qO- http://localhost/ >/dev/null || exit 1
```

**Next.js (standalone)**
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build      # requiere output: 'standalone' en next.config

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
```

**Laravel — FrankenPHP (la vía simple: un solo proceso PHP+servidor)**
```dockerfile
FROM composer:2 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

FROM dunglas/frankenphp:php8.3
RUN install-php-extensions pdo_mysql redis opcache intl
WORKDIR /app
COPY . .
COPY --from=vendor /app/vendor ./vendor
ENV SERVER_NAME=:80
HEALTHCHECK CMD curl -f http://localhost/up || exit 1   # ruta /up de Laravel 11+
```
(Alternativa clásica: php-fpm + contenedor nginx aparte; más piezas, mismo resultado. Colas y scheduler:
contenedores separados con la MISMA imagen y distinto command — ver production-runtime.)

**Python (FastAPI/LangGraph)**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m appuser
USER appuser
EXPOSE 8000
HEALTHCHECK CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## docker-compose de DESARROLLO
El compose es sobre todo para DEV: levanta las dependencias iguales para todo el equipo.
```yaml
services:
  db:
    image: mysql:8.4            # o postgres:17
    environment: { MYSQL_ROOT_PASSWORD: root, MYSQL_DATABASE: app }
    ports: ["3306:3306"]
    volumes: [dbdata:/var/lib/mysql]
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  mailpit:                       # trampa de correo: NADA de emails reales desde dev
    image: axllent/mailpit
    ports: ["8025:8025", "1025:1025"]
volumes: { dbdata: }
```
La app puede correr en el host (npm/artisan serve) contra estos servicios — no hace falta dockerizar
la app en dev si estorba al DX.

## Publicar y desplegar la imagen
- Build en CI (no en el servidor), push a **GHCR** (`ghcr.io/<owner>/<app>:<sha>` + `:latest`);
  el servidor hace `docker pull` + recreate (compose de prod o el runtime de Fly/Railway).
- Tag por SHA de commit = rollback trivial (`docker compose up -d` con el tag anterior).
- Secretos por variables de entorno del runtime, NUNCA en la imagen (ver envs-secrets).

## Checklist
- [ ] Multi-stage, no-root, HEALTHCHECK, logs a stdout, versiones fijadas.
- [ ] `.dockerignore` presente (y `.env` fuera de la imagen — verifícalo con `docker history`/inspección).
- [ ] Estado en volúmenes/servicios, contenedor de app desechable.
- [ ] Imagen en GHCR taggeada por SHA; rollback = tag anterior probado una vez.
