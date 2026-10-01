# Patrones de página (31)

Uso: elige el patrón por tipo de página, respeta el orden de secciones salvo razón documentada en
`senzu/design-system/<slug>/pages/<página>.md`, y cruza con `industry-rules.md` para estilo/paleta. Un H1 por página; el CTA
principal aparece en el hero y se repite al final. Formato: **Secciones** (en orden) · **Jerarquía/CTA** · **Errores**.

Índice: 1 landing · 2 saas-landing · 3 pricing · 4 dashboard · 5 admin-crud · 6 auth · 7 onboarding · 8 settings ·
9 profile · 10 ecommerce-listing · 11 product-detail · 12 checkout · 13 blog-index · 14 article · 15 docs ·
16 portfolio · 17 agency · 18 contact · 19 about · 20 faq · 21 changelog · 22 404 · 23 empty-state ·
24 email-template · 25 search-results · 26 kanban · 27 chat · 28 calendar · 29 wizard · 30 immersive-3d-landing ·
31 scroll-story.

## 1. landing
- Secciones: `Nav > Hero (H1 + sub + CTA + visual) > Logos/prueba social > Beneficios (3) > Cómo funciona > Testimonios > CTA final > Footer`
- Jerarquía/CTA: un solo CTA primario repetido; secundario "ver demo"; H1 ≤ 10 palabras con beneficio, no característica.
- Errores: hero sin visual del producto, tres CTAs compitiendo, sección de features antes de la promesa, carrusel en hero.

## 2. saas-landing
- Secciones: `Nav > Hero (CTA trial + captura UI) > Logos > Problema/solución > Features en bento o tabs > Integraciones > Métricas > Testimonios > Pricing resumido > FAQ > CTA > Footer`
- Jerarquía/CTA: "Empieza gratis" (primario) + "Reservar demo" (secundario); prueba social antes de features.
- Errores: jerga técnica en el hero, captura de UI ilegible en móvil, pricing escondido, sin FAQ sobre datos/seguridad.

## 3. pricing
- Secciones: `Header (H1 + toggle mensual/anual) > 3 planes (recomendado destacado) > Tabla comparativa > FAQ > Testimonios/logos > CTA contacto ventas`
- Jerarquía/CTA: plan recomendado con badge y CTA primario; los demás con CTA secundario; precio en tamaño display.
- Errores: más de 4 planes, letra pequeña en límites, sin precio anual, tabla comparativa sin sticky header en móvil.

## 4. dashboard
- Secciones: `Sidebar > Topbar (búsqueda, notificaciones, usuario) > Título + filtros de periodo > KPIs (3-5 cards) > Gráfico principal > Tablas/listas secundarias > Actividad`
- Jerarquía/CTA: los KPIs responden "¿va bien?"; una acción principal por vista; densidad media; sin hero.
- Errores: gráficos decorativos sin pregunta, colores de estado inconsistentes, KPIs sin comparación temporal, sin estados vacíos/carga.

## 5. admin-crud
- Secciones: `Sidebar > Breadcrumb + H1 + botón "Nuevo" > Filtros/búsqueda > Tabla (orden, selección, acciones por fila) > Paginación`; detalle/edición en página o sheet lateral
- Jerarquía/CTA: "Nuevo X" arriba a la derecha; acciones destructivas en menú con confirmación; bulk actions al seleccionar.
- Errores: tabla sin estado vacío, columnas sin priorizar en móvil, borrar sin deshacer/confirmación, formulario en modal para entidades grandes.

## 6. auth
- Secciones: `Logo > H1 (Entrar/Crear cuenta) > OAuth (si existe) > Separador > Formulario (email, password) > Enlaces (olvidé, registro) > Legal`; split con visual opcional en desktop
- Jerarquía/CTA: un botón primario a ancho completo; mostrar/ocultar contraseña; errores junto al campo.
- Errores: captcha visible por defecto, requisitos de contraseña ocultos, sin `autocomplete`, visual que se come el formulario en 375 px.

## 7. onboarding
- Secciones: `Progreso (pasos) > Bienvenida > Pasos (1 pregunta o acción por pantalla) > Configuración inicial con valores por defecto > Éxito + siguiente acción`
- Jerarquía/CTA: "Continuar" primario, "Saltar" terciario siempre visible; máximo 3-5 pasos; guardar progreso.
- Errores: pedir datos innecesarios antes de mostrar valor, no poder saltar, sin estado de "hecho", tour modal encima de todo.

## 8. settings
- Secciones: `H1 > Nav lateral o tabs (Perfil, Cuenta, Notificaciones, Facturación, Seguridad, Peligro) > Secciones en cards con título + descripción > Zona de peligro al final`
- Jerarquía/CTA: guardar por sección (o autosave con feedback); acciones destructivas rojas y aisladas.
- Errores: un único "Guardar" global perdido abajo, toggles sin descripción, borrar cuenta junto a opciones normales.

