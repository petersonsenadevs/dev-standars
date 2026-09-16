# GSAP 3.12+ — Cheatsheet de API

Referencia rápida. GSAP es gratuito al completo desde 2025 (incluidos ScrollTrigger, SplitText, MorphSVG, Draggable, Flip, etc.). Todos los plugins se registran con `gsap.registerPlugin(...)` una sola vez.

```js
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase); // idempotente, seguro repetirlo
```

## 1. Tweens básicos

```js
gsap.to('.box', { x: 200, opacity: 1, duration: 0.6, ease: 'power2.out' });
gsap.from('.box', { y: 40, autoAlpha: 0, duration: 0.6 });          // desde -> estado actual
gsap.fromTo('.box', { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }); // control total de ambos extremos
gsap.set('.box', { x: 0, clearProps: 'transform' });                  // inmediato, sin animación
```

Propiedades útiles del vars object:

| Prop | Descripción |
|---|---|
| `duration` | Segundos (por defecto 0.5) |
| `delay` | Retardo inicial |
| `ease` | Ver sección easing |
| `repeat`, `repeatDelay`, `yoyo` | `repeat: -1` = infinito |
| `stagger` | Escalonado entre targets |
| `autoAlpha` | `opacity` + `visibility` (`hidden` cuando llega a 0). Preferir sobre `opacity` para elementos que deben dejar de ser interactivos |
| `xPercent`, `yPercent` | Porcentaje relativo al propio elemento (mejor que `x: '50%'`) |
| `transformOrigin` | `'50% 50%'`, `'left top'` |
| `clearProps` | `'all'` o lista `'transform,opacity'`; limpia inline styles al terminar |
| `overwrite` | `false` (defecto), `true` (mata todos los tweens del target) o `'auto'` (solo props en conflicto) |
| `immediateRender` | `from`/`fromTo` lo tienen a `true` por defecto; `to` a `false` |
| `paused` | Crear en pausa |
| `id` | Para `gsap.getById()` |

Valores relativos y funcionales:

```js
gsap.to('.item', {
  x: '+=100',                     // relativo
  y: (i, el, targets) => i * 20,  // función por target
  rotation: 'random(-15, 15)',    // random string
  scale: 'random([0.8, 1, 1.2])',
});
```

## 2. Timelines

```js
const tl = gsap.timeline({
  defaults: { duration: 0.5, ease: 'power3.out' }, // heredado por los hijos
  paused: false,
  repeat: 0,
  onComplete: () => {},
});

tl.from('.hero__title', { y: 40, autoAlpha: 0 })
  .from('.hero__subtitle', { y: 20, autoAlpha: 0 }, '-=0.3') // solapa 0.3s con el anterior
  .addLabel('cta')
  .from('.hero__cta', { scale: 0.9, autoAlpha: 0 }, 'cta')
  .from('.hero__img', { x: 60, autoAlpha: 0 }, '<')          // al inicio del tween anterior
  .to('.badge', { rotation: 360 }, '+=0.5')                  // 0.5s después del final de la timeline
  .to('.badge', { scale: 1.1 }, 'cta+=1')                    // 1s después de la label
  .add(otherTimeline, 2)                                     // timeline anidada en t=2
  .call(fn, [arg1], 'cta');                                  // callback en posición
```

Position parameter:

| Valor | Significado |
|---|---|
| (omitido) | Al final de la timeline |
| `1.5` | Tiempo absoluto |
| `'+=0.5'` / `'-=0.5'` | Relativo al final de la timeline |
| `'<'` | Al inicio del tween anterior |
| `'>'` | Al final del tween anterior |
| `'<0.2'` / `'>-0.2'` | Relativo al inicio/final del tween anterior |
| `'label'`, `'label+=1'` | Relativo a una label |
| `'<+=25%'` | Porcentaje de la duración del tween anterior |

