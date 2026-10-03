<!-- GENERADO por tools/build-docs.ps1 desde el devlog interno del proyecto. -->

# Changelog

Resumen por fecha (lo nuevo arriba). El detalle de cada entrada vive en el diario interno del proyecto.

## 2026-10-03

- **feature** — La web se rompe como un cristal: los trozos son la propia página · v2.7.0 (entrada 084)

## 2026-10-02

- **docs** — Catálogo de efectos y demos publicados para la web (docs/efectos.md + efectos.json) · v2.6.1 (entrada 083)
- **feature** — Física e impacto: intro y loader con pantalla rota, objeto que cae, página que se desmorona · v2.6.0 (entrada 082)
- **feature** — Versión móvil pensada (plan por sección, pieza V) y verificada usando el menú y con captura anotada · v2.5.0 (entrada 081)
- **feature** — ui-verify mide la geometría en píxeles (centrado, loaders, spinners, SVG, casi-alineados) · v2.4.0 (entrada 080)
- **feature** — Logo ya elegido visible para Claude y Codex (hooks y muros) + guía de marca en senzu/ · v2.3.0 (entrada 079)
- **chore** — Ningún nombre de la agencia en lo público + comprobación con la lista privada · v2.2.4 (entrada 078)
- **docs** — Sin cifras escritas a mano en la documentación + comprobación en check-skills · v2.2.3 (entrada 077)
- **fix** — CI: test-verify-build ya no depende de tener pnpm instalado · v2.2.2 (entrada 076)
- **infra** — Devlog privado y preparación de la limpieza del historial · v2.2.1 (entrada 075)
- **fix** — Marketplace de 13 a 4 plugins (62 → 25 MB) y guía generada por la versión anterior reconocida · v2.2.0 (entrada 074)
- **fix** — CI: falso FAIL de check-skills por finales de línea CRLF en Windows · v2.1.1 (entrada 073)
- **feature** — Licencia MIT, CREDITOS.md generado, licencias en CI y actualización semanal de terceros por PR · v2.1.0 (entrada 072)
- **docs** — Brief, marca, briefs de logos y plan de la web (movidos al repo aparte D:/senzu-web) (entrada 071)
- **docs** — Docs: clonado con la carpeta senzu/ y plugins senzu-* · v2.0.1 (entrada 070)

## 2026-10-01

- **feature** — dev-standards pasa a llamarse Senzu y todo lo del proyecto va a senzu/ (migración automática) · v2.0.0 (entrada 069)
- **fix** — verify-build entiende monorepos (paquetes y lenguajes) y el aviso de memoria mira el contenido · v1.6.2 (entrada 068)
- **fix** — El buscador lee también docs/devlog y los ADR del proyecto (un monorepo: de 14 a 200 entradas) · v1.6.1 (entrada 067)
- **feature** — Rondas de maquetas con piezas votables, /ronda y verificador (fijado, vetado, algo nuevo) · v1.6.0 (entrada 066)
- **feature** — Permisos por proyecto (subir, subir a main, commit en main) y hooks apagados, solo por el usuario · v1.6.0 (entrada 065)
- **fix** — Muros reales en Codex (traducción de apply_patch, Stop en JSON) y formateo que no impone estilo · v1.5.0 (entrada 064)
- **feature** — Memoria del proyecto (devlog/MEMORIA.md) + buscador del devlog con raíces, erratas y sinónimos · v1.4.0 (entrada 063)
- **fix** — verify-build encuentra Pint en Windows (./vendor/bin) y el instalador fusiona .mcp.json en vez de vaciarlo · v1.3.2 (entrada 062)
- **fix** — Capturas, maquetas e informes en el proyecto (no en temp) + .ui-verify ignorado por git · v1.3.1 (entrada 061)

## 2026-09-30

- **feature** — Modo ahorro de tokens opcional (CLAUDE.md compacto) · v1.3.0 (entrada 060)
- **feature** — Recetas con Pretext: texto medido sin el DOM (rodear formas, reajuste, masonry, canvas) (entrada 059)
- **build** — Colección de efectos fuera de git (Codex no clonaba) + CI con las suites (entrada 058)
- **feature** — Aviso de assets pesados al cerrar + skill instalar-proyecto para Codex (entrada 057)
- **feature** — /depurar (y aviso automático al fallar un test), /estimar, /entregar, /mapa y muros de backend (entrada 056)
- **feature** — Instalador interactivo (todo / categorías / a medida) con selección persistente y poda + /instalar en Codex sin barras · v1.2.0 (entrada 055)
- **fix** — /instalar en Codex: sin $NOMBRE en el texto (Codex lo toma como argumento) + check 12 ampliado · v1.1.2 (entrada 054)
- **fix** — La versión del plugin sale de los tags (una sola numeración) + homepage en el manifest · v1.1.1 (entrada 053)
- **fix** — Comandos compatibles con Codex (sin $ARGUMENTS/argument-hint) + check 12 + skills globales completas · v1.1.0 (entrada 052)
- **feature** — Auditoría de backend con pruebas: skill backend-audit, /auditar, /refactor, reglas de arquitectura en /verificar (entrada 051)
- **docs** — Guía de prueba para dirección (docs/guia-de-prueba.md): instalar y probarlo todo en una tarde (entrada 050)
- **feature** — Efectos 44→79 (CSS moderno, formas/SVG, tipografía cinética, microinteracciones, WebGL), composiciones de página, +8 repos MIT (entrada 049)

## 2026-09-29

