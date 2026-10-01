# Modo propuesta: enseñar antes de construir

Cómo acompaña un diseñador de verdad: estructura aprobada → **2 maquetas que se VEN** → elección del
usuario → construir. Se activa en proyectos nuevos, rediseños o cuando el usuario duda ("no sé lo que
quiero", "sorpréndeme"). NO aplica a cambios pequeños ni componentes sueltos (ahí, directo con el
design system existente). Coste honesto: blueprint ~10 min, cada maqueta 15-30 min — se recupera con
creces en re-trabajo evitado.

## Paso 1 — Blueprint: aprobar la ESTRUCTURA antes que la estética

Con el brief (`brief-discovery.md`) y el playbook del negocio (`business-playbooks.md`), escribe
`design-system/<slug>/blueprint.md` y pídele al usuario que lo apruebe ANTES de diseñar nada:

```markdown
# Blueprint — <página> (PENDIENTE DE APROBACIÓN | APROBADO <fecha>)
| # | Sección | Contenido (esbozado con texto REAL) | Lo trae |
|---|---|---|---|
| 1 | Hero | "Tu obra limpia, sin esperas" + tel + CTA presupuesto | copy: yo · foto: cliente |
| 2 | Servicios | 4 cards: contenedores, sacas, retirada, fin de obra | copy: yo |
| … | | | |
Preguntas abiertas: ¿mostramos precios? ¿cuántas fotos de obras hay?
```

- Contenido esbozado REAL (titulares candidatos, no "aquí irá texto"); columna "Lo trae" = checklist de
  contenido pendiente del cliente.
- Iterar aquí es gratis (es texto). No se pasa al paso 2 sin el APROBADO explícito del usuario.

## Paso 2 — Maquetas A/B: dos direcciones que se pueden ABRIR

Dos archivos HTML **autocontenidos** (doble clic y se ven, sin build ni servidor):
`design-system/<slug>/propuestas/ronda-1/a.html` y `b.html`, copiadas de `plantilla-maqueta.html`
(piezas etiquetadas `A·T1`, `B·B2`… y panel «Tu opinión» para votar cada pieza). Es la ronda 1 de
`rondas.md`: las siguientes fijan lo que gustó, vetan lo que no y siempre traen algo nuevo.

Reglas de cada maqueta:
1. **Un solo archivo**: CSS inline en `<style>`, tipografías por `<link>` de Google Fonts, imágenes como
   placeholders CSS (gradiente/color) o las reales si existen. Sin JS salvo lo imprescindible.
2. Contenido del **blueprint aprobado** (mismas secciones y textos en ambas): solo cambia la dirección
   visual. Basta hero + 1-2 secciones clave + footer; no la página entera.
3. Cada dirección con SUS tokens reales en `:root` (paleta, tipografías, radios) — la elegida se
   promociona tal cual al design system.
4. **Direcciones opuestas de verdad** (clara/serena vs oscura/impactante; serif/editorial vs
   geométrica/tech), ambas dentro de la marca (BRAND.md manda en las dos). Dos grises casi iguales no
   son una elección.
5. Banner fijo arriba: `PROPUESTA <A|B> — baja fidelidad, para elegir dirección` (que nadie la confunda
   con la web final). Responsive básico correcto (375 px sin romper).

Presentación: abre ambas en el navegador (o da las dos rutas) y pregunta en llano: "¿cuál te pega más
con tu negocio? ¿qué te gusta de cada una? Se pueden mezclar (los colores de A con la tipografía de B)".
**No defiendas una favorita**. Si quiere mezclar o ver más, no improvises: siguiente ronda con `/ronda`
(`rondas.md`), que fija lo aprobado, quita lo vetado y propone algo nuevo en cada maqueta.

## Paso 3 — Registrar la elección y los gustos

1. La dirección elegida (o la mezcla) → `design-system/<slug>/MASTER.md` (tokens definitivos) con una
   línea de trazabilidad: "Dirección B elegida por el usuario el <fecha> (maqueta en propuestas/)".
2. TODO lo que el usuario opinó → `design-system/<slug>/gustos.md`:

```markdown
# Gustos del cliente (leer SIEMPRE antes de diseñar)
## Fijado (se mantiene igual en todas las rondas; valor exacto entre acentos graves)
| Categoría | Decisión | Valor | Desde |
|---|---|---|---|
| Tipografía titulares | Fraunces 600 | `Fraunces` | R1 · B·T1 |
## Sí (le gusta)
- 2026-09-17 · "los fondos oscuros me encantan" (elección de dirección B)
## No (vetado — NUNCA proponer de nuevo sin preguntar)
- 2026-09-17 · carruseles automáticos ("me marean") — términos bloqueados: `carousel`, `swiper`
- (siembra por defecto en todo proyecto nuevo) lista negra anti-IA — términos bloqueados: `agenda abierta`,
  `slots disponibles`, `trusted by`, `al siguiente nivel` (el resto de la lista ya lo bloquea el hook
  globalmente: ver ui-ux-pro-max references/es/anti-ia.md)
<!-- Pon entre acentos graves el término técnico: el hook code-hygiene BLOQUEA de verdad cualquier
     edición que lo introduzca en el código. -->
## Dudas / pendiente
- ¿Precios visibles? Dijo "ya veremos" — volver a preguntar antes de la sección
```

## Regla permanente: gustos.md es memoria viva

- **Cualquier** opinión de diseño del usuario en **cualquier** sesión (un "no me gusta", un "así sí",
  un veto) se apunta en `gustos.md` en el momento, con fecha y cita corta. Sin gustos.md previo, se crea.
- Se **lee antes de cada tarea de diseño** y prevalece sobre inspiración, tendencias y todo lo generado
  (solo BRAND.md está por encima). Un veto no se re-propone sin preguntar explícitamente.

## Regla permanente: referencias con rotación (el anti-"siempre Stripe")

Al proponer direcciones A/B o citar ejemplos de diseño: 2-3 referencias **por dirección**, sacadas de
`inspiration.md` **filtradas por la industria del cliente** — webs del sector o de sectores con el mismo
mood, no siempre las mismas. **Stripe, Linear, Apple, Notion, Airbnb y Vercel están vetadas como
muletilla**: solo se citan si el usuario las nombra o el proyecto es literalmente de su sector. Cada
referencia se cita con el PORQUÉ concreto ("mira cómo X resuelve el menú de servicios"), no como
adorno de autoridad.

## Regla permanente: checkpoint por sección (acompañar de verdad)

Al construir (maquetas o página final): se termina UNA sección → se enseña (captura o URL) → UNA
pregunta concreta y cerrada ("¿este hero te transmite cercanía o lo prefieres más serio?") → la
respuesta va a `gustos.md` → siguiente sección. **Nunca más de una sección sin enseñar nada.** Si el
usuario está ausente, se avanza marcando cada decisión como propia ("criterio mío, se cambia sin
drama") y se le presenta el lote con las preguntas acumuladas al volver.

## Regla permanente: justificar en el idioma del usuario

Al entregar cualquier diseño (maqueta o final), cada decisión visible se liga a SU brief o SUS gustos,
en llano: "serif grande porque pediste que se viera premium", "sin carrusel: lo vetaste el 17-09",
"el teléfono fijo arriba porque tu cliente llama desde el móvil". Si una decisión no se puede ligar a
nada suyo, es tuya: dilo ("esto es criterio mío, se cambia sin drama").