Métodos útiles: `tl.duration()`, `tl.labels`, `tl.getChildren()`, `tl.tweenTo('label')`, `tl.seek('label')`, `tl.clear()`, `tl.kill()`, `tl.recent()`.

Timeline anidadas: crear funciones que devuelven timelines y componerlas con `.add()`. Es el patrón de escalado para secuencias largas.

```js
function introTitle() { return gsap.timeline().from('.t', { y: 30, autoAlpha: 0 }); }
function introCards() { return gsap.timeline().from('.card', { y: 30, autoAlpha: 0, stagger: 0.1 }); }
const master = gsap.timeline().add(introTitle()).add(introCards(), '-=0.2');
```

## 3. Defaults globales

```js
gsap.defaults({ ease: 'power2.out', duration: 0.6 });
gsap.config({ nullTargetWarn: false, force3D: 'auto' });
```

`gsap.defaults` se aplica a tweens sueltos; los `defaults` de una timeline tienen prioridad sobre ellos.

## 4. Stagger

```js
// simple
gsap.from('.item', { y: 20, autoAlpha: 0, stagger: 0.08 });

// avanzado
gsap.from('.cell', {
  scale: 0,
  stagger: {
    each: 0.05,          // o `amount: 1` (tiempo total repartido)
    from: 'center',      // 'start' | 'end' | 'center' | 'edges' | 'random' | índice numérico | [x, y]
    grid: 'auto',        // o [filas, columnas]; necesario para from:'center' en 2D
    axis: 'x',           // limitar el cálculo a un eje
    ease: 'power2.in',   // distribución temporal del stagger
    repeat: -1, yoyo: true, // aplican a cada sub-tween
  },
});
```

`gsap.utils.distribute()` permite el mismo cálculo para cualquier propiedad, no solo el tiempo.

## 5. Easing

Formato `nombre.tipo`: `power1..power4`, `back`, `elastic`, `expo`, `circ`, `sine`, `bounce` con sufijo `.in`, `.out`, `.inOut`. `none` (lineal) para scrub y movimientos continuos.

```js
ease: 'power3.out'
ease: 'back.out(1.7)'          // overshoot configurable
ease: 'elastic.out(1, 0.3)'    // amplitud, periodo
ease: 'expo.inOut'
ease: 'steps(5)'
ease: 'slow(0.7, 0.7, false)'  // SlowMo
ease: 'rough({ strength: 1, points: 20 })'
```

CustomEase (curvas cubic-bezier o SVG path):

```js
CustomEase.create('brand', 'M0,0 C0.25,0.1 0.25,1 1,1');
CustomEase.create('snappy', '0.22, 1, 0.36, 1'); // formato cubic-bezier CSS
gsap.to('.x', { x: 100, ease: 'brand' });
```

Recomendaciones: `power2.out`/`power3.out` para entradas; `power2.inOut` para movimientos entre estados; `back.out(1.4)` para pops; `none` para scrub de scroll y loops continuos.

## 6. Responsive y reduced motion: `gsap.matchMedia()`

Sustituye a `ScrollTrigger.matchMedia` (deprecado). Cada callback se ejecuta cuando la query hace match y su contenido se revierte automáticamente cuando deja de coincidir. Las animaciones creadas dentro se registran en un `gsap.context` interno.

```js
const mm = gsap.matchMedia();

mm.add(
  {
    isDesktop: '(min-width: 1024px)',
    isMobile: '(max-width: 1023px)',
    reduceMotion: '(prefers-reduced-motion: reduce)',
  },
  (context) => {
    const { isDesktop, isMobile, reduceMotion } = context.conditions;

    if (reduceMotion) {
      gsap.set('.reveal', { clearProps: 'all' });
      return; // sin animaciones; los elementos quedan visibles
    }

    gsap.from('.reveal', {
      y: isDesktop ? 60 : 20,
      autoAlpha: 0,
      stagger: 0.1,
      scrollTrigger: { trigger: '.reveal', start: 'top 85%' },
    });

    return () => {
      // cleanup opcional: solo para cosas fuera del control de GSAP (listeners, observers)
    };
  },
);

// en unmount
mm.revert();
```

