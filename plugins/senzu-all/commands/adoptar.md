---
description: Adoptar las convenciones de un proyecto existente y sellarlas como regla inmutable
---

Uso: `/adoptar [notas opcionales, p. ej. "solo backend" o "el idioma oficial es inglés"]` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `code-quality §references/adopt-conventions.md` paso a paso (lo que el usuario escribió tras el comando):

0. **Mira si hay algo que analizar**: si el proyecto está vacío o recién creado (sin código fuente real),
   NO inventes evidencia — pasa al **modo entrevista** (§7 de la referencia): 5–7 preguntas con propuesta
   por defecto (idioma del código, naming, validación, CSS, tests) y el mismo resultado sellado. El resto
   de pasos aplican igual desde el 3.
1. **Analiza con evidencia**: configs (.editorconfig, linters, tsconfig, pint), 3–5 archivos por capa
   (los más recientes), tests y `git log --oneline -30`. Notas con ejemplos literales archivo:línea.
2. **Entrevista corta** (máx. 5 preguntas, solo lo ambiguo, cada una con propuesta por defecto).
3. **Escribe `senzu/conventions.md`** (humano: regla + ejemplo real por sección) y **`senzu/conventions.json`**
   (3–8 reglas ejecutables sin falsos positivos para el hook conventions-guard), ambos en la raíz y
   con el sello `senzu:inmutable` (§4 de la referencia tiene el esquema exacto).
3b. **Reglas de arquitectura** (backend): propón 3-5 reglas de capas adaptadas a la estructura REAL
   (`backend-audit §references/reglas-arquitectura.md`) como tests de arquitectura (Pest, ArchUnit,
   NetArchTest) o configuración de Deptrac / dependency-cruiser / import-linter. Con el ok del usuario
   se crean, y `/verificar` las comprueba en cada cierre de tarea.
4. Enséñale al usuario el resumen de lo adoptado y las reglas ejecutables ANTES de sellar; con su ok,
   guarda y anota en el devlog qué se adoptó y qué quedó pendiente de decidir.

Desde ese momento: las convenciones GANAN a tus preferencias (los muros de seguridad siguen aplicando),
el hook bloquea violaciones introducidas, y los archivos quedan protegidos. Cambiarlas = decisión
explícita del usuario → borrar ambos y re-ejecutar `/adoptar`.
