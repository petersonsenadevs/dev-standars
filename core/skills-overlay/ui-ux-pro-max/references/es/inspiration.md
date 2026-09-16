# Inspiración: dónde mirar y cómo usarla sin copiar

Antes de diseñar algo "único", mira 3 referencias buenas del mismo tipo de página/industria.
Objetivo: extraer **patrones y decisiones**, nunca clonar. Si el usuario tiene navegador (Chrome MCP),
puedes abrir estas galerías y analizar ejemplos con él delante.

## 1. Directorios por lo que necesites

| Necesitas | Dónde mirar | Qué te da |
|---|---|---|
| Nivel award / efectos punteros | awwwards.com, godly.website, cssdesignawards.com | Sitios con animación/3D de referencia; mira los SOTD de tu industria |
| Landings de producto/SaaS | land-book.com, landing.love, saaslandingpage.com | Patrones de hero, pricing, features reales |
| Por industria (restaurante, clínica…) | lapa.ninja (categorías), land-book (filtros) | Convenciones del sector que el usuario espera |
| Flujos y UI de apps reales | mobbin.com (web/iOS/Android) | Onboarding, checkout, settings: cómo lo hacen los grandes |
| Portfolios / estudios creativos | godly.website, siteinspire.com, minimal.gallery | Tipografía valiente, layouts no convencionales |
| Componentes concretos (footer, pricing…) | navbar.gallery, footer.design, pageflows.com | Variantes de un solo componente |
| E-commerce | ecomm.design, baymard.com (research) | Fichas de producto, carritos; Baymard = evidencia UX |
| Dark mode / gradientes / detalles | dark.design, gradient.page, uigarage.net | Detalles visuales concretos |
| Tipografía en uso | fontsinuse.com, typewolf.com | Qué fuentes usan sitios reales y con qué pairing |
| Paletas en contexto | colorhunt.co, huemint.com (con IA de layout) | Paletas aplicadas, no swatches sueltos |

## 2. Protocolo de análisis (15 min, no una tarde)

1. Elige **3 referencias** del mismo tipo de página (misma industria si existe en las galerías).
2. De cada una anota en 5 líneas: **patrón de página** (orden de secciones), **1 decisión tipográfica**,
   **1 decisión de color**, **1 efecto** (y si aporta o estorba), **1 cosa a evitar**.
3. Cruza con el brief (`brief-discovery.md`): ¿qué encaja con la marca y el objetivo del cliente?
4. Escribe la síntesis en `design-system/<slug>/MASTER.md` §Referencias: enlace + qué se toma de cada una.
5. Diseña desde los tokens propios. Si al final se parece demasiado a UNA referencia, mezcla mal hecha: vuelve al paso 3.

## 3. Qué es "extraer patrón" (y qué es copiar)

| Extraer (bien) | Copiar (mal) |
|---|---|
| "Hero con titular enorme a la izquierda y producto flotando a la derecha" | Mismo layout con mismos ángulos, sombras y copy calcado |
| "Serif de display + fondo crema para premium" | Su misma fuente, su mismo hex |
| "Marquee de logos entre hero y features para credibilidad" | Sus logos y su misma composición pixel a pixel |
| "Cards con borde 1px y hover que eleva 4px" | Clonar su CSS |

La estructura y las convenciones no son de nadie; la ejecución concreta sí. Ante la duda: cambia al menos
paleta, tipografía y contenido, y que la referencia sea UNA influencia entre tres.

## 4. Convenciones por industria (lo que el visitante espera encontrar)

- **Servicio local** (reformas, escombros, clínicas): teléfono visible SIEMPRE, zona de servicio, fotos reales
  (no stock), reseñas de Google, formulario corto. La confianza vende más que el efecto.
- **Restaurante**: carta accesible en 1 clic (HTML, no solo PDF), horario, reserva, fotos de plato reales.
- **SaaS**: hero con beneficio en 6-10 palabras + screenshot/demo, social proof, pricing claro con FAQ.
- **E-commerce**: buscador, filtros que no saltan (Flip), ficha con envío/devolución visibles, checkout sin sorpresas.
- **Portfolio/estudio**: los trabajos SON la página; navegación mínima, tipografía protagonista, case studies.
- **Abogados/finanzas**: sobriedad, credenciales, nada de animación juguetona; azules/grises + serif.

Si la industria tiene reglas propias en `references/es/industry-rules.md`, esa referencia manda.

## 5. Checklist de "diseño único" antes de entregar

- [ ] ¿La paleta y tipografía salen de MASTER.md/BRAND.md y no del default de la IA (violeta+Inter)?
- [ ] ¿Hay UNA decisión memorable (tipografía valiente, efecto protagonista, layout no plantilla)?
- [ ] ¿El resto de la página es convencional donde debe serlo (formularios, navegación)? Único ≠ raro en todo.
- [ ] ¿Las 3 referencias están documentadas en MASTER.md con lo que se tomó de cada una?
- [ ] ¿Pasaría el usuario un "test de portada": la distinguiría de una plantilla genérica?
