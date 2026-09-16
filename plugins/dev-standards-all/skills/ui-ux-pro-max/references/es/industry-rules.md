# Reglas por industria (45)

Uso: localiza la industria, toma estilo/patrón como punto de partida y lanza `search.py` con las keywords de paleta y
tipografía (`--domain color` / `--domain typography`) para obtener valores reales; el estilo se busca con `--domain style`.
El resultado se persiste en `design-system/<slug>/MASTER.md`. Si el brief contradice la tabla, gana el brief (documentado).

Categorías de estilo: `minimal`, `glass`, `brutalist`, `bento`, `corporate`, `editorial`, `dark-mode`, `luxury`,
`saas`, `dashboard`, `playful`, `organic`, `swiss`, `3d-immersive`, `scroll-story`, `high-contrast-a11y`,
`neumorphic`, `retro`, `gradient`, `monochrome`. Patrones: ver `page-patterns.md`.

Índice: 1 SaaS y tecnología · 2 finanzas y legal · 3 salud y bienestar · 4 comercio · 5 servicios creativos ·
6 educación, público y sin ánimo de lucro · 7 industria y movilidad · 8 ocio, eventos y hostelería · 9 otros servicios.

## 1. SaaS y tecnología

| Industria | Estilos | Paleta (keywords color) | Tipografía (keywords) | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| SaaS B2B | saas, bento, minimal | `saas trust blue neutral` | `geometric sans professional` | saas-landing + dashboard | reveals suaves, tabs de features, contadores | gradientes estridentes, ilustraciones 3D genéricas, hero sin producto |
| Startup IA | dark-mode, gradient, glass | `ai gradient violet cyan dark` | `modern sans technical mono` | saas-landing | glow sutil, partículas ligeras, typing effect | "magia" sin demo real, fondos de red neuronal cliché |
| Devtools / API | dark-mode, minimal, mono | `developer dark terminal green` | `monospace code sans` | docs + saas-landing | bloques de código animados, ⌘K, terminal | marketing sin snippet, colores pastel, hero sin código |
| Analytics / BI | dashboard, saas, swiss | `data analytics blue teal neutral` | `sans tabular numbers` | dashboard | transiciones de gráficos, skeletons, tooltips | gráficos decorativos, más de 6 colores de serie, 3D en charts |
| Ciberseguridad | dark-mode, corporate, high-contrast-a11y | `security dark navy green alert` | `strong sans technical` | saas-landing + pricing | escaneo/pulso sutil, badges de cumplimiento | alarmismo, hacker verde-matrix, animación excesiva |
| Marketplace | minimal, playful, bento | `marketplace friendly orange blue` | `humanist sans readable` | ecommerce-listing + search-results | hover en cards, filtros animados | jerarquía plana vendedor/comprador, demasiados CTAs |
| Delivery / on-demand | playful, minimal | `delivery vibrant orange green` | `rounded sans bold` | ecommerce-listing + checkout | micro-interacciones al añadir, tracking en mapa | scroll-jacking, checkout largo, fotos sin ratio |
| Crypto / Web3 | dark-mode, glass, 3d-immersive | `crypto dark neon gradient` | `geometric sans futuristic` | landing + dashboard | tickers, glass cards, 3D ligero | gradientes neón sin contraste, promesas de rentabilidad, fondos que marean |
| Gaming | dark-mode, 3d-immersive, brutalist | `gaming dark neon accent` | `display bold condensed` | immersive-3d-landing | vídeo en hero, hover con glow, parallax | texto ilegible sobre vídeo, autoplay con sonido, sin reduced-motion |

## 2. Finanzas y legal

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Fintech / banca | minimal, corporate, saas | `fintech trust green navy` | `clean sans numbers` | saas-landing + dashboard | contadores, transiciones de saldo, skeletons | glass sobre datos, rojo/verde sin texto, animación en cifras críticas |
| Seguros | corporate, minimal, high-contrast-a11y | `insurance calm blue neutral` | `friendly sans legible` | landing + wizard | progreso de cotización, comparativas | jerga, formularios largos sin pasos, stock photos de familias |
| Legal / despacho | editorial, corporate, monochrome | `legal navy gold serif` | `serif authority sans` | agency + contact | reveals discretos, sin más | animaciones llamativas, color chillón, testimonios inventados |
| Consultoría | corporate, editorial, swiss | `consulting navy neutral accent` | `serif display sans body` | agency + about | casos con métricas animadas | manifiestos vacíos, slider de logos infinito |
| Contabilidad / gestoría | minimal, corporate | `accounting blue green neutral` | `clean sans` | landing + pricing | calculadoras interactivas | miedo (Hacienda), tablas ilegibles en móvil |

