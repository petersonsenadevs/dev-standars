# Brief y descubrimiento: qué saber ANTES de diseñar

El error nº 1 es empezar a maquetar sin brief. El usuario muchas veces **no sabe los nombres técnicos**
de lo que quiere: tu trabajo es sacárselo con preguntas en lenguaje llano y traducirlo tú. Nunca le
preguntes "¿quieres un hero con parallax y glassmorphism?"; pregúntale por sensaciones, ejemplos y objetivos.

## 1. Checklist: no diseñes sin esto

| Dato | Si no lo tienes… |
|---|---|
| **Marca**: logo (SVG), colores existentes, tipografías compradas/usadas, tono de voz | Pídelo. Si no hay marca, dilo y genera propuesta con `--design-system` (documentada como propuesta, no como marca). |
| **Guideline/brandline**: manual de marca, usos prohibidos del logo, márgenes | Pregunta si existe PDF/Figma de marca. Si existe, sus reglas PREVALECEN sobre cualquier búsqueda. |
| **Objetivo de la página**: ¿qué debe hacer el visitante? (llamar, comprar, registrarse, leer) | Pregunta "¿qué quieres que haga la persona que entra?". El CTA principal sale de aquí. |
| **Tipo de negocio**: su playbook (secciones, funciones, contenido a pedir) | `business-playbooks.md` — propón tú la estructura del sector; el cliente no tiene por qué saber pedirla. |
| **Audiencia**: quién entra, desde qué dispositivo, qué edad/contexto | Pregunta. B2B de escritorio ≠ servicio local que se busca desde el móvil en la calle. |
| **Contenido real**: textos, fotos, datos de contacto, precios | Sin contenido real no hay diseño final: pide lo que haya y marca PENDIENTE lo que falte. Nada de lorem ipsum. |
| **Referencias**: 2-3 webs que le gusten (y alguna que odie) | Pídelas SIEMPRE: es la forma más rápida de entender el gusto del cliente sin tecnicismos. |
| **Restricciones**: dark mode, idiomas, legales (RGPD), accesibilidad, presupuesto de efectos | Pregunta solo lo relevante al proyecto. |

Persiste todo en `senzu/plan/brief.md` y las decisiones visuales en `senzu/design-system/<slug>/MASTER.md`.
Si el proyecto tiene manual de marca, crea `senzu/design-system/<slug>/BRAND.md` con: colores exactos (hex),
tipografías (y dónde están licenciadas), usos del logo, tono de voz y ejemplos de sí/no. Prioridad de
fuentes de verdad: BRAND.md → MASTER.md → propuesta generada.

## 2. Entrevista guiada (lenguaje llano, con opciones)

Haz pocas preguntas y ofréceles opciones A/B; a la gente le cuesta describir, pero elegir no.

1. **"¿Qué quieres que haga quien entre en la web?"** → define el CTA y el patrón de página.
2. **"Dime 2-3 webs que te gusten, de lo que sea. ¿Qué te gusta de cada una?"** → estilo real del cliente.
3. **"¿Tu marca es más seria o más cercana? ¿Más clásica o más moderna?"** → tono y tipografía.
4. **"¿Prefieres una web tranquila o con movimiento que llame la atención?"** (enseña un ejemplo de cada) → presupuesto de animación (árbol F4).
5. **"¿Fondo claro, oscuro, o los dos?"** → tema.
6. **"¿Qué NO quieres ver de ninguna manera?"** → la lista de vetos vale oro.
7. **"¿La gente te buscará más desde el móvil o el ordenador?"** → prioridad de diseño (casi siempre móvil).

## 2b. Modo descubrimiento: cuando el cliente "no sabe lo que quiere"

Nadie sabe describir una web; todo el mundo sabe elegir entre dos. Protocolo (también como comando `/brief`):

