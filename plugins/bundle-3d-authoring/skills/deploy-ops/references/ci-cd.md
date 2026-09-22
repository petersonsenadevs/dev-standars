# CI/CD con GitHub Actions: el pipeline estándar

## Índice
- [Qué hace el pipeline (y por qué)](#qué-hace-el-pipeline-y-por-qué)
- [Workflow base (copia y adapta)](#workflow-base-copia-y-adapta)
- [Variantes por stack](#variantes-por-stack)
- [Deploy a producción con aprobación](#deploy-a-producción-con-aprobación)
- [Secrets en Actions](#secrets-en-actions)
- [Cuando CI está en rojo](#cuando-ci-está-en-rojo)

## Qué hace el pipeline (y por qué)
El CI es **verify-build en la nube**: lo que el agente ejecuta en local (lint → types → tests → build)
corre en cada PR para que nada roto llegue a main — incluida la gente/agentes que se salten lo local.
Encima: preview deploy por PR (el cliente aprueba URLs, no promesas) y deploy a prod SOLO desde main
con aprobación humana.

## Workflow base (copia y adapta)
`.github/workflows/ci.yml`:
```yaml
name: CI
on:
  pull_request:
  push: { branches: [main] }

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm run typecheck --if-present
      - run: npm test --if-present
      - run: npm run build
```
Claves: `cache: npm` (minutos gratis que se agradecen), `--if-present` (no falla si un proyecto no tiene
ese script — espejo del SKIP de verify-build), y el build SIEMPRE (el 80 % de los rotos de prod son
builds que nadie ejecutó).

## Variantes por stack
- **Astro/Vue estáticos en Netlify/Vercel**: la plataforma YA hace build+deploy por commit — este CI es
  la red extra de lint/types/tests (la plataforma no los corre). No dupliques el deploy.
- **Laravel** (job `verify` alternativo):
  ```yaml
  - uses: shivammathur/setup-php@v2
    with: { php-version: '8.3', extensions: 'pdo_mysql, redis' }
  - run: composer install --no-interaction --prefer-dist
  - run: ./vendor/bin/pint --test
  - run: ./vendor/bin/phpstan analyse
  - run: php artisan test
  services:   # BD efímera para los tests de integración
    mysql:
      image: mysql:8.4
      env: { MYSQL_ROOT_PASSWORD: root, MYSQL_DATABASE: testing }
      ports: ['3306:3306']
  ```
- **Python**: setup-python + `pip install -r requirements.txt` + `ruff check` + `pytest`.
- **Docker**: job extra que hace `docker build` (valida el Dockerfile) y en main pushea a GHCR
  (`docker/login-action` + `docker/build-push-action`, tags `sha` y `latest`).

## Deploy a producción con aprobación
NUNCA deploy automático a prod por el mero push a main. El patrón:
```yaml
  deploy-prod:
    needs: verify
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production          # <- AQUI está la magia
    steps:
      - run: curl -X POST "$FORGE_DEPLOY_HOOK"   # o netlify/vercel CLI, o ssh
        env: { FORGE_DEPLOY_HOOK: ${{ secrets.FORGE_DEPLOY_HOOK }} }
```
En GitHub → Settings → Environments → `production`: **required reviewers** (tú). El job se QUEDA
ESPERANDO tu aprobación en la UI — el equivalente en CI de nuestro muro de deploy. Ahí también viven
los secretos de prod (solo accesibles para ese environment).

## Secrets en Actions
- Repo/environment secrets, referenciados como `${{ secrets.X }}`; JAMÁS un valor en el YAML.
- Los de prod en el environment `production` (no a nivel repo): un PR malicioso no puede leerlos.
- GitHub enmascara secretos en logs, pero no imprimas payloads que los contengan.
- Tokens de deploy con el MÍNIMO permiso (deploy hook de Forge > clave SSH root).

## Cuando CI está en rojo
- Rojo = no se mergea. No existe "mergeo y ya lo arreglo" ni relanzar hasta que pase de chiripa
  (un test flaky se arregla o se marca y se abre tarjeta — no se ignora).
- El agente trata el rojo de CI como el verify-build local: leer el log, corregir, push, verde.
- Regla de higiene: si main lleva >1 día en rojo, TODO lo demás para hasta arreglarlo.