## 9. profile
- Secciones: `Cabecera (avatar, nombre, rol, acciones) > Tabs (Actividad, Info, Ajustes si es propio) > Contenido > Sidebar con meta`
- Jerarquía/CTA: "Editar perfil" para el dueño, "Seguir/Contactar" para visitantes; nombre en H1.
- Errores: cabecera enorme sin contenido, info duplicada con settings, sin estado vacío en actividad.

## 10. ecommerce-listing
- Secciones: `Breadcrumb > H1 categoría + contador > Filtros (sidebar desktop / sheet móvil) + orden > Grid de productos (imagen, nombre, precio, rating, añadir) > Paginación o "cargar más" > SEO text`
- Jerarquía/CTA: la imagen manda; precio y nombre secundarios; "Añadir" visible en hover/desktop y siempre en móvil.
- Errores: filtros que recargan sin feedback, grids de 4 en móvil, imágenes con ratios distintos, sin chips de filtros activos.

## 11. product-detail
- Secciones: `Breadcrumb > Galería (sticky desktop) + Columna compra (H1, precio, variantes, cantidad, CTA, envío/devolución) > Descripción/tabs > Reseñas > Relacionados`
- Jerarquía/CTA: "Añadir al carrito" primario sticky en móvil; variantes como botones, no selects; stock y entrega visibles.
- Errores: galería sin zoom, CTA bajo el fold en móvil, variantes sin estado agotado, reseñas sin resumen.

## 12. checkout
- Secciones: `Header mínimo (logo + seguridad) > Pasos (Envío > Pago > Revisión) o página única > Formulario > Resumen del pedido (sticky) > CTA pagar`
- Jerarquía/CTA: un solo CTA por paso; total siempre visible; guest checkout primero.
- Errores: nav completa que distrae, campos innecesarios, errores solo al final, sin `autocomplete`, cupones que recargan todo.

## 13. blog-index
- Secciones: `H1 + descripción > Destacado > Filtro por categoría/búsqueda > Grid/lista de posts (imagen, categoría, título, extracto, fecha, lectura) > Paginación > Newsletter`
- Jerarquía/CTA: título del post en H2/H3 clicable; el destacado es el único con imagen grande.
- Errores: fechas ausentes, extractos cortados a mitad, categorías sin filtro real, tarjetas con altura desigual.

## 14. article
- Secciones: `Categoría + H1 + meta (autor, fecha, lectura) > Imagen > Cuerpo (prose, ancho 65-75 ch) > TOC sticky (desktop) > Compartir > Autor > Relacionados > Comentarios/newsletter`
- Jerarquía/CTA: tipografía es el diseño; CTA suave (newsletter) al final, no popups.
- Errores: línea > 80 caracteres, imágenes sin caption/dimensiones, TOC en móvil ocupando espacio, ads entre párrafos.

## 15. docs
- Secciones: `Topbar (logo, búsqueda ⌘K, versión) > Sidebar de navegación > Contenido (H1, prose, código con copiar) > TOC derecha > Prev/Next > Feedback "¿útil?"`
- Jerarquía/CTA: búsqueda omnipresente; bloques de código con lenguaje y copy; callouts para avisos.
- Errores: sidebar sin estado activo, sin versión visible, tablas anchas sin scroll, ejemplos sin resultado esperado.

## 16. portfolio
- Secciones: `Hero (nombre, rol, frase, CTA contacto) > Proyectos seleccionados (grid grande) > Sobre mí > Servicios/skills > Testimonios > Contacto > Footer`
- Jerarquía/CTA: los proyectos son el contenido; máximo 6 en home; caso de estudio con problema → proceso → resultado.
- Errores: skills en barras de porcentaje, intro animada larga, proyectos sin resultado, contacto solo en footer.

## 17. agency
- Secciones: `Hero (posicionamiento + CTA) > Logos de clientes > Servicios > Casos (con métricas) > Proceso > Equipo > Testimonios > CTA contacto`
- Jerarquía/CTA: "Hablemos" primario; casos con cifra de resultado como titular.
- Errores: manifiestos sin casos, equipo antes de resultados, scroll-jacking que impide leer servicios.

## 18. contact
- Secciones: `H1 + promesa de respuesta > Formulario (nombre, email, asunto, mensaje) + Datos (email, teléfono, dirección, horario) > Mapa opcional > FAQ corta`
- Jerarquía/CTA: enviar primario con estado de envío y confirmación clara; alternativas de contacto visibles.
- Errores: solo formulario sin email real, sin confirmación, captcha agresivo, mapa que roba el scroll.

## 19. about
- Secciones: `Hero (misión en una frase) > Historia > Valores (3-4) > Equipo > Cifras > Prensa/logos > CTA (empleo o contacto)`
- Jerarquía/CTA: humanizar (fotos reales); CTA a carreras o contacto.
- Errores: stock photos, valores genéricos sin ejemplo, timeline interminable, sin CTA.

## 20. faq
- Secciones: `H1 + búsqueda > Categorías (tabs o anclas) > Acordeones (pregunta H3 + respuesta breve) > "¿No encuentras?" → contacto`
- Jerarquía/CTA: acordeón accesible (botón, `aria-expanded`), una pregunta abierta por defecto opcional; enlace a soporte.
- Errores: acordeones que abren todo, respuestas de 500 palabras, sin agrupación, sin schema FAQ.

