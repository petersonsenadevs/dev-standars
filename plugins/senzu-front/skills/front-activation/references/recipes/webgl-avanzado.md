# Recetas: WebGL avanzado

Efectos de alto impacto y coste ALTO: máximo uno por página, lazy (se cargan al entrar en pantalla o
tras la interacción), con fallback estático en móvil de gama baja y con reduced-motion. Antes de usar
cualquiera: ¿lo pide la marca o es un capricho? Si no aporta nada al mensaje, fuera.
Código de referencia descargado: `core/effects-vendor/` (webgl-fluid, cobe) — ver `effect-sources.md`.

## Índice
- Fluido que sigue al ratón
- Metaballs
- Dithering, ASCII y píxel
- Globo 3D
- Liquid glass
- Ruido animado en shader

## Fluido que sigue al ratón

Tinta o humo que se mueve con el cursor (simulación de fluidos en GPU). Base: `webgl-fluid`
(vendor, MIT) — se monta en un `<canvas>` a pantalla completa detrás del hero.
- Reduce la resolución de la simulación en móvil (`SIM_RESOLUTION` 64-128) o desactívalo.
- Colores del design system (no el arcoíris por defecto: es el look "demo de 2019").
- Pausa cuando el canvas sale de pantalla (IntersectionObserver) y en `visibilitychange`.

## Metaballs

Burbujas que se fusionan al acercarse (versión GPU del efecto gooey). En un fragment shader: suma de
campos `r² / d²` de cada bola y umbral con `smoothstep`.
```glsl
float campo = 0.0;
for (int i = 0; i < N; i++) { vec2 d = uv - bolas[i]; campo += radios[i] * radios[i] / dot(d, d); }
float borde = smoothstep(0.95, 1.05, campo);
gl_FragColor = vec4(mix(colorFondo, colorBola, borde), 1.0);
```
Sin WebGL: el efecto gooey de formas-svg.md hace algo parecido con pocas bolas.
Base de shaders y mesh gradient: skill threejs-webgl, `references/es/shaders-basics.md`.

## Dithering, ASCII y píxel

Post-procesado que convierte una imagen o escena en tramado (dithering), caracteres (ASCII) o píxeles
grandes: estética retro/editorial muy de 2025-26.
- Three.js: `EffectComposer` + un pase propio (o `AsciiEffect` de los ejemplos oficiales).
- Dithering ordenado (Bayer 4×4) en un fragment shader: compara la luminancia con la matriz y pinta
  dos colores de la marca.
- Imagen fija: hazlo UNA vez en build (o en canvas al cargar) y sirve el resultado como imagen; no
  pagues un shader en tiempo real para algo estático.

## Globo 3D

Un globo terráqueo ligero con puntos o marcadores (oficinas, envíos, clientes). Base: `cobe`
(vendor, MIT, ~5 kB) — WebGL mínimo, rota solo, marcadores por lat/long.
```js
import createGlobe from 'cobe';
const globe = createGlobe(canvas, { devicePixelRatio: 2, width: 1000, height: 1000, phi: 0, theta: 0.25,
  dark: 0, diffuse: 1.2, mapSamples: 16000, mapBrightness: 6, baseColor: [1, 1, 1],
  markerColor: [0.1, 0.4, 1], glowColor: [1, 1, 1], markers: [{ location: [39.47, -0.38], size: 0.08 }],
  onRender: (s) => { s.phi += 0.003; } });
// al desmontar: globe.destroy()
```
Reduced-motion: sin rotación (`phi` fijo). Solo si los lugares significan algo para el negocio.

## Liquid glass

Cristal que refracta lo que hay detrás (la estética de Apple desde 2025): desenfoque + distorsión
de borde. Versión robusta: `backdrop-filter: blur(16px) saturate(1.4)` + borde con gradiente sutil +
sombra interior. Versión con refracción: filtro SVG `feDisplacementMap` aplicado vía `backdrop-filter:
url(#filtro)` — **solo Chromium**, así que siempre con la versión robusta como fallback.
Legibilidad primero: el texto sobre cristal cumple el contraste 4.5:1 con el fondo MÁS claro que pueda
pasar por detrás. Úsalo en barras flotantes o una tarjeta destacada, no en toda la interfaz.

## Ruido animado en shader

Grano o ruido fino animado sobre un fondo de color (aspecto "película", orgánico). Versión barata:
el grano SVG estático del catálogo (Fondos). Versión animada: fragment shader con ruido simplex o hash
dependiente de `uTime`, a baja resolución y escalado. Opacidad 3-8%: si se nota a simple vista, sobra.
