---
description: Aplica un efecto pro de frontend desde el catálogo (parallax, marquee, cursor, stacking…)
argument-hint: <nombre del efecto> [dónde, p. ej. "marquee en el footer de logos"]
---

1. Busca "$ARGUMENTS" en `front-activation/references/effects-catalog.md` y abre SOLO el archivo §sección que indique
   la fila (si no está, usa la sección "Si el efecto no está aquí").
2. Antes de implementar, pasa el árbol F4 (¿puedo permitirme el efecto?): reduced-motion con fallback, LCP, móvil táctil,
   sin scroll-jacking en formularios. Si no existe `design-system/*/MASTER.md`, avísame: el efecto hereda tokens/easing
   del design system.
3. Implementa con la integración de mi stack (limpieza al desmontar incluida) y di cómo verificarlo en el navegador.
