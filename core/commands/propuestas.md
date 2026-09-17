---
description: Modo propuesta — blueprint aprobable + 2 maquetas A/B visuales antes de construir
argument-hint: [página, p. ej. "home" o "landing de escombros"]
---

Aplica `ui-ux-pro-max §references/es/proposal-mode.md` completo para $ARGUMENTS (o la página principal):

1. Si no hay brief → primero `/brief` (no propongas a ciegas).
2. **Blueprint**: escribe `design-system/<slug>/blueprint.md` (secciones + contenido esbozado REAL +
   quién trae qué) y pide aprobación explícita. Itera en texto hasta el APROBADO.
3. **Maquetas**: genera `design-system/<slug>/propuestas/direccion-a.html` y `direccion-b.html`
   (autocontenidas, mismas secciones, direcciones visuales opuestas dentro de la marca, banner de
   PROPUESTA). Abre ambas (o da las rutas) y pregunta en llano cuál y qué mezclar. Máximo 3 maquetas.
4. **Registra**: dirección elegida → MASTER.md (con trazabilidad); opiniones y vetos → `gustos.md`.
5. Solo entonces construye la página real, justificando cada decisión en el idioma del usuario.
