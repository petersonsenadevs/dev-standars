# Checklist de lanzamiento (/lanzar): antes de publicar una web

Se pasa ENTERA antes del primer deploy público (y en resumen tras cambios grandes). Cada punto se marca
con evidencia (comando, captura o URL), no de memoria. Veredicto final: LISTA / LISTA con menores / NO.

## 1. Verificación técnica (bloqueante)
- [ ] `verify-build.ps1` en verde (lint, types, tests, build) — salida pegada.
- [ ] `verify-ui.mjs` en 0 problemas en las rutas clave (home + 1 interior + contacto), móvil primero.
- [ ] Crítica visual de capturas hecha (`visual-critique.md`) con veredicto APTA.
- [ ] Formularios probados DE VERDAD: envío llega (email/CRM), validación, mensaje de éxito, y el
  destinatario confirmado con el cliente (el clásico: formulario que envía a un email que nadie mira).
- [ ] 404 personalizada; enlaces internos sin rotos (crawl rápido o click por el menú completo).

## 2. SEO técnico
- [ ] `<title>` y `meta description` únicos por página (patrón: "Servicio en Ciudad | Marca").
- [ ] Open Graph completo (og:title/description/image 1200×630 + twitter:card) — probado con un validador.
- [ ] JSON-LD según negocio (LocalBusiness/Service/Product/FAQPage) validado en validator.schema.org.
- [ ] `sitemap.xml` generado y `robots.txt` correcto (¡que no bloquee todo por un noindex de staging!).
- [ ] Canonicals; hreflang si hay idiomas (`code-quality §references/i18n.md`).
- [ ] Un H1 por página; imágenes con alt; URLs limpias sin querystrings raros.

## 3. Rendimiento
- [ ] PageSpeed (pagespeed.web.dev) móvil: LCP < 2,5 s, CLS < 0,1 — sobre la URL real o preview.
- [ ] Imágenes WebP/AVIF con dimensiones; hero con `fetchpriority="high"`; lazy bajo el fold.
- [ ] Fuentes: solo pesos usados, `display=swap` o self-host; sin librerías JS muertas en el bundle.

## 4. Analítica y medición
- [ ] Analítica instalada (GA4/Matomo/Plausible) DETRÁS del consentimiento (Consent Mode si GA4).
- [ ] Eventos del plan de medición (`ui-ux-pro-max §references/es/measurement.md`): al menos las
  conversiones del negocio (llamada, formulario, WhatsApp, compra) disparando — probado en tiempo real.
- [ ] Search Console dada de alta (verificación + sitemap enviado); teléfono con `tel:` clicable medido.

## 5. Legales (España/UE — mínimo RGPD/LSSI)
- [ ] Aviso legal (titular, NIF, dirección), Política de privacidad y de Cookies accesibles desde el footer.
- [ ] Banner de consentimiento REAL (bloquea cookies no esenciales hasta aceptar; botón rechazar visible).
- [ ] Formularios con checkbox de privacidad no premarcado + doble opt-in si hay newsletter.

## 6. Dominio, SSL y entrega
- [ ] HTTPS forzado; www ↔ raíz con redirect 301 a UNA canónica; SSL válido (no el de preview).
- [ ] Favicon + `site.webmanifest` + iconos (realfavicongenerator); `theme-color`.
- [ ] Emails del dominio (formularios/transaccionales): SPF/DKIM/DMARC para no caer en spam
  (`code-quality §references/integrations.md` §Email).
- [ ] Redirecciones desde la web antigua si la hay (mapa de URLs viejas → nuevas, 301).
- [ ] Backup/rollback claro: se puede volver a la versión anterior en minutos.

## 7. Contenido final
- [ ] Cero lorem ipsum, cero imágenes placeholder, teléfonos/horarios/precios confirmados por el cliente.
- [ ] Datos de contacto idénticos a la ficha de Google Business (NAP).
- [ ] gustos.md repasado: nada vetado se ha colado en la versión final.

## Registro
El resultado (checklist con evidencias + veredicto) va al devlog y, si hay plan, cierra la tarjeta de
lanzamiento. Lo que quede "con menores" se convierte en tarjetas X-Tn con fecha.
