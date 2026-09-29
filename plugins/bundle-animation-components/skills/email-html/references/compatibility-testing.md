# Compatibilidad y pruebas: que se vea bien donde lo leen de verdad

Índice: 1 El mapa de clientes · 2 Qué NO funciona dónde · 3 Cómo probar (escalera) · 4 Checklist antes de enviar ·
5 Entregabilidad mínima · 6 Depurar "se ve roto en X"

## 1. El mapa de clientes (dónde caerá tu email)
- **Apple Mail (iPhone/Mac)**: el mejor motor (WebKit): casi todo funciona. Suele ser ~40–50% de aperturas.
- **Gmail** (web + apps): bueno PERO recorta emails > ~102 KB de HTML ("ver mensaje completo") y elimina
  `<style>` en algunos contextos → estilos críticos inline.
- **Outlook Windows clásico**: motor de WORD. Aquí muere el CSS moderno: por eso existen las tablas, el
  botón bulletproof y los 600px. El nuevo Outlook usa el motor web (mejor), pero el clásico sigue vivo en empresas.
- Si el público es B2B español: prueba Outlook SIEMPRE. B2C: Gmail móvil + iPhone mandan.

## 2. Qué NO funciona (memoriza esto)
- En Outlook clásico: flexbox, grid, `max-width` fiable, border-radius (degrada a recto: acéptalo), background
  images (necesitan VML), márgenes en div, SVG, position. → estructura de TABLAS y estilos simples.
- En Gmail: `<style>` poco fiable (inline!), clases raras renombradas, fuentes web NO (fallback).
- En general: JS (nunca), vídeo embebido (usa imagen-poster con link), formularios dentro del email (link a
  la web), animaciones CSS (solo decorativas, con el estado inicial correcto como fallback).
- GIF: funciona casi en todo, pero Outlook clásico muestra SOLO el primer frame → que el primer frame valga por sí solo.

## 3. Cómo probar — escalera de rigor
1. **Preview de la herramienta** (react-email dev / MJML preview / Mailpit en local para transaccionales):
   estructura y copy. Nunca es suficiente por sí solo.
2. **Envíos reales a cuentas propias**: Gmail (app móvil + web), Outlook, iPhone Mail — claro y oscuro.
   Gratis y pilla el 80%. Ten las 3 cuentas de prueba montadas por proyecto.
3. **Litmus / Email on Acid / Testi@** (capturas en decenas de clientes): para el MASTER de newsletter o
   plantillas transaccionales importantes — una vez por plantilla, no por envío.
- Transaccionales en desarrollo: SIEMPRE contra Mailpit/Mailtrap (nunca SMTP real en local — un seeder
  que dispara emails a clientes reales es un incidente; ver skill deploy-ops, referencia envs-secrets).

## 4. Checklist antes de enviar (o de dar la plantilla por hecha)
- [ ] Render OK en Gmail móvil, Outlook y iPhone — claro Y oscuro (capturas en el devlog).
- [ ] Con imágenes BLOQUEADAS se entiende (alts puestos, CTA legible).
- [ ] Todos los enlaces clicados una vez (incluido el logo) y con https absoluto; UTM si es marketing.
- [ ] Asunto < 50 chars con lo importante al principio; preheader intencional; remitente reconocible.
- [ ] Versión texto plano generada y legible. Peso HTML < 100 KB (recorte de Gmail).
- [ ] Variables con datos reales de prueba (nombre vacío, pedido de 1 y de 20 líneas, importes con decimales).
- [ ] Newsletter: baja funciona, dirección física presente, lista correcta y segmento revisado DOS veces.

## 5. Entregabilidad mínima (que llegue, no solo que se vea)
- Dominio con **SPF + DKIM + DMARC** configurados (lo da el proveedor: Resend/Postmark/SES/Brevo — verifica
  el dominio, no envíes "en nombre de" gmail.com).
- Transaccional y marketing SEPARADOS (subdominios o proveedores distintos): que la newsletter no queme la
  reputación de los resets de contraseña.
- Calentamiento y limpieza de lista (bajas y bounces procesados por webhook: `integrations.md`); pie legal.
- Prueba de spam rápida: mail-tester.com antes del primer envío de una plantilla nueva.

## 6. Depurar "se ve roto en X"
1. Identifica el cliente y motor exacto (¿Outlook clásico? ¿Gmail app Android?).
2. Reduce: quita mitades del HTML hasta aislar el bloque que rompe (suele ser un estilo no soportado del §2).
3. Sustituye por el patrón compatible (tabla, inline, imagen) — no "hacks de una web" (position, negative margin).
4. Re-testea en ESE cliente + los 3 básicos (un fix de Outlook puede romper Gmail).
5. Documenta el hack en la plantilla con comentario (`<!-- Outlook: ... -->`) para el siguiente.
