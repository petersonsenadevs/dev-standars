# Formularios pro: los que la gente termina

Índice: 1 Menos campos · 2 Layout · 3 Validación que ayuda · 4 Multi-step · 5 Detalles que convierten ·
6 Estados · 7 Errores típicos

## 1. Menos campos (la mejora nº 1)
- Cada campo cuesta conversión: pide SOLO lo que usarás hoy ("¿qué haremos con este dato esta semana?").
  Nombre completo en UN campo; empresa/teléfono opcionales y marcados como tales ("(opcional)" — mejor
  marcar lo opcional que asteriscos en todo).
- Lo que se puede deducir no se pregunta (ciudad por CP, tipo de tarjeta por el número).

## 2. Layout
- **Una columna** casi siempre (el zigzag de dos columnas rompe el flujo); excepciones naturales: CP+ciudad,
  fecha en partes. Labels ENCIMA del campo (no placeholder como label, no labels a la izquierda).
- Anchos que insinúan el contenido: el CP no mide como la dirección. Campos táctiles ≥44px de alto,
  `inputmode`/`type` correctos (email, tel, numeric) para el teclado móvil adecuado.
- Orden lógico y agrupado por bloques con título si pasa de ~6 campos ("Tus datos", "Envío").

## 3. Validación que ayuda (no que castiga)
- Momento: valida un campo **al salir de él** (blur), no mientras teclea (excepto confirmaciones y
  disponibilidad de usuario); re-valida en vivo SOLO cuando ya estaba en error (para quitar el rojo al corregirlo).
- Mensajes concretos y accionables junto al campo: "El email necesita una @" > "Campo inválido". Nunca solo
  borde rojo (a11y-build §3: aria-describedby, aria-invalid, focus al primer error al enviar).
- Acepta formatos flexibles y normaliza tú (espacios en el teléfono, mayúsculas en el email): no regañes
  por lo que puedes arreglar.
- El botón de enviar NO se deshabilita por errores (deja pulsar y muestra qué falta); deshabilítalo solo
  DURANTE el envío (con spinner + texto "Enviando…").

## 4. Multi-step (cuándo y cómo)
- Trocea cuando pasa de ~7 campos o mezcla contextos (datos → envío → pago). Un paso = una pregunta mental.
- Barra de progreso con pasos nombrados; "Atrás" SIEMPRE sin perder lo escrito; empieza por lo fácil
  (compromiso progresivo: el email al principio, lo pesado después).
- Guarda el avance (localStorage o servidor): volver y encontrarlo vacío = abandono seguro.

## 5. Detalles que convierten
- Autocomplete correcto (`autocomplete="name|email|tel|street-address"`): el navegador rellena, tú ganas.
- Mostrar/ocultar contraseña; pegar permitido SIEMPRE (nada de bloquear paste en confirmaciones).
- El error del servidor no borra el formulario (repuebla los valores — form actions de SvelteKit/Inertia
  lo traen; en SPA, no resetees el estado).
- Microcopy que quita miedo bajo el botón: "Sin spam", "Respondemos en 24 h", "Cancela cuando quieras".
- Un solo CTA primario por formulario; el secundario ("Cancelar") visualmente menor.

## 6. Estados (los seis, como toda UI)
Enviando (botón con spinner y deshabilitado) · Éxito (confirmación clara: qué pasó y qué sigue — página o
mensaje, no un toast fugaz para algo importante) · Error de servidor (mensaje humano + valores intactos +
reintentar) · Vacío/pristine · Con errores de campo · Offline si aplica (avisar antes de que escriba).

## 7. Errores típicos del agente
- Placeholder como único label · dos columnas en zigzag · todo obligatorio con asteriscos.
- Validar a la primera tecla ("email inválido" cuando llevas 3 letras) · mensajes genéricos.
- Deshabilitar el submit hasta que todo esté perfecto (el usuario no sabe qué falta).
- Reset del formulario tras error de servidor · sin estado de envío (doble click = doble alta:
  code-quality data-integrity §idempotencia).
- Captcha visible por defecto (empieza con honeypot/turnstile invisible; castiga solo si hay abuso real).
