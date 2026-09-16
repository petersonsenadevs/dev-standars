---
name: ui-verify
description: "Verificación de UI en navegador real: capturas en 375/768/1440, dark mode, consola y accesibilidad (axe). Úsala al terminar una vista o al pedir verificar el responsive, antes de dar la UI por hecha; sin navegador, fallback manual."
---

# ui-verify (dev-standards)

Cierra el ciclo de `ui-ux-pro-max`: su checklist exige comprobar 375/768/1440, dark mode y accesibilidad — esta skill
lo hace de verdad en el navegador en vez de darlo por supuesto. Se usa al terminar una vista, en `/revisar-ui` y como
parte del "Verificar" de las tarjetas de UI del plan.

## Requisitos
- La app corriendo en local (usa el comando `dev` de `config.json`/`stack.json` si hay que arrancarla) y una URL objetivo.
- Navegador: herramientas Chrome MCP (`claude-in-chrome`). Si no están disponibles → `## Fallback sin navegador`.

## Flujo con navegador (referencia paso a paso: `references/browser-checks.md`)
1. Abre la URL objetivo en una pestaña nueva.
2. Por cada ancho **375, 768, 1440**: redimensiona, espera el render y captura pantalla completa; anota scroll
   horizontal inesperado, textos cortados/superpuestos y CLS visible.
3. **Dark mode**: alterna el tema (toggle de la app o `prefers-color-scheme` emulado) y captura 375 y 1440.
4. **Consola y red**: recoge errores/warnings de consola y peticiones fallidas (4xx/5xx, assets 404).
5. **Accesibilidad**: inyecta axe-core y ejecuta el análisis; lista violaciones por impacto (critical/serious primero)
   con selector y regla. Comprueba a mano: un H1, foco visible tabulando 10 elementos, `Esc` cierra modales.
6. **Interacción mínima**: hover/focus en CTAs y navegación; formularios muestran error junto al campo.
7. **Informe** (va al devlog y a la tarjeta del plan): tabla ancho×tema con OK/incidencias, violaciones axe, errores de
   consola, y veredicto: `APTA` / `APTA con menores` / `NO APTA` (+ acciones concretas).

## Fallback sin navegador
Pídeme abrir la URL y reporta tú contra el checklist: DevTools responsive en los 3 anchos, toggle de dark, consola
limpia, Tab por la página, Lighthouse (Accesibilidad ≥ 95). Deja explícito en el devlog que la verificación fue manual.

## Reglas duras
- Una UI no está "hecha" sin esta pasada (automática o fallback) documentada en el devlog.
- No corrijas sobre la marcha lo que encuentres: repórtalo (o tarjeta `X-Tn` si hay plan) y espera decisión, salvo que
  la tarea actual fuese exactamente arreglar eso.
- Capturas con nombre significativo (`home-375-dark.png`) y guardadas donde indique el proyecto (o scratchpad).
- No navegues fuera de la URL objetivo ni envíes formularios con datos reales.
