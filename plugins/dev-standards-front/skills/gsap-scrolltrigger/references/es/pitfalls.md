# Errores frecuentes y soluciones

## 1. Olvidar `gsap.registerPlugin`

Síntoma: `scrollTrigger` en vars se ignora silenciosamente (o warning "Invalid property scrollTrigger"), `SplitText is not a constructor`, bundlers que tree-shakean el plugin.

```js
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger); // en un único módulo importado por todos
```

## 2. Tweens en conflicto sobre la misma propiedad

Síntoma: hover que "salta" o vuelve al estado antiguo; el elemento termina donde no debe.

```js
gsap.to(el, { scale: 1.05, overwrite: 'auto' }); // mata solo props en conflicto en tweens activos
```

O reutilizar un tween/timeline con `play()/reverse()` en lugar de crear uno nuevo por evento.

## 3. ScrollTrigger dentro de una timeline con posición

Síntoma: los tweens con `scrollTrigger` dentro de `tl.to(...)` no responden al scroll o rompen la timeline.

Regla: `scrollTrigger` va en la timeline (`gsap.timeline({ scrollTrigger })`), nunca en tweens hijos. Un tween hijo pertenece a la timeline y su tiempo lo controla ella.

## 4. `from()` que parpadea (FOUC)

Síntoma: el elemento se ve un frame en su estado final antes de saltar al inicial, o queda visible en SSR hasta que corre JS.

- Ocultar en CSS con clase condicionada a JS (`html.js [data-reveal] { visibility: hidden }`) y animar con `fromTo(..., { autoAlpha: 1 })`.
- Usar `autoAlpha` (opacity + visibility), no `opacity`.
- `gsap.set` inicial + `to` en vez de `from` cuando el estado inicial debe ser determinista (batch, re-renders).

## 5. Dos `from()` sobre el mismo target en una timeline

Síntoma: el segundo `from` aplica su estado inicial inmediatamente (por `immediateRender: true`), pisando el primero.

```js
tl.from(el, { x: -100 }).from(el, { y: 50, immediateRender: false }, '+=0.5');
```

O usar `to()` / `fromTo()` para el segundo.

## 6. No hacer `refresh()` tras cargar imágenes o fuentes

Síntoma: triggers que se disparan demasiado pronto/tarde, pins descolocados, `end` incorrecto.

```js
window.addEventListener('load', () => ScrollTrigger.refresh());
document.fonts.ready.then(() => ScrollTrigger.refresh());
```

Y reservar espacio con `width/height`/`aspect-ratio` en imágenes. Tras contenido dinámico (fetch, paginación, acordeón): `ScrollTrigger.refresh()`.

## 7. Pin y `pinSpacing`

Síntoma: al pinear, el contenido siguiente se solapa o queda un hueco enorme.

- `pinSpacing: true` (defecto) añade padding equivalente a la duración del pin: normalmente correcto.
- `pinSpacing: false` cuando quieres que la siguiente sección se deslice por encima.
- Si el pin está dentro de un contenedor `display: flex`/`grid`, el spacing puede fallar: envolver el elemento pineado en un `div` propio o usar `pinSpacing: 'margin'`.
- Pines dentro de un elemento con `transform`: el `position: fixed` deja de funcionar. Usar `pinType: 'transform'` o eliminar el transform del ancestro.

## 8. Ancestro con `overflow: hidden` / `overflow: auto`

Síntoma: ScrollTrigger no detecta scroll, `markers` no se mueven, el pin no funciona.

Causa: el scroll real ocurre en un contenedor, no en `window`. Soluciones:

- Quitar el `overflow` del ancestro (habitual: `body { overflow-x: hidden }` en algunos navegadores convierte el body en scroller; usar `html, body { overflow-x: clip }`).
- Si el contenedor debe hacer scroll: `scroller: '.contenedor'` en cada trigger (o `ScrollTrigger.defaults({ scroller })`).

## 9. `window is not defined` (SSR)

Síntoma: build/SSR de Inertia, Next o Astro rompe al importar `ScrollTrigger`, `SplitText` o `Lenis`.

- Registrar plugins bajo guard (`if (!import.meta.env.SSR)` / `typeof window !== 'undefined'`).
- Ejecutar animaciones solo en `onMounted` / `useGSAP` / `astro:page-load`.
- Importar módulos con dependencia de DOM de forma dinámica en SSR estricto: `const { default: Lenis } = await import('lenis')`.

## 10. `transform` CSS sobrescrito por GSAP (o al revés)

Síntoma: un `transform: translateX(-50%)` de centrado desaparece al animar `x`; o un hover CSS con `transform` se pisa con el tween.

- GSAP gestiona la propiedad `transform` completa. Traslada el centrado a GSAP (`xPercent: -50, yPercent: -50`) o usa `translate` CSS individual (propiedad independiente `translate`, no `transform`) o `inset`/flex para centrar.
- No mezclar `transition: transform` CSS y tweens de transform sobre el mismo elemento: el CSS interfiere en cada frame. Quitar `transition` del elemento animado por GSAP (o animar un wrapper).

## 11. SplitText antes de que carguen las fuentes web

Síntoma: líneas mal calculadas, saltos de línea que cambian al cargar la fuente.

```js
document.fonts.ready.then(() => SplitText.create(el, { type: 'lines', autoSplit: true, onSplit: (self) => gsap.from(self.lines, {...}) }));
```

`autoSplit: true` re-splitea en resize; devolver la animación desde `onSplit` para que se revierta correctamente. Llamar a `split.revert()` en cleanup (o crear dentro de `gsap.context`).

## 12. Scroller personalizado mal configurado

Síntoma: con smooth scroll por transform (Locomotive, ScrollSmoother manual), los triggers no sincronizan.

