# GSAP + Three.js: animación de cámara, objetos, uniforms y scroll

GSAP anima cualquier propiedad numérica de un objeto, así que `mesh.position`, `mesh.rotation`, `material.uniforms.uTime` o `camera.fov` son objetivos válidos sin adaptadores. Three no necesita saber que GSAP existe: el loop de render simplemente pinta el estado actual cada frame.

```bash
pnpm add gsap
# React: pnpm add @gsap/react
```

```ts
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
```

## 1. Animar posición, rotación, escala y uniforms

```ts
// Rotación: objetivo es el Euler, propiedades x/y/z en radianes
gsap.to(mesh.rotation, { y: Math.PI * 2, duration: 4, ease: 'none', repeat: -1 });

// Posición con ease
gsap.to(mesh.position, { x: 2, y: 0.5, duration: 1.2, ease: 'power3.out' });

// Escala: THREE.Vector3, no un número
gsap.fromTo(mesh.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(1.7)' });

// Uniform: anima .value
gsap.to(material.uniforms.uHover, { value: 1, duration: 0.6, ease: 'power2.out', overwrite: true });

// Color: THREE.Color tiene r/g/b en lineal; anima esos canales
const target = new THREE.Color('#f472b6');
gsap.to(material.color, { r: target.r, g: target.g, b: target.b, duration: 1 });

// Propiedades de material
gsap.to(material, { opacity: 0, roughness: 1, duration: 0.5 });

// fov requiere updateProjectionMatrix en cada paso
gsap.to(camera, { fov: 35, duration: 1, onUpdate: () => camera.updateProjectionMatrix() });
```

- `overwrite: true` (o `'auto'`) en tweens de hover para que entrar/salir rápido no acumule tweens contradictorios.
- GSAP tickea con su propio `requestAnimationFrame`. Con `renderer.setAnimationLoop` ambos coinciden en el mismo frame; no hace falta sincronizar. Si tu render es bajo demanda, llama a `invalidate()`/`render()` en `onUpdate`.
- Para animar muchas instancias (`InstancedMesh`), anima un array de objetos `{ x, y, z }` y escribe las matrices en `onUpdate` (un solo tween con `stagger`).
- `gsap.ticker.add(fn)` puede sustituir al loop de Three si prefieres un único ticker: `gsap.ticker.add((time, deltaTimeMs) => { controls.update(); renderer.render(scene, camera); })` y `gsap.ticker.lagSmoothing(0)` cuando uses ScrollTrigger + Lenis.

## 2. Cámara: mover y mirar

`camera.lookAt` no es una propiedad sino una acción; hay que ejecutarla en cada frame del tween o animar un `Vector3` intermedio que la cámara mira.

```ts
const lookTarget = new THREE.Vector3(0, 0.5, 0);

export function flyTo(position: THREE.Vector3Like, target: THREE.Vector3Like, duration = 1.5) {
  controls.enabled = false; // OrbitControls pelea con el tween; desactívalo
  const tl = gsap.timeline({
    defaults: { duration, ease: 'power2.inOut' },
    onUpdate: () => camera.lookAt(lookTarget),
    onComplete: () => {
      controls.target.copy(lookTarget);  // resincroniza OrbitControls al destino
      controls.update();
      controls.enabled = true;
    },
  });
  tl.to(camera.position, { x: position.x, y: position.y, z: position.z }, 0);
  tl.to(lookTarget, { x: target.x, y: target.y, z: target.z }, 0);
  return tl;
}
```

Alternativa cuando `OrbitControls` debe seguir activo: anima `controls.target` y `camera.position` a la vez y llama a `controls.update()` en `onUpdate` (sin `lookAt` manual; OrbitControls ya orienta la cámara hacia `target`). Para rotaciones de cámara sin gimbal lock, anima un `Quaternion` con `slerp` en `onUpdate` sobre un progreso `{ t: 0 }` → `{ t: 1 }`.

Trayectorias curvas: `new THREE.CatmullRomCurve3(points)` y `curve.getPointAt(progress)` en `onUpdate` de un tween sobre `{ progress: 0 }`.

## 3. Scroll-driven 3D con ScrollTrigger (scrub)

Layout: la sección tiene altura N x 100vh; el canvas es `position: sticky; top: 0; height: 100vh` dentro (o `fixed` en toda la página). El scroll del documento es el nativo; ScrollTrigger mapea progreso → timeline.