1. **Una pregunta cada vez** (las de §2), en llano, con 2-3 opciones cerradas + "otra cosa". Nada de listas de 10 preguntas.
2. **Identifica el tipo de negocio** y saca su playbook (`business-playbooks.md`): ya sabes qué secciones y
   funciones proponer sin que te las pida; preséntalas como "esto es lo que funciona en tu sector".
3. **Dos direcciones visuales A/B** descritas en llano y opuestas, con la industria de fondo (`industry-rules.md`):
   - A: "Sobria y de confianza: fondo claro, tu verde corporativo, fotos grandes de trabajos, todo muy ordenado."
   - B: "Con más carácter: fondo oscuro, titulares enormes, las fotos aparecen al hacer scroll."
   Que elija (o mezcle). Si puedes, enséñale 1 web de ejemplo de cada dirección (`inspiration.md`) y pregunta qué le gusta de ella.
4. **Confirma en sus palabras**: "Entonces: que dé confianza, con tus colores de siempre, y que el teléfono esté siempre a mano. ¿Sí?"
   Después traduces tú a lo técnico (glosario §3) y lo escribes en `senzu/plan/brief.md` + MASTER.md.
5. Lo que el cliente no decide, lo decides tú por su sector (playbook + industry-rules) y lo dejas **documentado como decisión propia**, reversible.

## 3. Glosario cliente → técnico (traduce tú, no le corrijas)

| El cliente dice… | Probablemente quiere… |
|---|---|
| "Que llame la atención" / "con vida" | Animación de entrada (reveal), hero potente, micro-interacciones; ver effects-catalog y F4 |
| "Que se mueva al bajar" | Scroll reveal / parallax / scrub (`gsap-scrolltrigger`) |
| "Como Apple" | Scrollytelling: secciones pineadas, producto protagonista, mucho blanco/negro |
| "Moderna" / "limpia" | Minimalismo: espacio en blanco, tipografía grande, pocos colores |
| "Elegante" / "premium" | Serif de display, paleta sobria, oscuro + dorado/acento, fotos grandes |
| "Divertida" / "juvenil" | Colores saturados, formas orgánicas, ilustración, tipografía redonda |
| "Profesional" / "de confianza" | Orden, azules/verdes sobrios, testimonios, logos de clientes, datos |
| "Que se vea todo de un vistazo" | Menos secciones, above-the-fold denso, anchor nav |
| "Un catálogo" / "que se vean los trabajos" | Galería/grid con filtros (Flip) y página de detalle |
| "Efecto de esas fotos que se comparan" | Slider antes/después |
| "Letras que se escriben solas" | Typewriter/scramble (valida con F4: cansa rápido) |
| "3D" / "que gire" | Ver árbol F3 ANTES de prometer nada (coste móvil) |
| "Como un Instagram" | Feed/grid de imágenes, stories → carrusel; cuidado: pide contenido constante |

## 4. Señales de alarma antes de empezar

- El cliente no tiene contenido → propón estructura con contenido provisional MARCADO y un plan de entrega.
- "Me gusta todo, hazlo a tu gusto" → enséñale 2 direcciones visuales opuestas (moodboard A/B) y que elija.
- Pide copiar una web concreta → se toma como referencia de patrón, nunca se clona (dilo explícitamente).
- Quiere 10 efectos → F4 (presupuesto de efecto): máximo 1-2 efectos protagonistas por página.

## 5. Salida del brief (antes de la primera línea de código)

Bloque corto que el cliente pueda validar: **Objetivo y CTA · Audiencia y dispositivo principal ·
Dirección visual (estilo, paleta, tipografía con muestra) · Patrón de página por sección · Efectos
previstos (en llano: "las tarjetas aparecen al bajar") · Qué falta (contenido/fotos) y quién lo trae**.
Con el ok del cliente → modo propuesta (`proposal-mode.md`): blueprint aprobable y 2 maquetas A/B que se
ven, y los vetos que salgan van naciendo en `senzu/design-system/<slug>/gustos.md`. Solo después, a construir.