## 3. Salud y bienestar

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Healthcare / clínica | minimal, high-contrast-a11y, corporate | `healthcare calm blue teal` | `humanist sans accessible` | landing + contact (cita) | reveals suaves, pasos para pedir cita | rojo como acento, glass, imágenes de dolor, texto pequeño |
| Farmacia | minimal, corporate | `pharmacy green white clean` | `clear sans` | ecommerce-listing + product-detail | filtros claros, estados de stock | ratios de imagen dispares, avisos legales ocultos |
| Dental | minimal, playful (suave) | `dental fresh blue mint` | `rounded sans friendly` | landing + contact | antes/después con slider accesible | sonrisas de stock, azul clínico frío puro |
| Veterinaria | playful, organic | `veterinary warm green orange` | `rounded sans` | landing + contact | ilustraciones ligeras, hover en cards | tono infantil, urgencias escondidas |
| Spa / belleza | luxury, organic, minimal | `spa beige sage gold` | `serif elegant thin sans` | landing + contact (reserva) | fades lentos, imágenes a sangre, parallax leve | texto sobre imagen sin contraste, fuentes finas < 16 px |
| Fitness / gym | dark-mode, brutalist, high-contrast | `fitness black lime energetic` | `condensed bold display` | landing + pricing | vídeo, contadores, CTA pegajoso | grises apagados, lorem, tablas de clases sin móvil |
| Bienestar / meditación | organic, neumorphic (suave), minimal | `wellness soft pastel earth` | `serif warm sans` | landing + onboarding (app) | transiciones lentas, gradientes suaves | neumorfismo con bajo contraste, animaciones rápidas |

## 4. Comercio

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| E-commerce moda | editorial, minimal, luxury | `fashion editorial black neutral` | `serif fashion display sans` | ecommerce-listing + product-detail + checkout | hover con segunda imagen, galería, lookbook scroll | glass, sombras pesadas, grids con ratios mixtos, sliders automáticos |
| E-commerce tech | minimal, dark-mode, bento | `tech product dark accent` | `geometric sans specs` | product-detail + ecommerce-listing | zoom, comparadores, specs en bento | fotos sin fondo uniforme, specs escondidas, hero 3D lento |
| Lujo | luxury, editorial, monochrome | `luxury black gold cream` | `serif high contrast thin` | landing + product-detail | espacio generoso, fades muy lentos, imágenes grandes | CTAs chillones, descuentos, densidad, iconos genéricos |
| Joyería | luxury, minimal | `jewelry gold white pearl` | `serif elegant` | product-detail + ecommerce-listing | zoom macro, fondos neutros, 360º opcional | fondos oscuros que apagan el brillo, sombras duras |
| Alimentación / gourmet | organic, editorial, playful | `food warm natural appetizing` | `serif warm sans` | ecommerce-listing + product-detail | fotografía grande, hover suave | azules fríos, filtros que lavan la comida |
| Infantil / juguetes | playful, organic | `kids playful primary soft` | `rounded sans friendly` | ecommerce-listing + landing | micro-interacciones, ilustraciones | saturación total, texto pequeño, animaciones continuas |
| Mascotas | playful, organic | `pets warm friendly orange` | `rounded sans` | ecommerce-listing + landing | hover cálido, ilustraciones | tono cursi, fotos de stock repetidas |

## 5. Servicios creativos

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Agencia digital | brutalist, editorial, scroll-story | `agency bold black accent` | `display expressive sans` | agency | cursor custom, marquee, transiciones de página, reveals de texto | scroll-jacking en servicios, sin casos con resultados, intro > 1,2 s |
| Portfolio dev | minimal, dark-mode, mono | `developer portfolio dark accent` | `mono sans clean` | portfolio | hover en proyectos, tema claro/oscuro | barras de skills, intro animada, fondo de partículas pesado |
| Fotografía | editorial, monochrome, minimal | `photography black white neutral` | `thin sans serif captions` | portfolio + article | galería masonry, lightbox, fades | UI que compite con las fotos, compresión agresiva, marcas de agua |
| Arquitectura | swiss, minimal, editorial | `architecture concrete neutral warm` | `grotesk sans serif` | portfolio + about | grids estrictos, parallax leve, planos en hover | ornamentos, glass, sombras suaves |
| Música / artista | dark-mode, brutalist, 3d-immersive | `music dark vibrant` | `display bold` | landing + events | player persistente, vídeo, glitch sutil | autoplay con sonido, texto sobre vídeo sin contraste |
| Bodas | luxury, organic, editorial | `wedding blush ivory sage` | `script accent serif` | landing + rsvp (contact) | fades, countdown, galería | script en cuerpo de texto, animaciones cursis, formularios largos |
| Eventos / conferencias | brutalist, bento, playful | `events energetic bold` | `display condensed sans` | landing + schedule (calendar) | countdown, agenda por tracks, speakers en grid | agenda solo en PDF, horas sin zona horaria |

