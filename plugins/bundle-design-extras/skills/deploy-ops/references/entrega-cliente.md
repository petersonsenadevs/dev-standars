# Entrega al cliente (/entregar)

`/lanzar` comprueba que la web está lista; `/entregar` prepara que el CLIENTE pueda vivir con ella:
saber usarla, saber qué tiene contratado y qué hay que mantener, y cómo pedir cambios. Una entrega
sin esto genera llamadas, sustos con renovaciones y dependencia innecesaria.

Índice: 1 Antes de entregar · 2 Manual de uso · 3 Inventario de servicios y accesos · 4 Mantenimiento ·
5 Cómo pedir cambios · 6 Formación · 7 Salida · 8 Errores típicos

## 1. Antes de entregar
- `/lanzar` en APTA y el último deploy verificado (checklist de `/desplegar`).
- Backups automáticos funcionando y un restore probado (backups-monitoring.md).
- Cuentas a nombre del CLIENTE cuando corresponda (dominio, analítica, Search Console, hosting): si
  están a nombre de la agencia, se dice y se acuerda qué pasa con ellas.

## 2. Manual de uso (para quien no es técnico)
- Cómo entrar al panel y cómo recuperar la contraseña.
- Las tareas que hará de verdad, paso a paso y con capturas: publicar una noticia, cambiar un precio,
  añadir un producto, ver los formularios recibidos. Solo las suyas, no todo el panel.
- Qué NO tocar (plugins, ajustes técnicos) y por qué.
- Idioma del cliente, frases cortas, una tarea por apartado.

## 3. Inventario de servicios y accesos
| Servicio | Proveedor | A nombre de | Renovación | Coste | Dónde están las credenciales |
|---|---|---|---|---|---|
| Dominio | … | … | fecha | €/año | gestor de contraseñas de … |
**Nunca contraseñas en el documento**: solo dónde están (gestor de contraseñas compartido o entrega en
persona). Incluye dominio, DNS, hosting, correo, SSL, CDN, analítica, Search Console, Tag Manager,
pasarela de pago, email transaccional, plugins o licencias de pago, APIs y el repositorio.

## 4. Mantenimiento
- Qué hay que actualizar y cada cuánto (CMS, plugins, dependencias), quién lo hace y qué pasa si no.
- Renovaciones con fecha (dominio, SSL si no es automático, licencias).
- Backups: frecuencia, dónde están y cómo se pide una restauración.
- Garantía: qué cubre, durante cuánto tiempo y qué queda fuera.

## 5. Cómo pedir cambios
- Canal único (correo o gestor de tareas), qué información incluir (página, qué quiere, captura) y
  plazos de respuesta.
- Qué entra en el mantenimiento y qué se presupuesta aparte.

## 6. Formación
- Sesión de 30-60 minutos grabada con las tareas del manual, y el manual como referencia después.

## 7. Salida
`docs/entrega/` con `manual-de-uso.md`, `servicios-y-accesos.md` (sin contraseñas),
`mantenimiento.md` y `como-pedir-cambios.md`, más un resumen de una página para el cliente. Entrada en
el devlog con la fecha de entrega y lo pendiente.

## 8. Errores típicos
- Mandar contraseñas por correo o dejarlas en el documento.
- Un manual que explica todo el panel en vez de las cinco tareas que el cliente hará.
- Olvidar las renovaciones: el dominio caduca y la web desaparece un año después.
- Cuentas críticas a nombre de la agencia sin acuerdo explícito.
