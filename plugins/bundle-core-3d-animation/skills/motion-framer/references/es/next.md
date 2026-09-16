# Motion en Next.js 16 (App Router)

Índice: 1 instalación y Server Components · 2 transiciones de página · 3 listas con stagger · 4 modales con
AnimatePresence · 5 scroll-linked · 6 shadcn/ui · 7 reduced motion y bundle · 8 pitfalls SSR/hydration.

## 1. Instalación y Server Components

```bash
npm i motion
```

```tsx
// components/motion.tsx  — único punto de importación (re-export cliente)
"use client";
export { motion, AnimatePresence, LazyMotion, domAnimation, m, MotionConfig, useReducedMotion, useScroll, useTransform, useSpring } from "motion/react";
```

- `motion/react` es el paquete actual; `framer-motion` (nombre que usa el upstream) tiene la misma API.
- `motion.*` y los hooks exigen `"use client"`. Un Server Component puede renderizar un Client Component animado y
  pasarle `children` de servidor: animar no obliga a mover el fetch al cliente.

## 2. Transiciones de página con `template.tsx`

`template.tsx` se remonta en cada navegación (a diferencia de `layout.tsx`): la entrada se repite en cada ruta hija.

```tsx
// app/(marketing)/template.tsx
"use client";
import { motion, useReducedMotion } from "@/components/motion";

export default function Template({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}
```

- Salida entre rutas exige `AnimatePresence` + `key={pathname}` en un layout cliente y retrasa la navegación; solo en
  landings narrativas. Para apps: entrada sin salida, o View Transitions (`experimental.viewTransition`) para cross-fades.

## 3. Listas con stagger

```tsx
"use client";
import { motion, useReducedMotion } from "@/components/motion";

const list = { hidden: {}, visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

export function FeatureGrid({ features }: { features: Feature[] }) {
  const reduce = useReducedMotion();
  return (
    <motion.ul variants={list} initial={reduce ? false : "hidden"} whileInView="visible" viewport={{ once: true, amount: 0.25 }} className="grid gap-6 md:grid-cols-3">
      {features.map((f) => (
        <motion.li key={f.id} variants={item} className="rounded-lg border border-border bg-surface p-6">{f.title}</motion.li>
      ))}
    </motion.ul>
  );
}
```

## 4. Modal con AnimatePresence (y shadcn Dialog)

Con shadcn/ui, Radix ya gestiona foco, `Esc`, `aria-modal` y `data-state`; la salida la cubre `tw-animate-css`
(`animate-in`/`animate-out`). Usa Motion solo cuando el diseño pide física o coreografía que CSS no cubre:

```tsx
"use client";
import { AnimatePresence, motion } from "@/components/motion";
import * as Dialog from "@radix-ui/react-dialog";

export function SpringDialog({ open, onOpenChange, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 bg-black/50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild aria-describedby={undefined}>
              <motion.div
                className="fixed left-1/2 top-1/2 w-[min(90vw,32rem)] rounded-xl bg-surface p-6"
                style={{ x: "-50%", y: "-50%" }}
                initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              >
                {children}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

`forceMount` + `AnimatePresence` es obligatorio para que Radix no desmonte antes de la salida. El centrado va en
`style={{ x, y }}` de Motion, no en `-translate-x-1/2` de Tailwind: ambos escriben `transform` y se pisan.

## 5. Scroll-linked: `useScroll` + `useTransform`

```tsx
"use client";
import { useRef } from "react";
import { motion, useScroll, useTransform, useSpring, useReducedMotion } from "@/components/motion";

export function ParallaxHero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const y = useSpring(useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -120]), { stiffness: 120, damping: 24 });
  const opacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
  return (
    <section ref={ref} className="relative h-[90vh] overflow-hidden">
      <motion.img style={{ y }} src="/hero.webp" alt="" className="absolute inset-0 size-full object-cover" />
      <motion.div style={{ opacity }} className="relative z-10">…</motion.div>
    </section>
  );
}
```

Si hacen falta pin, scrub con timeline o snap, pasa a `gsap-scrolltrigger` (nunca ambos sobre el mismo nodo).

## 6. shadcn/ui

- No edites `components/ui/*`: envuelve (`<motion.div>` alrededor de `<Card>`) o usa `asChild` en Radix.
- Botones: `const MotionButton = motion.create(Button)`; el componente debe reenviar `ref`.

## 7. Reduced motion y bundle

- `useReducedMotion()` devuelve `null` en SSR y el valor real tras hidratar; por eso `initial={reduce ? false : …}`.
  Alternativa global: `<MotionConfig reducedMotion="user">` en el layout cliente (desactiva transform, conserva opacidad).
- Bundle: en marketing, `<LazyMotion features={domAnimation} strict>` + componentes `m.*` (≈ 5 kB frente a ≈ 34 kB);
  `domMax` solo si hay `drag` o `layout`. `MotionConfig` y `LazyMotion` una sola vez, en el layout cliente.

## 8. Pitfalls SSR / hydration

| Síntoma | Causa | Solución |
|---|---|---|
| Flash del estado `initial` al cargar | El HTML SSR trae el estado final; `initial` se aplica tras hidratar | `initial={false}` above-the-fold; en el resto, `whileInView` + `once` |
| Contenido invisible sin JS | `initial={{ opacity: 0 }}` en SSR | Solo en secciones bajo el fold; hero sin `initial` de opacidad |
| `Text content did not match` | `window`/`Math.random` en props de motion | Calcular en `useEffect` o pasar desde Server Component |
| Salida no se anima | Falta `AnimatePresence`, `key` cambia o Radix desmonta | `AnimatePresence` + `key` estable + `forceMount` |
| `layoutId` salta entre rutas | Los dos elementos no coexisten en un `AnimatePresence` común | Misma ruta; entre rutas, View Transitions |
| Scroll-linked tiembla en móvil | Sin `useSpring` o mapeado a `top` | `useSpring` + `y`/`scale`, nunca propiedades de layout |
