# Construir emails: herramientas, estructura y receta por tipo

Índice: 1 Elegir herramienta · 2 Esqueleto que no se rompe · 3 Botón bulletproof · 4 Dark mode ·
5 Transaccionales (receta) · 6 Newsletter (receta) · 7 Errores típicos

## 1. Elegir herramienta (nunca HTML a pelo si puedes evitarlo)
- **react-email**: proyectos TS/React (Next, Node). Componentes (`<Button>`, `<Section>`) → HTML compatible;
  preview local con `email dev`; se integra con Resend/Nodemailer. La opción por defecto en stacks JS.
- **MJML**: agnóstico de stack. `<mj-section><mj-column>` → tablas responsive compiladas; ideal para
  newsletters maquetadas. Compila en build o con la CLI, y el HTML resultante se versiona.
- **Laravel**: Markdown Mailables (`php artisan make:mail --markdown`) para transaccionales — tema propio
  publicando las vistas (`vendor:publish --tag=laravel-mail`) con los colores del design system.
- **Plantilla del ESP** (Mailchimp/Brevo) para newsletters que edita el cliente: tú defines el master.
- HTML de tablas a mano: solo para retocar algo heredado — y entonces cada cambio se prueba (referencia 2).

## 2. Esqueleto que no se rompe
- Contenedor de **600px** centrado sobre fondo de color; dentro, secciones apiladas de una columna.
- Tipografía: system stack (`-apple-system, Segoe UI, Roboto, Arial`) con web font opcional ENCIMA
  (Apple Mail la mostrará, Outlook usará el fallback — elige fallback con métricas parecidas).
- Tamaños: cuerpo 16px/1.5, títulos 22–28px. Padding generoso (24–32px) en vez de márgenes (Outlook los ignora a ratos).
- Footer siempre: quién envía, dirección física, motivo del email, baja (si marketing), enlaces legales.
- Responsive: las herramientas del §1 lo traen (columnas que apilan); si es a mano, media query + `width:100%`
  en móvil sabiendo que algunos clientes la ignoran — por eso una columna es el diseño seguro.

## 3. Botón bulletproof (el CTA que se puede pulsar en todo)
```html
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td bgcolor="#4F46E5" style="border-radius:8px">
    <a href="https://..." target="_blank"
       style="display:inline-block;padding:14px 32px;color:#ffffff;text-decoration:none;
              font-weight:bold;font-family:Arial,sans-serif">Confirmar pedido</a>
  </td>
</tr></table>
```
Padding en el `<a>` con `display:inline-block` + color de fondo en la CELDA: pulsable entero también en Outlook.
(react-email/MJML generan esto solos con su componente de botón.)

## 4. Dark mode
- Gmail/Outlook INVIERTEN colores a su bola; Apple Mail respeta `@media (prefers-color-scheme: dark)`.
- Defensas: logo PNG con trazo que funcione sobre claro Y oscuro (o borde/halo transparente), no confiar
  en negro puro (#000 se invierte feo: usa grises oscuros), probar el render oscuro SIEMPRE (referencia 2).
- No luches por pixel-perfect en dark: busca "legible y con la marca reconocible".

## 5. Transaccionales — receta (bienvenida, pedido, reset...)
- Un objetivo por email y el dato clave ARRIBA (nº de pedido, botón de reset): se leen en la bandeja en 3 s.
- Asunto informativo, no marketiniano ("Tu pedido #1234 está en camino"); preheader con el detalle siguiente.
- Personalización con fallback (`Hola {nombre|,}`) — nunca "Hola ," en producción.
- Contenido dinámico (líneas de pedido) = bucle de la plantilla probado con 1, 3 y 20 items.
- El reset/verificación: enlace con expiración clara en el texto y URL también en texto plano por si el botón falla.

## 6. Newsletter — receta
- Jerarquía de UNA historia principal (imagen + titular + párrafo + CTA) y 2–4 secundarias en lista; no
  un periódico. Si todo es importante, nada lo es.
- Imágenes ~50% del alto máximo: debe aguantar el mensaje con imágenes bloqueadas.
- UTM en todos los enlaces (`utm_source=newsletter&utm_medium=email&utm_campaign=<slug>`).
- Reutiliza un MASTER versionado (MJML/react-email) con slots; no se maqueta de cero cada mes.

## 7. Errores típicos del agente
- Maquetar como una web (flex/grid/svg inline) y "en Outlook sale en columna única rota".
- CSS en `<style>` sin inline/compilar · imágenes en localhost o rutas relativas · sin alt.
- Botón que solo es un `<a>` con padding (media zona no clicable en Outlook) · 4 CTAs compitiendo.
- Olvidar texto plano y preheader · "Hola ," · probar solo en el navegador (referencia 2 SIEMPRE).