## 21. changelog
- Secciones: `H1 + suscribir (RSS/email) > Filtro por tipo (nuevo, mejora, fix) > Entradas por versión/fecha (badge, título, cuerpo, media) > Paginación`
- Jerarquía/CTA: fecha y versión son la jerarquía; badges de color semántico por tipo.
- Errores: entradas técnicas sin beneficio para el usuario, sin fechas, sin permalinks.

## 22. 404
- Secciones: `Ilustración ligera o tipografía grande > "Página no encontrada" > Explicación breve > Búsqueda o enlaces útiles > Volver al inicio`
- Jerarquía/CTA: un CTA primario (inicio) + búsqueda; tono de marca pero útil.
- Errores: animación pesada, sin nav, humor sin salida, código 200 en vez de 404.

## 23. empty-state
- Secciones: `Icono/ilustración pequeña > Título ("Aún no tienes proyectos") > Texto de valor (1-2 líneas) > CTA primario (crear) > Enlace secundario (importar, docs)`
- Jerarquía/CTA: el CTA hace exactamente lo que falta; distinguir "vacío", "sin resultados de filtro" y "error".
- Errores: ilustración gigante, texto negativo, sin CTA, mismo estado para filtros vacíos y primera vez.

## 24. email-template
- Secciones: `Preheader > Logo > Título > Cuerpo breve > CTA (botón bulletproof) > Detalles/tabla > Firma > Footer (legal, baja, dirección)`
- Jerarquía/CTA: un solo CTA con enlace absoluto; 600 px, tablas, fuentes seguras, texto plano alternativo.
- Errores: imágenes con el texto, CSS externo, sin baja, dark mode sin probar, botón solo imagen.

## 25. search-results
- Secciones: `Barra de búsqueda con término > Contador + orden > Filtros/facetas > Resultados (título resaltado, snippet, meta) > Paginación > Sugerencias si 0 resultados`
- Jerarquía/CTA: el término resaltado; "no results" con corrección y alternativas.
- Errores: sin contador, resultados sin snippet, filtros que borran la query, latencia sin skeleton.

## 26. kanban
- Secciones: `Topbar (proyecto, vista, filtros, buscar, añadir) > Columnas (título + contador + añadir) > Tarjetas (título, etiquetas, avatar, fecha) > Detalle en sheet/modal`
- Jerarquía/CTA: drag & drop con alternativa por teclado/menú; añadir tarjeta al pie y al inicio de columna.
- Errores: scroll horizontal sin indicación, tarjetas sobrecargadas, sin límite WIP visible, sin estado de columna vacía.

## 27. chat
- Secciones: `Lista de conversaciones (buscar, no leídos) > Cabecera (nombre, estado, acciones) > Hilo (burbujas agrupadas por autor/fecha, estado de envío) > Composer (adjuntar, emoji, enviar) `
- Jerarquía/CTA: composer siempre visible; enviar con Enter y botón; "escribiendo…" y scroll al último.
- Errores: burbujas sin timestamp accesible, composer que salta con el teclado móvil, sin estados de error de envío, lista sin no leídos.

## 28. calendar
- Secciones: `Toolbar (hoy, prev/next, título de periodo, vista mes/semana/día, nuevo evento) > Rejilla > Eventos (color por calendario, hora, título) > Panel/modal de detalle`
- Jerarquía/CTA: "Nuevo evento" primario y clic en hueco; hoy destacado; eventos truncados con "+N más".
- Errores: vista mes en móvil sin alternativa agenda, colores sin leyenda, sin navegación por teclado, zona horaria oculta.

## 29. wizard
- Secciones: `Indicador de pasos (número + nombre) > H1 del paso > Formulario del paso > Resumen lateral (desktop) > Atrás / Continuar > Revisión final > Confirmación`
- Jerarquía/CTA: "Continuar" primario, "Atrás" secundario; validar por paso; guardar borrador.
- Errores: perder datos al retroceder, pasos sin nombre, validación solo al final, sin revisión previa al envío.

## 30. immersive-3d-landing
- Secciones: `Loader accesible (progreso) > Hero con canvas 3D + H1/CTA en HTML > Secciones que mueven cámara/modelo por scroll > Features en overlay > Prueba social > CTA final estático > Footer`
- Jerarquía/CTA: el texto vive en HTML sobre el canvas; CTA visible sin interactuar con el 3D; fallback estático con el mismo mensaje.
- Errores: LCP dependiente del canvas, modelo > 2 MB, controles de cámara que capturan el scroll, sin reduced-motion, sin versión móvil.

## 31. scroll-story
- Secciones: `Hero/portada > Capítulos (sección pinned con texto que avanza y visual que cambia) > Datos/gráficos revelados > Conclusión > CTA > Créditos`
- Jerarquía/CTA: cada capítulo una idea; progreso visible; navegación por anclas; contenido legible sin animación.
- Errores: scroll-jacking con snap agresivo, texto que se mueve mientras se lee, pins sin `anticipatePin`, saltos al cambiar de orientación.
