# Rondas de maquetas: lo que gusta se queda, lo que no se va, y siempre algo nuevo

Continúa el modo propuesta (`proposal-mode.md`). La ronda 1 son las maquetas A/B de siempre; desde ahí,
cada ronda **converge**: lo que el usuario aprueba se fija y aparece igual en todas las maquetas
siguientes, lo que rechaza no vuelve, y solo se explora lo que sigue abierto, con al menos una idea nueva.

## Índice
1. Estructura de carpetas
2. Maquetas con piezas etiquetadas (plantilla)
3. Recoger la opinión
4. Registrar: Fijado, No y Abierto en gustos.md
5. Generar la ronda siguiente
6. Verificar antes de enseñar
7. Cerrar: cuándo parar y qué pasa al MASTER.md

## 1. Estructura de carpetas
```
senzu/design-system/<slug>/
├── gustos.md                 # Fijado · Sí · No · Dudas (memoria de las decisiones de diseño)
└── propuestas/
    ├── index.html            # todas las rondas (lo genera ronda-check --indice)
    ├── ronda-1/a.html  b.html
    ├── ronda-2/a.html  b.html  c.html
    └── ronda-2/FICHA.md      # qué se fijó, qué se vetó y qué explora cada maqueta
```
Las maquetas viejas no se borran: son el historial («volver a la B de la ronda 1» es posible).

## 2. Maquetas con piezas etiquetadas
Parte SIEMPRE de `references/es/plantilla-maqueta.html` (cópiala y rellena solo los `{{…}}`). Aporta:
- Un banner con la ronda y la maqueta, y en una línea qué cambia respecto a la ronda anterior.
- **Piezas etiquetadas**: cada decisión visual opinable lleva `data-pieza="B·T1"`, `data-cat` y `data-desc`
  (`B·T1` = maqueta B, tipografía, opción 1). Letras de categoría: **T** tipografía · **C** color ·
  **B** botones · **F** formas y radios · **L** layout · **I** imágenes · **N** iconos · **M** movimiento ·
  **X** textos y tono. Con «Ver piezas» se ven las etiquetas encima del diseño.
- **Panel «Tu opinión»**: Sí / No por pieza, un comentario libre y «Copiar para pegarlo en el chat».
  Se guarda en el navegador: el usuario puede ir y volver.
- `data-fijado` en lo que viene decidido (sale como FIJADO y no se vota) y `data-nuevo` en lo nuevo.

Etiqueta entre 6 y 12 piezas por maqueta: suficientes para decidir de verdad, sin convertirlo en un examen.

## 3. Recoger la opinión
El usuario abre las maquetas (o `propuestas/index.html`) y responde como prefiera:
- Pegando lo que copia el panel: `Me gusta: B·T1 (Tipografía: titulares en Fraunces 600); A·B2 (…)`.
- En el chat, con sus palabras: «me gustan los botones de la A y la letra de la B; el verde no».
  Tradúcelo tú a piezas y **confírmalo en una línea** antes de registrar: «Fijo B·T1 y A·B2, veto el
  verde (A·C1). ¿Correcto?».
- Si una opinión es ambigua («el hero no me convence»), una sola pregunta cerrada para concretar.

## 4. Registrar en gustos.md
```markdown
## Fijado (se mantiene igual en todas las rondas)
| Categoría | Decisión | Valor | Desde |
|---|---|---|---|
| Tipografía titulares | Fraunces 600 | `Fraunces` | R1 · B·T1 |
| Botón principal | píldora sólida en acento | `border-radius: 999px` | R1 · A·B2 |
| Acento | terracota | `#C2410C` | R2 · C·C1 |

## Sí (le gusta, sin fijar todavía)
- 2026-10-01 · R1 · «las fotos grandes a sangre» (B·I1): explorar en más secciones

## No (vetado — NUNCA proponer de nuevo sin preguntar)
- 2026-10-01 · R1 · verde salvia (A·C1) — términos bloqueados: `#7C9A7E`
- 2026-10-01 · R1 · carrusel de testimonios («me marea») — términos bloqueados: `carousel`, `swiper`

## Dudas / abierto
- Layout del hero (L): ni A ni B convencieron del todo
```
- **Fijado**: el valor entre acentos graves es lo que el verificador busca en cada maqueta nueva (una
  familia tipográfica, un color, una regla CSS). Pon el valor exacto que usarás en el código.
- **No**: los términos entre acentos graves los bloquea además el hook `code-hygiene` en todo el código.
- Algo fijado que el usuario cambia después: sale de Fijado y la decisión anterior pasa a No o a Sí,
  con la fecha. Nunca se pierde el rastro.

## 5. Generar la ronda siguiente
1. Lee `gustos.md` entero. Escribe `ronda-N/FICHA.md`: qué está fijado, qué está vetado, qué sigue
   abierto y qué explora cada maqueta.
2. **2 o 3 maquetas**, todas con lo fijado IDÉNTICO (mismos tokens, mismo valor) y marcado `data-fijado`.
3. Explora **solo lo abierto**: cada maqueta resuelve las categorías abiertas de forma distinta y de
   verdad distinta (no dos grises).
4. **Algo nuevo en cada maqueta** (`data-nuevo`): una idea que el usuario aún no ha visto, coherente con
   lo que le gustó (ej.: le gustaron las fotos a sangre → probar un mosaico editorial). Tira de
   `modern-look.md`, `composiciones.md` e `inspiration.md` filtrado por su sector.
5. Lo vetado no aparece ni disfrazado (otro tono del mismo verde, el mismo carrusel con otro nombre).
6. En el banner, una línea: «Fijado: letra y botones. Probamos: hero y color de fondo. Nuevo: mosaico».

## 6. Verificar antes de enseñar
```
node <skills-dir>/ui-ux-pro-max/scripts/ronda-check.mjs senzu/design-system/<slug> --indice
```
Falla si falta algo fijado en alguna maqueta, si aparece algo vetado, si no hay nada nuevo, si quedan
huecos de la plantilla, si faltan etiquetas o si dos maquetas son la misma. Corrige hasta «Ronda lista
para enseñar» y entonces da las rutas (o el `index.html`) y las preguntas.

## 7. Cerrar
- Se cierra cuando no queda nada importante abierto o el usuario dice «esta». Si tras 4 rondas sigue
  abierto lo mismo, para y pregunta qué falta: más rondas no arreglan una duda de fondo (quizá el brief).
- La maqueta elegida + Fijado pasan a `MASTER.md` con trazabilidad («Fijado en las rondas 1-3, maqueta
  3·B elegida el <fecha>»). Después se construye la página real con checkpoint por sección.
- Regístralo en el devlog del día; las decisiones de diseño importantes van también a `senzu/devlog/MEMORIA.md`.
