# Playbooks por tipo de negocio: qué construir, no solo cómo se ve

Complementa a `industry-rules.md` (estilo/paleta/tipografía por industria): aquí está el QUÉ — secciones
en orden, contenido que pedir al cliente, funciones imprescindibles y errores del sector. Úsalo en el
brief (`brief-discovery.md`) para proponer estructura aunque el cliente no sepa pedirla.

## Base común de todo negocio local (aplica siempre)
- **Teléfono y WhatsApp visibles sin scroll** (click-to-call en móvil); horario y zona de servicio.
- Reseñas de Google reales (widget o citas con nombre), fotos propias (el stock se nota y resta confianza).
- Formulario CORTO (nombre, teléfono, qué necesita) — cada campo extra pierde clientes.
- JSON-LD `LocalBusiness` + `Service`, NAP consistente con la ficha de Google Business.
- Legales RGPD (aviso, privacidad, cookies con consentimiento) y analítica configurada.
- Página por servicio principal (SEO local: "cerrajero + barrio/ciudad"), no un mega-listado.

## Playbooks (secciones en orden · contenido a pedir · funciones · errores del sector)

### Restaurante / bar / cafetería
- Secciones: hero con plato estrella y reserva → carta → fotos del local → ubicación+horario → reseñas → reserva.
- Pide: carta actualizada (con precios), fotos reales de platos y sala, horarios festivos, Instagram.
- Funciones: **carta en HTML** (no solo PDF), botón reservar (tel/Covermanager/TheFork), mapa, menú del día actualizable.
- Errores: PDF ilegible en móvil, fotos de stock de comida, música/autoplay, carta desactualizada.

### Clínica / dentista / fisio / estética salud
- Secciones: hero con beneficio+cita → tratamientos (cards) → equipo con fotos y nº colegiado → instalaciones → FAQ → cita.
- Pide: titulaciones/colegiados, fotos reales de equipo y consulta, seguros aceptados, precios orientativos si se pueden.
- Funciones: cita (tel/WhatsApp/booking), página por tratamiento, FAQPage schema, antes/después SOLO con consentimiento.
- Errores: promesas médicas absolutas (legal), fotos stock de batas, jerga clínica sin traducir, formularios largos.

### Reformas / construcción / oficios (fontanero, electricista, escombros…)
- Secciones: hero con oficio+zona+tel → servicios → **antes/después o galería de obras** → proceso en pasos → garantías → presupuesto.
- Pide: fotos de obras reales (antes/después), zonas, garantía, seguros/licencias, urgencias 24h sí/no.
- Funciones: presupuesto por WhatsApp con foto, click-to-call fijo en móvil, página por servicio+zona.
- Errores: sin fotos propias, sin precio ni "presupuesto gratis", web lenta con fotos de 8MB sin comprimir.

### Peluquería / barbería / estética
- Secciones: hero con estilo del local → servicios y PRECIOS → galería de trabajos → equipo → reserva.
- Pide: lista de precios real, fotos de trabajos (con permiso), Instagram activo, política de cancelación.
- Funciones: reserva online (Booksy/Fresha/tel), precios visibles (ocultarlos ahuyenta), Instagram embebido.
- Errores: "consultar precio" en todo, fotos pixeladas de móvil sin luz, no responder cómo aparcar/llegar.

### Gimnasio / entrenador / yoga
- Secciones: hero aspiracional con CTA de prueba → programas → horario de clases → precios/planes → testimonios con resultados → prueba gratis.
- Pide: horario real, precios de planes, fotos propias de clases, historias de alumnos (permiso).
- Funciones: tabla de horarios legible en móvil, alta/prueba online, comparativa de planes.
- Errores: fotos stock de culturistas, precios ocultos, tabla de horarios como imagen.

### Inmobiliaria
- Secciones: buscador arriba → destacados → cómo trabajamos (vender/comprar) → valoración gratuita → equipo/zona → contacto.
- Pide: cartera con fotos buenas, zonas, servicios (venta/alquiler/gestión), CRM o portal que usan.
- Funciones: fichas con galería+mapa+características, filtros que no recargan (Flip), CTA "valora tu piso", schema `RealEstateListing`.
- Errores: fotos oscuras en vertical, buscador que no filtra, fichas sin precio.

### Abogados / gestoría / consultoría
- Secciones: hero sobrio con especialidad → áreas de práctica → quiénes somos (credenciales) → casos/experiencia → primera consulta.
- Pide: áreas exactas, colegiación, casos tipo (anonimizados), tono (cercano vs formal).
- Funciones: página por área de práctica, CTA "primera consulta", formulario confidencial, FAQ legal en llano.
- Errores: martillos y balanzas de stock, párrafos de 15 líneas, prometer resultados (deontología).

### Academia / formación / cursos
- Secciones: hero con transformación ("aprende X en Y") → cursos (cards con precio y fechas) → método → profesores → testimonios → inscripción.
- Pide: calendario real, precios, temarios, fotos de clases, % aprobados/insertados si hay.
- Funciones: ficha por curso con `Course` schema, inscripción/pago o reserva de plaza, FAQ (horarios, becas).
- Errores: cursos sin fecha ni precio, testimonios sin nombre, sin información de acceso/nivel.

### Tienda / e-commerce local
- Secciones: hero con categoría estrella → categorías → productos destacados → confianza (envío/devolución/pago) → reseñas.
- Pide: catálogo con fotos homogéneas (fondo limpio), tallas/variantes, política de envío y devolución REAL.
- Funciones: buscador, ficha con envío visible, checkout sin registro obligatorio, `Product` schema con precio.
- Errores: fotos de proveedor mezcladas con propias, gastos de envío sorpresa al final, sin stock visible.

### Hotel / turismo rural / apartamentos
- Secciones: hero de la experiencia → habitaciones (galería+precio desde) → servicios → entorno/qué hacer → reseñas → reserva.
- Pide: fotos profesionales (habitación, baño, vistas), temporadas y precios, política de cancelación, cómo llegar.
- Funciones: motor de reserva o enlace a booking con paridad, galería rápida, mapa del entorno.
- Errores: fotos oscuras/deformadas (gran angular falso), precios solo "consultar", web lenta con sliders enormes.

### ONG / asociación
- Secciones: hero con la causa y CTA donar → qué hacemos (impacto en números) → proyectos → transparencia → donar/voluntariado.
- Pide: cifras de impacto reales, cuentas/memoria (transparencia), historias con permiso.
- Funciones: donación en 3 clics (importes sugeridos), certificado fiscal, newsletter.
- Errores: culpabilizar con imágenes duras, formulario de donación largo, sin transparencia económica.

### SaaS / startup / portfolio
- Ya cubiertos en `industry-rules.md` §1 y §5 (patrones saas-landing y portfolio) — allí está el detalle visual;
  el contenido a pedir: demo/screenshots reales, pricing decidido, casos de cliente. Portfolio: 4-6 mejores trabajos con caso, no 40.

## Cómo usarlo
1. En el brief, identifica el tipo de negocio y lee SOLO su bloque + la base común.
2. Propón la estructura de secciones al cliente en llano ("primero lo que haces, luego fotos de obras, luego presupuesto").
3. Cruza con `industry-rules.md` (estilo/paleta/tipografía de su industria) y persiste en MASTER.md.
4. La lista "Pide:" va tal cual al brief como checklist de contenido pendiente del cliente.
