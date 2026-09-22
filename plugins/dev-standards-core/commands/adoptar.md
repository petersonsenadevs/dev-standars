---
description: Adoptar las convenciones de un proyecto existente y sellarlas como regla inmutable
argument-hint: [notas opcionales, p. ej. "solo backend" o "el idioma oficial es inglés"]
---

Aplica `code-quality §references/adopt-conventions.md` paso a paso ($ARGUMENTS):

1. **Analiza con evidencia**: configs (.editorconfig, linters, tsconfig, pint), 3–5 archivos por capa
   (los más recientes), tests y `git log --oneline -30`. Notas con ejemplos literales archivo:línea.
2. **Entrevista corta** (máx. 5 preguntas, solo lo ambiguo, cada una con propuesta por defecto).
3. **Escribe `conventions.md`** (humano: regla + ejemplo real por sección) y **`conventions.json`**
   (3–8 reglas ejecutables sin falsos positivos para el hook conventions-guard), ambos en la raíz y
   con el sello `dev-standards:inmutable` (§4 de la referencia tiene el esquema exacto).
4. Enséñale al usuario el resumen de lo adoptado y las reglas ejecutables ANTES de sellar; con su ok,
   guarda y anota en el devlog qué se adoptó y qué quedó pendiente de decidir.

Desde ese momento: las convenciones GANAN a tus preferencias (los muros de seguridad siguen aplicando),
el hook bloquea violaciones introducidas, y los archivos quedan protegidos. Cambiarlas = decisión
explícita del usuario → borrar ambos y re-ejecutar `/adoptar`.
