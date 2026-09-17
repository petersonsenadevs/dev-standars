---
description: Checklist de lanzamiento — todo lo que se comprueba antes de publicar la web
argument-hint: [url de preview/producción]
---

Pasa ENTERO `ui-verify §references/launch-checklist.md` sobre $ARGUMENTS, con evidencia por punto
(comando, captura o URL — nada "de memoria"):

1. Técnica (bloqueante): `verify-build.ps1` + `verify-ui.mjs` en 0 + crítica visual
   (`references/visual-critique.md`) + formularios probados de verdad + 404.
2. SEO: titles/descriptions, OG validado, JSON-LD validado, sitemap/robots, canonicals (+ hreflang si hay idiomas).
3. Rendimiento: PageSpeed móvil (LCP < 2,5 s, CLS < 0,1).
4. Medición: analítica tras consentimiento + conversiones del plan (`measurement.md`) disparando en tiempo real.
5. Legales RGPD/LSSI, dominio/SSL/redirects, favicon/manifest, SPF/DKIM/DMARC si hay emails.
6. Contenido final: sin lorem ni placeholders; NAP = Google Business; gustos.md respetado.

Veredicto (LISTA / LISTA con menores / NO) + evidencias al devlog; los "menores" se convierten en
tarjetas X-Tn. Recuerda: el deploy en sí NUNCA sin aprobación explícita del usuario.