- **feature** — Instalador agnóstico init.mjs (Windows/WSL/Linux/macOS) + suite de paridad PS↔Node (entrada 048)
- **fix** — dev-standards-all recomendado; /instalar con camino WSL soportado; roadmap instalador Node (entrada 047)
- **fix** — Versión monótona de plugins (1.0.n): update detecta builds del mismo día (entrada 046)
- **feature** — /instalar: del plugin a la instalación completa del proyecto (clona, detecta stack, init/sync) (entrada 045)
- **docs** — README showcase + CHANGELOG generado + tag v1.0.0 (entrada 044)
- **docs** — Docu multi-doc: README hub + docs/{skills,comandos,hooks,stacks,arquitectura} generada (entrada 043)
- **feature** — Lista negra anti-IA (muro+crítica), rotación de referencias, checkpoint por sección, iconos sin default (entrada 042)
- **fix** — Codex/Antigravity respetan la guía propia (AGENTS.project.md via Resolve-GuideTarget) (entrada 041)
- **feature** — Tanda pro back+front: 7 refs (bd, realtime, files, llm, a11y, cwv, forms), skill email-html, muros .only/conflictos (entrada 040)
- **feature** — Nuevo vs existente: preguntar antes de adaptarse; /adoptar modo entrevista; CLAUDE.dev-standards.md (entrada 039)

## 2026-09-22

- **docs** — REFERENCIA.md generada: catálogo de skills, enrutamiento, comandos y muros (entrada 038)
- **fix** — Instalación en un monorepo + fixes: UTF8 en backup, import CLAUDE.project.md, versiones en monorepos (entrada 037)
- **feature** — Stacks nuevos: wordpress, node-api, nuxt, sveltekit + referencias Go/Java/C# (entrada 036)
- **feature** — Stacks conscientes de versión (EOL en session-start) + /adoptar con conventions-guard (entrada 035)
- **refactor** — Hooks agnósticos de OS: PowerShell → Node (.mjs) + reglas devops en el guard (entrada 034)
- **feature** — Skill deploy-ops multi-stack (deploy, Docker, CI/CD, backups) + muro de deploy (entrada 033)
- **feature** — Muros obligatorios (librerías, debug, vetos de gustos, UI sin brief) + test-hooks (entrada 032)

## 2026-09-19

- **feature** — Directorio marketing-seo: SEO, GA4/GTM y MCPs de analítica (entrada 031)

## 2026-09-18

- **docs** — ROADMAP.md + decisión mobile en el mismo repo (dev-023) (entrada 030)

## 2026-09-17

- **feature** — Acompañamiento y calidad de salida: /repaso, /lanzar, crítica visual, evals, copy, medición, i18n (entrada 029)
- **feature** — Modo propuesta: blueprint aprobable + maquetas A/B + memoria de gustos (entrada 028)
- **feature** — Colección completa: todos los codrops MIT (124 carpetas, 234 MB) + canteras nuevas (entrada 027)
- **feature** — Verificación obligatoria de builds/backend (edit-tracker + verify-build + stop-guard) (entrada 026)
- **feature** — Hooks piden brief antes de diseñar + image-gen en stacks (entrada 025)
- **fix** — Perfil de front efectivo: detección de package.json + override manual (entrada 024)
- **fix** — image-gen REGLA 0: generación nativa del host antes que el script (entrada 023)

## 2026-09-16

- **feature** — Skill image-gen: imágenes IA coherentes con la web (Codex primero) (entrada 022)
- **feature** — Backend: 5 recetas operativas + catálogo por síntoma + B2 ampliado (entrada 021)
- **feature** — effects-vendor híper completo: 63 repos MIT por categoría + INDEX (entrada 020)
- **feature** — effects-vendor: código real MIT (uiverse, vanta, 6 codrops) + más canteras (entrada 019)
- **feature** — Scraping de la mega colección (índices Codrops/CodePen/Awwwards) (entrada 018)
- **feature** — Fuentes de efectos: colección viva (Codrops, CodePen, protocolo demo→receta) (entrada 017)
- **feature** — Recetario del look moderno (aurora CSS, bento, spotlight, CSS nativo) (entrada 016)
- **feature** — Caja de recursos, playbooks por negocio y modo descubrimiento (/brief) (entrada 015)
- **feature** — Front monstruo: brief, verificación móvil obligatoria, fuentes/iconos, inspiración, A0, reglas extensibles (entrada 014)
- **infra** — Instalación remota desde GitHub (plugins versionados + bootstrap) (entrada 013)
- **feature** — Comandos slash + ui-verify + encoding blindado + perfil Astro híbrido (entrada 012)

## 2026-09-15

- **infra** — Git del repo + test-router (22 casos) + skill de marca de la agencia (entrada 011)
- **feature** — Front Pro: árboles de decisión, catálogo de efectos, enrutado con entrypoints (entrada 010)

## 2026-08-25

- **refactor** — Todo conectado: registro único de skills, contratos verificados, paridad sin hooks (entrada 009)
- **feature** — project-planner: plan/PLAN.md coordina las skills + principios en el prompt base (entrada 008)
- **feature** — Set completo de hooks (11) + config por proyecto (entrada 007)
- **feature** — ddd-hexagonal como biblioteca (74 docs por tema) (entrada 006)
- **feature** — Mega plugin v2: contexto mínimo, code-quality, ddd-hexagonal, más front (entrada 005)
- **feature** — Instalación tipo plugin: marketplace Claude Code + skills globales (entrada 004)
- **refactor** — Vendor UI UX Pro Max + Design Skillstack (overlay ES) (entrada 003)
- **feature** — Mega-skills de front y diseño (entrada 002)

## 2026-07-18

- **infra** — Estructura inicial dev-standards (entrada 001)