```html
<section class="story" data-story>
  <div class="story__sticky"><canvas data-story-canvas></canvas></div>
  <div class="story__steps">
    <article class="step" data-step="intro">...</article>
    <article class="step" data-step="detail">...</article>
    <article class="step" data-step="outro">...</article>
  </div>
</section>
```

```css
.story { position: relative; }
.story__sticky { position: sticky; top: 0; height: 100vh; }
.story__steps { position: relative; z-index: 1; margin-top: -100vh; }
.step { min-height: 100vh; display: grid; place-items: center; }
```

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: '[data-story]',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1,               // número = segundos de suavizado; true = sin suavizado
    invalidateOnRefresh: true,
    // markers: import.meta.env.DEV,
  },
  defaults: { ease: 'none' }, // con scrub, el ease lo aporta el scroll; 'none' evita dobles curvas
  onUpdate: () => camera.lookAt(lookTarget),
});

tl.addLabel('intro')
  .to(camera.position, { x: 0, y: 1.2, z: 5 }, 'intro')
  .to(lookTarget, { x: 0, y: 0.5, z: 0 }, 'intro')
  .addLabel('detail', '+=1')
  .to(camera.position, { x: 2.5, y: 0.6, z: 2 }, 'detail')
  .to(lookTarget, { x: 0.4, y: 0.6, z: 0 }, 'detail')
  .to(model.rotation, { y: Math.PI * 0.5 }, 'detail')
  .to(material.uniforms.uReveal, { value: 1 }, 'detail')
  .addLabel('outro', '+=1')
  .to(camera.position, { x: -1, y: 2.5, z: 4 }, 'outro')
  .to(lookTarget, { x: 0, y: 0, z: 0 }, 'outro');
```

- Con `scrub` la duración de cada tween es relativa: 1 s de timeline = 1/total del scroll. Usa labels y posiciones (`'+=1'`) para repartir la barra.
- `ScrollTrigger.refresh()` tras cargar el modelo o cambiar el layout (imágenes, fuentes). Con `invalidateOnRefresh` los valores `from` se recalculan.
- Al hacer resize, el aspect de la cámara cambia (tu handler) pero la posición la fija el timeline: no hay conflicto. Si el encuadre debe depender del ancho (móvil), calcula los valores como funciones: `z: () => (isMobile() ? 7 : 5)` con `invalidateOnRefresh: true`.
- Con `prefers-reduced-motion`, sustituye `scrub` por `toggleActions` y estados discretos (`tl.tweenTo('detail')` al entrar cada sección) o simplemente reduce a un fade.
- No uses `pin: true` sobre el canvas si `position: sticky` funciona; el pin de GSAP reparenta y hace cálculos que a veces rompen el `ResizeObserver` del canvas. Si necesitas `pin`, aplícalo al contenedor `.story__sticky` y `pinSpacing: false`.
- Lenis: `lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);`.

### Escena en `fixed` a página completa

Si el canvas es `position: fixed; inset: 0; z-index: -1` bajo todo el contenido, un único timeline con `trigger: document.body`, `start: 'top top'`, `end: 'bottom bottom'` recorre toda la página. Los estados se colocan con labels en proporción a la posición de cada sección: `tl.addLabel('features', featuresEl.offsetTop / (document.body.scrollHeight - innerHeight) * tl.duration())` o, más robusto, un ScrollTrigger por sección con `onEnter`/`onEnterBack` que hace `gsap.to(camera.position, stateFor(section))` (transiciones discretas, sin scrub).

## 4. Sincronizar secciones HTML con estados de cámara (discreto)

Cuando el contenido son bloques que se leen (no un recorrido continuo), un estado por sección con transición suave es más legible y accesible que el scrub:

```ts
type CamState = { position: [number, number, number]; target: [number, number, number]; fov?: number };
const states: Record<string, CamState> = {
  intro: { position: [0, 1.2, 5], target: [0, 0.5, 0] },
  detail: { position: [2.5, 0.6, 2], target: [0.4, 0.6, 0], fov: 35 },
  outro: { position: [-1, 2.5, 4], target: [0, 0, 0] },
};

let current: gsap.core.Timeline | null = null;

