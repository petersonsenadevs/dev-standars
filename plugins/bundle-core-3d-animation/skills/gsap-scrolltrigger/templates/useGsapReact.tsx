/**
 * Ejemplos React / Next.js (App Router) con @gsap/react.
 *
 * npm i gsap @gsap/react
 *
 * lib/gsap.ts debe exportar { gsap, useGSAP, ScrollTrigger } registrados bajo guard `typeof window`.
 */
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { gsap, useGSAP, ScrollTrigger } from '@/lib/gsap';

/* -------------------------------------------------------------------------- */
/* 1. ScrollReveal genérico                                                    */
/* -------------------------------------------------------------------------- */

type RevealProps = {
  children: ReactNode;
  y?: number;
  stagger?: number; // > 0 anima hijos directos
  once?: boolean;
  start?: string;
  className?: string;
};

export function ScrollReveal({ children, y = 32, stagger = 0, once = true, start = 'top 85%', className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current!;
      const targets = stagger > 0 ? Array.from(el.children) : el;
      const mm = gsap.matchMedia();

      mm.add('(prefers-reduced-motion: reduce)', () => {
        gsap.set([el, ...Array.from(el.children)], { clearProps: 'all', visibility: 'visible' });
      });

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        if (stagger > 0) gsap.set(el, { visibility: 'visible' });
        gsap.fromTo(
          targets,
          { y, autoAlpha: 0 },
          {
            y: 0,
            autoAlpha: 1,
            duration: 0.7,
            ease: 'power3.out',
            stagger,
            clearProps: 'transform',
            scrollTrigger: { trigger: el, start, once, toggleActions: once ? 'play none none none' : 'play none none reverse' },
          },
        );
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className={className} style={{ visibility: 'hidden' }}>
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Timeline controlada por estado + contextSafe en handlers                 */
/* -------------------------------------------------------------------------- */

export function Menu({ links }: { links: { href: string; label: string }[] }) {
  const container = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const [open, setOpen] = useState(false);

  const { contextSafe } = useGSAP(
    () => {
      tl.current = gsap
        .timeline({ paused: true, defaults: { ease: 'power3.out' } })
        .fromTo('.menu', { xPercent: 100 }, { xPercent: 0, duration: 0.4 })
        .from('.menu a', { x: 24, autoAlpha: 0, stagger: 0.05, duration: 0.3 }, '-=0.2');
    },
    { scope: container },
  );

  // reacciona al estado sin recrear la timeline
  useGSAP(() => {
    open ? tl.current?.play() : tl.current?.reverse();
  }, [open]);

  const onHover = contextSafe((e: React.PointerEvent<HTMLAnchorElement>) => {
    gsap.to(e.currentTarget, { x: 6, duration: 0.2, overwrite: 'auto' });
  });
  const onLeave = contextSafe((e: React.PointerEvent<HTMLAnchorElement>) => {
    gsap.to(e.currentTarget, { x: 0, duration: 0.2, overwrite: 'auto' });
  });

  return (
    <div ref={container}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="site-menu">
        Menu
      </button>
      <nav id="site-menu" className="menu" aria-hidden={!open}>
        {links.map((l) => (
          <a key={l.href} href={l.href} onPointerEnter={onHover} onPointerLeave={onLeave}>
            {l.label}
          </a>
        ))}
      </nav>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Lista que depende de props: dependencies + revertOnUpdate                */
/* -------------------------------------------------------------------------- */

export function Cards({ items }: { items: { id: string; title: string }[] }) {
  const container = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      ScrollTrigger.batch('.card', {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, autoAlpha: 1, stagger: 0.08, duration: 0.6, overwrite: true }),
      });
      gsap.set('.card', { y: 40, autoAlpha: 0 });
    },
    { scope: container, dependencies: [items], revertOnUpdate: true },
  );

  return (
    <div ref={container} className="grid">
      {items.map((it) => (
        <article key={it.id} className="card">
          {it.title}
        </article>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4. Refresh de ScrollTrigger al cambiar de ruta (montar una vez en layout)   */
/* -------------------------------------------------------------------------- */

export function ScrollTriggerRefresh() {
  const pathname = usePathname();
  useEffect(() => {
    const id = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(id);
  }, [pathname]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* 5. Cursor follower con quickTo (alta frecuencia)                            */
/* -------------------------------------------------------------------------- */

export function CursorFollower() {
  const dot = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (window.matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches) return;

    const xTo = gsap.quickTo(dot.current, 'x', { duration: 0.35, ease: 'power3' });
    const yTo = gsap.quickTo(dot.current, 'y', { duration: 0.35, ease: 'power3' });
    const move = (e: PointerEvent) => {
      xTo(e.clientX);
      yTo(e.clientY);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  });

  return <div ref={dot} className="cursor" aria-hidden style={{ position: 'fixed', top: 0, left: 0, pointerEvents: 'none' }} />;
}