- Lenis: no necesita `scrollerProxy` (scroll nativo). Solo `lenis.on('scroll', ScrollTrigger.update)` + raf desde `gsap.ticker`.
- Scroll por transform: `ScrollTrigger.scrollerProxy(el, { scrollTop(value) {...}, getBoundingClientRect() {...}, pinType: 'transform' })` y `scroller: el` en los triggers.

## 13. `markers: true` en producción

Síntoma: líneas "start/end" visibles en el sitio real.

```js
markers: import.meta.env.DEV // o process.env.NODE_ENV !== 'production'
```

## 14. Crear animaciones fuera del contexto (sin cleanup)

Síntoma: al navegar (Inertia/Next/Astro) las animaciones se acumulan, elementos invisibles, errores por targets nulos, memoria creciente.

Todo tween/ScrollTrigger dentro de `gsap.context` (`useGsap`, `useGSAP`, handler de `astro:page-load`); handlers con `contextSafe` (React) o `ctx.add` (Vue). `revert()` en unmount.

## 15. ScrollTriggers creados en orden incorrecto

Síntoma: pins que se descolocan cuando hay varios en la página, especialmente si los componentes montan en distinto orden.

Crear en orden de aparición en el documento, o llamar a `ScrollTrigger.sort()` tras crearlos, o asignar `refreshPriority` (mayor = se refresca antes). En frameworks con componentes que montan en paralelo, un `ScrollTrigger.sort(); ScrollTrigger.refresh()` en el `navigate`/`page-load` resuelve la mayoría de casos.

## 16. Selectores de string sin scope

Síntoma: un componente anima los `.card` de otro componente; en listas con varias instancias todas se animan a la vez.

Pasar `scope` a `gsap.context(fn, rootEl)`; en Astro iterar instancias.

## 17. `scrub` con `ease` distinto de `none`

Síntoma: movimiento con aceleración extraña durante el scroll.

Con `scrub`, el progreso lo dicta el scroll; el ease solo distorsiona la relación. Usar `ease: 'none'` en tweens scrubbed (excepto si buscas ese efecto conscientemente).

## 18. Animar `height`, `width`, `top`, `left`

Síntoma: jank, especialmente en móvil; layout thrash con varios elementos.

Transforms (`x`, `y`, `scale`) y `clipPath`. Ver `performance-a11y.md`.

## 19. Ignorar `prefers-reduced-motion`

Síntoma: usuarios con sensibilidad al movimiento no pueden usar el sitio; fallo de accesibilidad.

`gsap.matchMedia()` con rama `reduce` que deja el contenido visible y estático. Lenis desactivado.

## 20. Restauración de scroll y pins en SPA

Síntoma: al navegar atrás, el navegador restaura la posición antes de que existan los ScrollTriggers y el pin aparece desplazado.

`ScrollTrigger.clearScrollMemory('manual')` al iniciar la app (desactiva `history.scrollRestoration` automática) y dejar que el router restaure; después `refresh()`.

## 21. `duration` en tweens con `scrub`

Síntoma: cambiar `duration` no cambia nada.

Con scrub las duraciones son proporciones relativas dentro de la timeline, no segundos. La "duración" real la define `start`/`end` del ScrollTrigger.

## 22. `start`/`end` con valores fijos que dependen de medidas

Síntoma: correcto en desktop, roto en móvil o tras resize.

Usar funciones y `invalidateOnRefresh: true`:

```js
end: () => `+=${track.scrollWidth - window.innerWidth}`,
x: () => -(track.scrollWidth - window.innerWidth),
invalidateOnRefresh: true,
```

## 23. Barra de dirección móvil que provoca refresh continuos

Síntoma: saltos y reinicio de animaciones al hacer scroll en iOS/Android.

`ScrollTrigger.config({ ignoreMobileResize: true })` y `100svh/100dvh` en CSS.

## 24. Elementos `display: none` o `v-if` al crear el trigger

Síntoma: trigger con `start` y `end` iguales, animación que nunca se dispara.

Crear la animación tras montar el elemento visible (`nextTick`, `v-show` en lugar de `v-if` si se alterna, o `ScrollTrigger.refresh()` tras mostrarlo).

## 25. Reutilizar un `from()` para "reset"

Síntoma: al llamar de nuevo a `gsap.from`, el elemento salta porque el valor "final" ya no es el original.

`from` toma como destino el estado actual. Para animaciones repetibles usar `fromTo` con ambos extremos explícitos, o guardar la timeline y `restart()`.

## 26. Interferencia de Tailwind `transition-*` y `transform`

Síntoma: el elemento con `transition-all` o `transform` de Tailwind se comporta raro con GSAP.

Quitar utilidades `transition-*` de los elementos animados por GSAP; no usar `translate-x-*`/`scale-*` de Tailwind en ellos (mismo conflicto que el punto 10). Aplicar esas clases a un wrapper si hace falta.

## 27. Memory leaks con `gsap.ticker.add` y listeners

Síntoma: consumo creciente y callbacks ejecutándose tras desmontar.

Emparejar siempre `ticker.add` con `ticker.remove`, y listeners con `removeEventListener` en el cleanup (función de retorno en `useGsap`/`useGSAP`).

## 28. Diagnóstico rápido

```js
console.log(gsap.version, ScrollTrigger.version);
console.log(ScrollTrigger.getAll().map((t) => ({ trigger: t.trigger, start: t.start, end: t.end, pin: !!t.pin })));
gsap.globalTimeline.timeScale(0.2); // cámara lenta para inspeccionar
```

GSDevTools (`gsap/GSDevTools`, gratuito) para scrubbing de timelines con `id`.