Query compacta para una sola condición:

```js
mm.add('(prefers-reduced-motion: no-preference)', () => { /* animaciones */ });
```

## 7. `gsap.context()` y `revert()`

Agrupa todas las animaciones/ScrollTriggers creados dentro del callback, con scoping opcional de selectores. Es el mecanismo estándar de cleanup en frameworks.

```js
const ctx = gsap.context((self) => {
  // '.card' se busca solo dentro de rootEl
  gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.1 });

  // añadir funciones reutilizables al contexto
  self.add('onHover', (el) => gsap.to(el, { scale: 1.05 }));
}, rootEl);

ctx.onHover(someEl);   // funciones añadidas con self.add están disponibles
ctx.add(() => { ... }); // añadir más animaciones después, siguen el mismo scope

ctx.revert(); // mata tweens, ScrollTriggers y restaura inline styles previos
ctx.kill();   // mata sin restaurar estilos
```

Diferencia entre `revert()` y `kill()`: `revert` devuelve el DOM al estado previo a las animaciones (importante para `from()` y para HMR); `kill` solo detiene.

## 8. `gsap.quickTo()` y `gsap.quickSetter()`

Para actualizaciones de alta frecuencia (mousemove, pointer follow). Reutiliza el mismo tween en lugar de crear uno nuevo por evento.

```js
const xTo = gsap.quickTo('.cursor', 'x', { duration: 0.4, ease: 'power3' });
const yTo = gsap.quickTo('.cursor', 'y', { duration: 0.4, ease: 'power3' });

window.addEventListener('pointermove', (e) => {
  xTo(e.clientX);
  yTo(e.clientY);
});

// sin interpolación (set directo, más barato aún)
const setX = gsap.quickSetter('.dot', 'x', 'px');
setX(120);
```

## 9. `gsap.utils`

```js
const { toArray, mapRange, clamp, wrap, interpolate, snap, random, pipe, unitize, selector, normalize } = gsap.utils;

toArray('.item');                       // NodeList/selector/array -> Array
toArray(ref.value.children);

mapRange(0, 100, 0, 1, 50);              // 0.5
const m = mapRange(0, window.innerWidth, -1, 1); // función reutilizable

clamp(0, 1, 1.4);                        // 1
const c = clamp(0, 100);                 // función

wrap(0, 5, 7);                           // 2 (útil para índices circulares)
wrap(['a', 'b', 'c'], 4);                // 'b'

interpolate('#fff', '#000', 0.5);        // color intermedio
interpolate({ x: 0 }, { x: 100 }, 0.25); // objetos
const lerp = interpolate(0, 360);        // función

snap(10, 23);                            // 20
snap([0, 50, 100], 62);                  // 50
snap({ values: [0, 50], radius: 10 }, 45); // 50

random(0, 100, 5);                       // múltiplo de 5
random(['a', 'b']);

pipe(clamp(0, 100), snap(5), mapRange(0, 100, 0, 1)); // composición

selector(rootEl)('.child');              // selector con scope
normalize(0, 200, 50);                   // 0.25
```

## 10. `overwrite` e `immediateRender`

`overwrite`:

- `false` (defecto): coexisten; el último creado gana en cada frame para las props en conflicto, pero el anterior sigue vivo y puede reaparecer al terminar.
- `'auto'`: al empezar a renderizar, mata solo las propiedades en conflicto de otros tweens activos sobre el mismo target. Es la opción habitual para hover/toggle.
- `true`: mata inmediatamente todos los tweens del target, sin importar las propiedades.

`immediateRender`:

- `from()` y `fromTo()` renderizan su estado inicial en el momento de crearse (`immediateRender: true`), incluso con `delay` o en timelines. Esto causa "saltos" si dos `from` del mismo target están en una timeline: el segundo aplica su estado inicial inmediatamente. Solución: `immediateRender: false` en el segundo, o usar `to()`.
- `to()` con `scrollTrigger` y `immediateRender: false` evita renderizar antes de que el trigger sea activo.