function goTo(name: string) {
  const s = states[name];
  current?.kill();
  current = gsap.timeline({ defaults: { duration: 1.2, ease: 'power2.inOut' }, onUpdate: () => camera.lookAt(lookTarget) })
    .to(camera.position, { x: s.position[0], y: s.position[1], z: s.position[2] }, 0)
    .to(lookTarget, { x: s.target[0], y: s.target[1], z: s.target[2] }, 0);
  if (s.fov) current.to(camera, { fov: s.fov, onUpdate: () => camera.updateProjectionMatrix() }, 0);
}

document.querySelectorAll<HTMLElement>('[data-step]').forEach((el) => {
  ScrollTrigger.create({
    trigger: el,
    start: 'top center',
    end: 'bottom center',
    onEnter: () => goTo(el.dataset.step!),
    onEnterBack: () => goTo(el.dataset.step!),
  });
});
```

Acoplar el HTML: en el mismo trigger anima la opacidad/translación del `article` (`gsap.from(el, { autoAlpha: 0, y: 40 })`) para que texto y cámara se muevan juntos. `current?.kill()` evita solapamientos si el usuario hace scroll rápido.

## 5. Integración por framework

### Vanilla / Astro

Crea los triggers en `init()` de la clase Scene y guarda el `ScrollTrigger`/timeline para matarlo en `dispose()`: `tl.scrollTrigger?.kill(); tl.kill();` o `ScrollTrigger.getAll().forEach((t) => t.kill())` si la página entera se va (View Transitions: en `astro:before-swap`). Tras montar una nueva página llama a `ScrollTrigger.refresh()`.

### Vue / TresJS

```ts
import { onMounted, onBeforeUnmount } from 'vue';
let ctx: gsap.Context;
onMounted(() => {
  ctx = gsap.context(() => {
    // tweens y ScrollTriggers aquí; usan refs (shallowRef) a objetos Three
  });
});
onBeforeUnmount(() => ctx.revert()); // mata todo lo creado dentro del context
```

En TresJS los objetos existen tras el mount del hijo; usa `shallowRef` + `watch(ref, (obj) => { if (obj) setup(obj) }, { immediate: true })` o el evento `@ready` del canvas. Con Inertia, `ctx.revert()` en `onBeforeUnmount` es suficiente al navegar.

### React / R3F

```tsx
import { useGSAP } from '@gsap/react';
gsap.registerPlugin(useGSAP, ScrollTrigger);

function CameraRig({ sectionRef }) {
  const { camera, invalidate } = useThree();
  const lookTarget = useRef(new THREE.Vector3(0, 0.5, 0));

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom bottom', scrub: 1 },
      defaults: { ease: 'none' },
      onUpdate: () => { camera.lookAt(lookTarget.current); invalidate(); },
    });
    tl.to(camera.position, { x: 2.5, y: 0.6, z: 2 }).to(lookTarget.current, { x: 0.4, y: 0.6, z: 0 }, '<');
  }, { dependencies: [camera], scope: sectionRef }); // useGSAP hace revert automático al desmontar
  return null;
}
```

`useGSAP` sustituye a `useLayoutEffect` + `gsap.context` y limpia al desmontar. El `sectionRef` debe apuntar a un elemento del DOM fuera del `<Canvas>` (el trigger es HTML, no un objeto 3D).

## 6. Recetas cortas

- **Aparición del modelo al cargar**: `gsap.from(model.scale, { x: 0, y: 0, z: 0, duration: 1, ease: 'expo.out' })` + `gsap.from(model.rotation, { y: -Math.PI, duration: 1.4, ease: 'power3.out' }, '<')` disparado en `manager.onLoad`.
- **Parallax de ratón**: guarda `target = { x, y }` en `pointermove` y `gsap.quickTo(camera.position, 'x', { duration: 0.8, ease: 'power3' })` para tweens de alta frecuencia sin crear objetos.
- **Explode/assemble de partes de un GLTF**: guarda `originalPos` en `userData` al cargar; `gsap.to(part.position, { ...originalPos.clone().multiplyScalar(2), stagger: 0.03 })`.
- **Cambiar de material con fade**: anima `opacity` de A a 0 (transparent true) y `opacity` de B a 1 con dos meshes superpuestos; o un uniform `uMix` en un shader que mezcle ambos.
- **Snap por secciones**: `scrollTrigger.snap: { snapTo: 'labels', duration: { min: 0.2, max: 0.6 }, ease: 'power1.inOut' }` con las labels del timeline.
- **Rotación continua + tween puntual**: usa un `Group` exterior para la rotación continua del loop y anima el mesh interior con GSAP; así no pelean por `rotation.y`.
