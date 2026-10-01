---
description: Modo propuesta — blueprint aprobable + 2 maquetas A/B visuales antes de construir
---

Uso: `/propuestas [página, p. ej. "home" o "landing de escombros"]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `ui-ux-pro-max §references/es/proposal-mode.md` completo para lo que el usuario escribió tras el comando (o la página principal):

1. Si no hay brief → primero `/brief` (no propongas a ciegas).
2. **Blueprint**: escribe `senzu/design-system/<slug>/blueprint.md` (secciones + contenido esbozado REAL +
   quién trae qué) y pide aprobación explícita. Itera en texto hasta el APROBADO.
3. **Maquetas (ronda 1)**: genera `senzu/design-system/<slug>/propuestas/ronda-1/a.html` y `b.html` desde la
   plantilla `references/es/plantilla-maqueta.html` (piezas etiquetadas y panel «Tu opinión»)
   (autocontenidas, mismas secciones, direcciones visuales opuestas dentro de la marca, banner de
   PROPUESTA). Verifica con `ronda-check.mjs` y abre ambas (o da las rutas): el usuario vota las piezas en el panel o
   lo dice en llano. Para seguir afinando, `/ronda` (lo que gusta se fija, lo que no se veta, siempre algo nuevo).
   Referencias con rotación por industria (§referencias de proposal-mode): nada de "como Stripe" por
   inercia. CERO patrones de la lista negra `references/es/anti-ia.md` (badges de disponibilidad,
   numeración de secciones, trusted-by, métricas inventadas...).
4. **Registra**: dirección elegida → MASTER.md (con trazabilidad, incluido el SET de iconos elegido);
   opiniones y vetos → `gustos.md` (siembra los vetos anti-IA por defecto).
5. Solo entonces construye la página real, con **checkpoint por sección** (una sección → enseñar →
   una pregunta → gustos.md → siguiente), justificando cada decisión en el idioma del usuario.