## 11. Control de reproducción

```js
const tl = gsap.timeline({ paused: true });

tl.play();  tl.pause();  tl.resume();  tl.reverse();  tl.restart();
tl.play('label');          // desde label
tl.progress(0.5);          // 0..1 (getter/setter)
tl.totalProgress(0.5);     // incluye repeats
tl.time(1.2);              // segundos
tl.timeScale(2);           // velocidad; 0.5 = cámara lenta
gsap.to(tl, { timeScale: 0, duration: 1 }); // frenar suavemente
tl.reversed(true);
tl.isActive();
tl.kill();

gsap.killTweensOf('.box');          // todos los tweens del target
gsap.killTweensOf('.box', 'x,y');   // solo props concretas
gsap.getTweensOf('.box');
gsap.getById('intro');
gsap.globalTimeline.pause();        // pausa global (debug)
gsap.exportRoot();                  // envuelve todo lo actual en una timeline
```

## 12. Callbacks y eventos

```js
gsap.to('.x', {
  x: 100,
  onStart, onUpdate, onComplete, onRepeat, onReverseComplete, onInterrupt,
  callbackScope: this,
  onCompleteParams: ['arg'],
  onUpdate() {
    this.progress();  // `this` es el tween (si no se usa arrow function)
    this.targets()[0];
    this.ratio;       // valor tras ease
  },
});

tl.eventCallback('onComplete', fn); // getter/setter posterior
```

Promesas: `await gsap.to(...)` funciona (`.then()` devuelve la promesa del tween/timeline). Útil en hooks de transición de Vue/React.

```js
await gsap.to('.modal', { autoAlpha: 0, duration: 0.25 });
modal.remove();
```

## 13. Ticker y frame loop

```js
gsap.ticker.add((time, deltaTime, frame) => { /* ... */ });
gsap.ticker.remove(fn);
gsap.ticker.fps(60);
gsap.ticker.lagSmoothing(0); // desactivar al integrar con Lenis
```

## 14. Plugins incluidos (registro)

| Plugin | Uso |
|---|---|
| `ScrollTrigger` | Animaciones ligadas al scroll |
| `ScrollSmoother` | Smooth scroll nativo de GSAP (alternativa a Lenis) |
| `SplitText` | Divide texto en chars/words/lines; `autoSplit`, `mask` |
| `Flip` | Transiciones de layout (FLIP) |
| `Draggable` + `InertiaPlugin` | Drag & drop con inercia |
| `MorphSVGPlugin` | Morph entre paths |
| `DrawSVGPlugin` | Dibujo de trazos |
| `MotionPathPlugin` | Movimiento a lo largo de un path |
| `Observer` | Eventos unificados de scroll/touch/pointer |
| `TextPlugin`, `ScrambleTextPlugin` | Texto |
| `CustomEase`, `CustomBounce`, `CustomWiggle` | Easings |
| `Physics2D`, `PhysicsProps` | Física simple |
| `GSDevTools` | Timeline scrubber para debug |

Ejemplo SplitText moderno:

```js
document.fonts.ready.then(() => {
  const split = SplitText.create('.headline', {
    type: 'lines,words',
    mask: 'lines',          // envuelve cada línea en un overflow:hidden
    linesClass: 'line',
    autoSplit: true,        // re-split en resize
    onSplit(self) {
      return gsap.from(self.words, { yPercent: 100, autoAlpha: 0, stagger: 0.03 });
    },
  });
});
```

Ejemplo Flip:

```js
import { Flip } from 'gsap/Flip';
const state = Flip.getState('.card');
container.classList.toggle('grid'); // cambiar layout
Flip.from(state, { duration: 0.6, ease: 'power2.inOut', stagger: 0.03, absolute: true });
```
