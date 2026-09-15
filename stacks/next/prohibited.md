# Prohibiciones específicas — Next.js + TS

Además de las globales (`core/methodology/prohibited-actions.md`):

- Exponer secretos de servidor al cliente (variables sin `NEXT_PUBLIC_` que acaben en componentes cliente).
- `prisma migrate reset`, `drizzle-kit push --force` sobre BD con datos — aprobación explícita.
- Desactivar `strict` de TypeScript o silenciar errores con `// @ts-ignore` masivo.
- `next build` con `ignoreBuildErrors` / `eslint.ignoreDuringBuilds` para "hacer pasar" el CI.
- Borrar migraciones de Prisma/Drizzle ya aplicadas.
