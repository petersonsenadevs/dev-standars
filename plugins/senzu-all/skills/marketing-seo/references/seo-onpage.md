# SEO on-page y local (posicionar de verdad)

## Índice
- [Keywords e intención](#keywords-e-intención)
- [Arquitectura de la web](#arquitectura-de-la-web)
- [On-page por página](#on-page-por-página)
- [SEO local (el pan de la agencia)](#seo-local-el-pan-de-la-agencia)
- [Schema por tipo](#schema-por-tipo)
- [Contenido que posiciona](#contenido-que-posiciona)
- [Enlazado interno](#enlazado-interno)
- [Medir y iterar](#medir-y-iterar)
- [Lo que NO se hace](#lo-que-no-se-hace)

Lo técnico puro (sitemap, robots, canonicals, OG, CWV) ya está en `ui-verify §launch-checklist.md` §2-3;
esto es lo que va ANTES y DESPUÉS de ese checklist.

## Keywords e intención
- Parte de cómo busca el cliente REAL (pregunta al negocio: "¿qué te dicen por teléfono?"); complementa
  con el autocompletado de Google, "búsquedas relacionadas" y Search Console si la web ya existe.
- Clasifica por intención: **transaccional** ("alquiler contenedor escombros barcelona precio") → página
  de servicio; **informacional** ("cuánto cuesta retirar escombros") → contenido/FAQ que enlaza al
  servicio; **marca** → home. Una página = UNA intención principal.
- Regla de oro local: `servicio + ciudad/barrio` es la keyword madre de cada página de servicio.

## Arquitectura de la web
- **Una página por servicio principal** (no un mega-listado): `/retirada-escombros`, `/contenedores`…
  cada una atacando su keyword. Barrios/zonas: solo páginas por zona si hay contenido REAL distinto
  (obras hechas allí, equipo local) — clonar la misma página cambiando el topónimo es spam que Google pisa.
- URLs cortas, con la keyword, sin fechas ni IDs; la jerarquía refleja el menú (máx. 2 niveles útiles).
- Lo importante a ≤ 2 clics desde la home; nada de servicios enterrados en el footer.

## On-page por página
| Elemento | Patrón | Ejemplo |
|---|---|---|
| `<title>` (≤ 60 car.) | Keyword + diferenciador + marca | "Retirada de Escombros en Barcelona en 24h \| IS" |
| Meta description (≤ 155) | Beneficio + prueba + CTA (afecta al CTR, no al ranking) | "Contenedores y sacas con presupuesto cerrado. Llama y lo retiramos mañana." |
| H1 (uno) | La keyword con naturalidad, puede diferir del title | "Retirada de escombros en Barcelona" |
| H2/H3 | Sub-intenciones y preguntas reales (alimentan FAQ schema) | "¿Qué contenedor necesito?" |
| Primer párrafo | Keyword + qué/quién/dónde en 2-3 líneas | — |
| Imágenes | Nombre de archivo y `alt` descriptivos (no `IMG_2041.jpg`) | `contenedor-escombros-barcelona.webp` |

## SEO local (el pan de la agencia)
1. **Google Business Profile es la mitad del SEO local**: categoría correcta, NAP idéntico al de la web,
   horario real, fotos propias subidas con regularidad, y **reseñas** pedidas activamente (con respuesta
   a todas). La web enlaza a la ficha y viceversa.
2. Página de contacto con NAP + mapa embebido + `LocalBusiness` schema (ya en launch-checklist).
3. Consigue citas locales coherentes (directorios del sector y la ciudad, mismas señas exactas).
4. Contenido local genuino: obras/casos con ubicación, "trabajamos en X" con pruebas — no relleno.

## Schema por tipo
`LocalBusiness` (siempre en local) · `Service` por página de servicio · `FAQPage` si hay FAQ visible ·
`Product`+`Offer` en e-commerce · `Article` en blog · `BreadcrumbList` si hay migas · `Review`/ratings
SOLO con reseñas reales verificables. Todo validado (validator.schema.org) — schema falso = penalización.

## Contenido que posiciona
- Responde la pregunta COMPLETA mejor que los que ya rankean (míralos: qué cubren, qué les falta).
- Experiencia demostrable (E-E-A-T de andar por casa): fotos propias, casos con datos, quién firma.
- FAQ desde preguntas reales del negocio; precios orientativos si se puede (nadie los pone = ventaja).
- Actualizar > publicar: mejor 10 páginas vivas que 50 zombis. Contenido IA: solo como borrador revisado
  y enriquecido con lo que solo el negocio sabe; nunca publicado a granel.

## Enlazado interno
- Cada página de servicio recibe enlaces desde: home, menú, y todo contenido relacionado — con anchor
  descriptivo ("retirada de escombros", no "clic aquí").
- El contenido informacional SIEMPRE enlaza a su servicio (es su función).
- Sin páginas huérfanas (crawl mental o `verify` de enlaces al lanzar).

## Medir y iterar
- Search Console quincenal: consultas con impresiones y CTR bajo (title/description mejorables),
  posiciones 5-15 (a un empujón de contenido/enlaces), cobertura e indexación.
- Cambios de SEO anotados en el devlog con fecha → juzgar a 4-8 semanas contra Search Console.
- Con MCP conectado (`mcp-tools.md`), este análisis lo hace el agente en minutos.

## Lo que NO se hace
Keyword stuffing · texto invisible/cloaking · páginas-ciudad clonadas · comprar enlaces basura ·
schema mentiroso · contenido IA a granel sin revisar · copiar al competidor (inspiración de estructura
sí, texto no) · prometer "primero en Google en 30 días" (nadie honesto puede).
