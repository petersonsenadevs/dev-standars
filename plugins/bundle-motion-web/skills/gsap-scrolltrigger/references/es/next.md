# GSAP con React y Next.js (App Router)

## 1. Instalación y registro

```bash
npm i gsap @gsap/react
```

`lib/gsap.ts` — único módulo de registro:

```ts
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);
  gsap.defaults({ ease: 'power2.out', duration: 0.6 });
}

export { gsap, useGSAP, ScrollTrigger, SplitText };
```

`useGSAP` también se registra como plugin: evita warnings y garantiza compatibilidad de versiones.

## 2. `useGSAP`

Hook oficial. Es un `useLayoutEffect` (o `useEffect` en SSR) que envuelve el callback en `gsap.context()` y lo revierte automáticamente en cleanup, incluido StrictMode (doble montaje en dev).

```tsx
'use client';

import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

export function Cards({ items }: { items: Item[] }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // '.card' con scope: solo dentro de container
      gsap.from('.card', { y: 30, autoAlpha: 0, stagger: 0.08, scrollTrigger: { trigger: '.card', start: 'top 85%' } });
    },
    { scope: container, dependencies: [items] }, // re-ejecuta (y revierte antes) cuando cambian
  );

  return (
    <div ref={container}>
      {items.map((it) => <article key={it.id} className="card">{it.title}</article>)}
    </div>
  );
}
```

Opciones:

| Opción | Descripción |
|---|---|
| `scope` | Ref del contenedor; los selectores de string se limitan a él |
| `dependencies` | Array; por defecto `[]` (solo en mount). Con `revertOnUpdate: false` (defecto) al cambiar deps NO se revierte el contexto anterior, solo se vuelve a ejecutar el callback. Ponlo en `true` para revertir y recrear |
| `revertOnUpdate` | `true` para revertir todo en cada cambio de deps |

Forma corta: `useGSAP(fn, [dep1, dep2])`.

## 3. `contextSafe`

Las animaciones creadas fuera del callback de `useGSAP` (event handlers, timeouts, callbacks async) no pertenecen al contexto y no se limpian. `contextSafe` envuelve funciones para que sí lo hagan y respeten el `scope`.

```tsx
const { contextSafe } = useGSAP({ scope: container });

const onEnter = contextSafe((e: React.PointerEvent<HTMLElement>) => {
  gsap.to(e.currentTarget, { scale: 1.05, duration: 0.2, overwrite: 'auto' });
});
const onLeave = contextSafe((e: React.PointerEvent<HTMLElement>) => {
  gsap.to(e.currentTarget, { scale: 1, duration: 0.2, overwrite: 'auto' });
});

return <button onPointerEnter={onEnter} onPointerLeave={onLeave}>Hover</button>;
```

Dentro del callback también está disponible como segundo argumento: `useGSAP((context, contextSafe) => { ... })`. Los listeners añadidos manualmente con `addEventListener` deben quitarse en la función de retorno del callback.

```tsx
useGSAP((_, contextSafe) => {
  const onClick = contextSafe!(() => gsap.to('.box', { rotation: '+=360' }));
  btnRef.current!.addEventListener('click', onClick);
  return () => btnRef.current?.removeEventListener('click', onClick);
}, { scope: container });
```

## 4. Timelines controladas por estado

Crear la timeline una vez (en `useGSAP`), guardarla en un ref y controlarla en efectos:

```tsx
const tl = useRef<gsap.core.Timeline>();
const [open, setOpen] = useState(false);

useGSAP(() => {
  tl.current = gsap.timeline({ paused: true })
    .to('.menu', { xPercent: 0, duration: 0.4, ease: 'power3.out' })
    .from('.menu a', { x: 20, autoAlpha: 0, stagger: 0.05 }, '-=0.2');
}, { scope: container });

useGSAP(() => {
  open ? tl.current?.play() : tl.current?.reverse();
}, [open]);
```

`useGSAP` con deps también es válido para reaccionar a estado sin recrear la timeline (no ponerla como dependencia del primer hook).

## 5. Next.js App Router

- Los componentes que usan GSAP deben ser Client Components (`'use client'`) porque tocan el DOM y usan hooks.
- Los Server Components pueden renderizar el marcado y pasar datos; el wrapper de animación es cliente.
- `useGSAP` ya usa `useIsomorphicLayoutEffect`, así que no hay warnings de `useLayoutEffect` en SSR.
- El registro de plugins en `lib/gsap.ts` está protegido con `typeof window`.

Estructura recomendada:

```
app/page.tsx              (server) -> importa <Hero/> y <Cards items={...}/>
components/Hero.tsx       'use client' + useGSAP
components/ScrollReveal.tsx 'use client' wrapper genérico
```

Wrapper genérico:

```tsx
'use client';
import { useRef, type ReactNode } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

type Props = { children: ReactNode; y?: number; delay?: number; once?: boolean; className?: string };

export function ScrollReveal({ children, y = 32, delay = 0, once = true, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.fromTo(ref.current, { y, autoAlpha: 0 }, {
        y: 0, autoAlpha: 1, duration: 0.7, delay, ease: 'power3.out',
        scrollTrigger: { trigger: ref.current, start: 'top 85%', once, toggleActions: 'play none none reverse' },
      });
    });
  }, { scope: ref });

  return <div ref={ref} className={className} style={{ visibility: 'hidden' }}>{children}</div>;
}
```

`style={{ visibility: 'hidden' }}` inicial evita el flash en hidratación; `autoAlpha: 1` lo sobrescribe. Con `prefers-reduced-motion` el wrapper queda oculto: añade un `mm.add('(prefers-reduced-motion: reduce)', () => gsap.set(ref.current, { clearProps: 'all' }))` o usa una clase CSS que solo oculte cuando no hay reduce.

## 6. ScrollTrigger y rutas de Next

Cada navegación desmonta la página anterior y `useGSAP` revierte sus ScrollTriggers; los del layout (`app/layout.tsx` -> componentes cliente) persisten. Lo que falta es recalcular tras el cambio de contenido y la restauración de scroll.

```tsx
// components/ScrollTriggerRefresh.tsx
'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ScrollTrigger } from '@/lib/gsap';

export function ScrollTriggerRefresh() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname, search]);

  return null;
}
```

Montarlo una vez en `app/layout.tsx` (envuelto en `<Suspense>` por `useSearchParams`). Para páginas con imágenes que cargan tarde: `ScrollTrigger.refresh()` en `onLoad` de las imágenes críticas o usar `next/image` con `width/height` para reservar espacio.

Transiciones de página en App Router: no hay hook de salida nativo. Opciones: View Transitions API (`next.config` `experimental.viewTransition`), `template.tsx` (se remonta en cada navegación, útil para animación de entrada con `useGSAP`), o una capa de overlay que se anima con `router.push` diferido.

```tsx
// app/template.tsx — se vuelve a montar en cada ruta: intro de página
'use client';
import { useRef } from 'react';
import { gsap, useGSAP } from '@/lib/gsap';

export default function Template({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    gsap.fromTo(ref.current, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.4, clearProps: 'transform' });
  }, { scope: ref });
  return <div ref={ref}>{children}</div>;
}
```

## 7. Lenis con React

```bash
npm i lenis
```

`lenis/react` provee `ReactLenis`. Integración con el ticker de GSAP:

```tsx
// components/SmoothScroll.tsx
'use client';
import { ReactLenis, useLenis } from 'lenis/react';
import { useEffect, useRef } from 'react';
import type Lenis from 'lenis';
import { gsap, ScrollTrigger } from '@/lib/gsap';

export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<{ lenis?: Lenis }>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const update = (time: number) => lenisRef.current?.lenis?.raf(time * 1000);
    gsap.ticker.add(update);
    gsap.ticker.lagSmoothing(0);
    lenisRef.current?.lenis?.on('scroll', ScrollTrigger.update);
    return () => {
      gsap.ticker.remove(update);
      lenisRef.current?.lenis?.off('scroll', ScrollTrigger.update);
    };
  }, []);

  return (
    <ReactLenis root ref={lenisRef} options={{ lerp: 0.1, autoRaf: false }}>
      {children}
    </ReactLenis>
  );
}
```

`autoRaf: false` porque el raf lo dirige GSAP. Colocar `<SmoothScroll>` en `app/layout.tsx` envolviendo `{children}`. Para scroll programático desde componentes: `const lenis = useLenis(); lenis?.scrollTo('#id')`. Tras navegación: `lenis?.scrollTo(0, { immediate: true })` en el `ScrollTriggerRefresh`.

## 8. StrictMode y HMR

- StrictMode monta, desmonta y vuelve a montar en dev: `useGSAP` revierte en el desmontaje intermedio y recrea, por lo que los `from()` no se duplican. Si ves elementos invisibles en dev, es que hay animaciones fuera del contexto (usar `contextSafe`).
- Fast Refresh preserva estado del componente; las animaciones creadas en `useGSAP` sí se recrean porque el hook re-ejecuta al cambiar el archivo.

## 9. Testing

En Jest/Vitest con jsdom GSAP funciona pero sin layout real. Mockear `gsap.matchMedia` y `ScrollTrigger` si dan problemas, o usar `gsap.globalTimeline.timeScale(1000)` para acelerar. `window.matchMedia` debe mockearse en jsdom.

## 10. Checklist

- `'use client'` en todo componente que use `useGSAP`.
- Registro de plugins (incluido `useGSAP`) en un módulo con guard `typeof window`.
- `scope` siempre; `dependencies` solo cuando el DOM animado depende de props/estado.
- Handlers con `contextSafe`.
- `ScrollTrigger.refresh()` en cambio de `pathname`.
- Lenis con `autoRaf: false` dirigido por `gsap.ticker`, desactivado con reduced motion.
- Estado inicial oculto inline o vía CSS para evitar flash de hidratación.
