# Performance web (front): Core Web Vitals sin humo

Índice: 1 Medir antes de tocar · 2 LCP · 3 CLS · 4 INP · 5 Imágenes y fuentes · 6 Presupuesto JS ·
7 Umbrales de aceptación · 8 Errores típicos

(El rendimiento de backend — N+1, caché, colas — vive en `code-quality references/performance.md`; esto es lo
que pasa DEL SERVIDOR AL PÍXEL.)

## 1. Medir antes de tocar
- **Lighthouse en móvil con throttling** (DevTools o `npx lighthouse <url> --preset=perf --form-factor=mobile`)
  sobre el build de PRODUCCIÓN (`npm run build && preview`) — el dev server miente.
- Mira las 3 métricas que importan: **LCP < 2,5 s · CLS < 0,1 · INP < 200 ms**. Lo demás es diagnóstico.
- Un cambio de perf sin un antes/después medido no existe (pega ambos en el devlog).

## 2. LCP (lo más grande tarda en pintarse)
- Identifica el elemento LCP (Lighthouse te lo dice): casi siempre la imagen/título del hero.
- Imagen de hero: `fetchpriority="high"`, `loading="eager"` (NUNCA lazy el LCP), tamaño correcto (srcset),
  formato moderno, y a ser posible `<img>` en el HTML inicial (no background-image ni montada por JS).
- Fuente del titular: `preload` del woff2 del titular + `font-display: swap`.
- El servidor también cuenta: HTML cacheado/estático (TTFB), CDN, sin cadenas de redirects.

## 3. CLS (nada salta)
- TODA imagen/vídeo/iframe con dimensiones (`width`/`height` o `aspect-ratio`): el hueco se reserva antes de cargar.
- Fuentes: `font-display: swap` + `size-adjust`/fallback métrico (o `@nuxt/fonts`, `next/font` que lo hacen solo).
- Contenido inyectado (banners, embeds, ads): espacio reservado SIEMPRE; skeletons con la misma altura que
  lo que sustituyen. Animar solo `transform`/`opacity` (no height/top que empujan el layout).

## 4. INP (responde al toque)
- Tareas largas de JS parten el hilo: trocea con `requestIdleCallback`/`scheduler.yield`, debounce en
  inputs que filtran, virtualización en listas largas (>200 filas).
- Handlers ligeros: el click actualiza la UI YA (optimista/spinner local) y el trabajo pesado va después o al servidor.
- Hidratación: islands/`client:visible` (Astro), server components (Next), `defer` — no hidrates lo que no interactúa.

## 5. Imágenes y fuentes (el 80% del peso)
- Componente del framework SIEMPRE (`next/image`, `<NuxtImg>`, `astro:assets`, enhanced-img): tamaños,
  formatos y lazy resueltos. Lazy por defecto para TODO menos el LCP.
- Máximo 2 familias tipográficas, subsets latinos, self-hosted woff2 (nada de 6 pesos "por si acaso").
- Vídeo de fondo: poster + `preload="none"` + solo desktop; en móvil, imagen.

## 6. Presupuesto JS
- Antes de añadir una dependencia de front: peso en bundlephobia; ¿lo hace CSS moderno o la plataforma?
  (carousels → scroll-snap; tilt/parallax ligero → CSS; fechas → Intl, no moment).
- Analiza el bundle cuando engorde (`next build` report, `vite-bundle-visualizer`): el top-5 de módulos
  gordos, y `import()` dinámico para lo que no es above-the-fold (editor, mapa, chart, modal pesado).
- Third-parties (chat, analytics, maps): cargar tras interacción o con facade (imagen que al click carga el
  iframe real). Cada script de terceros se justifica.

## 7. Umbrales de aceptación (checklist /lanzar)
- Lighthouse móvil: Performance ≥ 90 en landing/marketing; ≥ 75 en apps densas (documenta por qué si baja).
- LCP < 2,5 s · CLS < 0,1 · INP < 200 ms · peso de la home < 1,5 MB transferido · JS inicial < 200 KB gzip
  (orientativos: si te pasas, explica qué lo justifica en el devlog).

## 8. Errores típicos del agente
- Optimizar sin medir (o medir en dev server / desktop sin throttling).
- `loading="lazy"` en la imagen del hero · imágenes sin dimensiones · fuente de iconos entera para 5 iconos.
- Animar top/left/height (layout thrash) en vez de transform · scroll listeners sin passive/throttle.
- Añadir una librería de 80 KB para algo que era CSS · hidratar toda la página para un botón interactivo.
- "Ya optimizaré al final": el presupuesto se decide al principio, recuperar 2 MB después es cirugía.