## 6. Educación, público y sin ánimo de lucro

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Edtech | playful, saas, minimal | `education friendly blue yellow` | `rounded sans readable` | saas-landing + onboarding + dashboard | progreso, badges, micro-feedback | gamificación agresiva, contraste bajo, texto denso |
| ONG / fundación | editorial, organic, high-contrast-a11y | `nonprofit hope green warm` | `humanist sans serif` | landing + donate (checkout) | contadores de impacto, historias | culpa como palanca, formularios de donación largos, stock |
| Gobierno / administración | high-contrast-a11y, corporate, minimal | `government accessible blue neutral` | `system sans accessible` | docs + wizard + search-results | ninguno decorativo; foco y estados claros | animaciones, glass, jerga, PDFs como único formato |
| Coworking | bento, minimal, organic | `coworking warm neutral accent` | `grotesk friendly sans` | landing + pricing + contact | tour en fotos, planes, mapa | tarifas ocultas, sin disponibilidad real |
| RRHH / empleo | saas, minimal, corporate | `hr trust teal warm` | `humanist sans` | saas-landing + admin-crud + search-results | filtros, pipelines kanban | lenguaje corporativo hueco, formularios sin guardar |

## 7. Industria y movilidad

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Inmobiliaria | minimal, editorial, luxury (premium) | `real estate elegant neutral navy` | `serif display sans` | search-results + product-detail (ficha) | mapa + lista, galería, filtros | fotos sin ratio, precio escondido, sliders automáticos |
| Construcción | corporate, brutalist (moderado), swiss | `construction industrial yellow dark` | `bold sans industrial` | agency + portfolio | contadores de proyectos, antes/después | amarillo/negro de obra literal, imágenes pesadas sin lazy |
| Energía / renovables | organic, corporate, minimal | `energy green sky clean` | `modern sans` | landing + calculator (wizard) | calculadora de ahorro, datos animados | greenwashing visual, 3D pesado de turbinas |
| Logística | corporate, dashboard, minimal | `logistics blue orange reliable` | `sans tabular` | saas-landing + dashboard (tracking) | tracking en mapa, timelines de estado | mapas decorativos, animaciones de camiones |
| Automoción | dark-mode, 3d-immersive, luxury | `automotive dark metallic accent` | `display wide sans` | immersive-3d-landing + product-detail (configurador) | configurador 3D, vídeo, scroll-story de features | 3D sin fallback, configurador sin precio, autoplay pesado en móvil |
| Viajes | editorial, organic, playful | `travel vibrant sky sunset` | `display friendly serif` | search-results + product-detail | fotos grandes, mapas, fechas interactivas | carruseles automáticos, filtros que recargan, precios sin tasas |
| Hotel | luxury, editorial, minimal | `hotel warm elegant neutral` | `serif elegant sans` | landing + booking (wizard) | galería a sangre, reserva pegajosa, fades | motor de reservas externo sin estilo, texto sobre foto sin contraste |

## 8. Ocio, eventos y hostelería

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Restaurante | editorial, organic, dark-mode (fine dining) | `restaurant warm appetizing dark` | `serif display sans menu` | landing + menu (docs-like) + contact (reserva) | fotos grandes, carta legible, reserva accesible | carta en PDF/imagen, música, horarios escondidos |
| Café / panadería | organic, playful, editorial | `cafe cozy brown cream` | `serif warm rounded sans` | landing + contact | texturas suaves, hover cálido | tipografía script en cuerpo, fotos oscuras |
| Ocio nocturno / bar | dark-mode, brutalist | `nightlife dark neon` | `display bold` | landing + events | glow, agenda de eventos | contraste bajo, autoplay, información práctica escondida |

## 9. Otros servicios

| Industria | Estilos | Paleta | Tipografía | Patrón | Efectos clave | Evitar |
|---|---|---|---|---|---|---|
| Reformas / hogar | minimal, organic, corporate | `home renovation warm neutral` | `friendly sans` | landing + portfolio + contact | antes/después, presupuesto en pasos | stock de familias, formularios largos |
| Telecomunicaciones | corporate, saas, gradient (moderado) | `telecom bold accent neutral` | `bold sans` | pricing + landing | comparador de tarifas, cobertura | letra pequeña, tarifas con asteriscos ocultos |
| Servicios profesionales locales | minimal, corporate | `local service trust blue` | `clean sans` | landing + contact | mapa, horario, teléfono clicable | animación, texto largo, sin teléfono visible en móvil |

Reglas transversales: en toda industria se aplican las 12 reglas duras de `SKILL.md` §3 (contraste, reduced-motion,
estados, formularios, iconos SVG); `dark-mode` como estilo exige verificar contraste de acentos neón (≥ 4.5:1 sobre el
fondo) y `3d-immersive`/`scroll-story` exigen fallback estático y presupuesto de peso (`threejs-webgl`, `gsap-scrolltrigger`).
