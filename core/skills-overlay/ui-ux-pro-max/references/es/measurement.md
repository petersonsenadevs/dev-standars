# Plan de medición: qué medir según el negocio

Sin medición, "la web funciona" es una opinión. El plan se define en el brief (1 tabla), se implementa
antes de lanzar y se comprueba en `/lanzar` §4. Herramienta: GA4 con Consent Mode v2 tras el banner,
o Plausible/Matomo si el cliente quiere evitar cookies (más simple legalmente).

## 1. Reglas
1. **2-5 conversiones por web**, no 40 eventos. Lo que mueve el negocio, medible y accionable.
2. Nada de PII en eventos ni URLs (ni email ni teléfono del visitante como parámetro).
3. Detrás del consentimiento SIEMPRE (Consent Mode v2 en GA4); probado en tiempo real antes de lanzar.
4. Nombres de evento estables y en snake_case (`click_llamar`, `form_presupuesto`); documentados en
   `plan/brief.md` §Medición para que el cliente y el futuro tú sepan qué significa cada uno.
5. UTM en toda campaña externa (`?utm_source=google_business&utm_medium=perfil`); enlaces internos SIN utm.

## 2. Conversiones por tipo de negocio
| Negocio | Conversiones (eventos) | Secundarias |
|---|---|---|
| Servicio local (reformas, escombros…) | `click_llamar` (tel:), `click_whatsapp`, `form_presupuesto` | scroll a galería, click en zona de servicio |
| Restaurante | `click_reservar`, `click_llamar`, `ver_carta` | click cómo-llegar (mapa) |
| Clínica/salud | `form_cita`, `click_llamar` | ver tratamiento concreto |
| E-commerce | `purchase` (+ `add_to_cart`, `begin_checkout` del estándar GA4) | ver ficha, uso del buscador |
| SaaS | `sign_up`, `demo_request` | `pricing_view`, inicio de trial |
| Academia | `form_inscripcion`, `click_llamar` | descarga de temario |
| Inmobiliaria | `form_valoracion`, `contacto_ficha` | filtros usados, favoritos |
| Hotel/turismo | `click_reservar` (motor/booking), `click_llamar` | ver habitación |

## 3. Implementación (patrón único)
- Eventos por atributo, no listeners dispersos: `data-track="click_llamar"` en el elemento y UN listener
  global que lee el atributo y hace `gtag('event', name)` (o `plausible(name)`). Así el copy/diseño puede
  cambiar sin romper la medición.
- `tel:` y `wa.me` SIEMPRE con data-track (son LA conversión del negocio local y nadie las mide).
- Formularios: evento en el ÉXITO del envío (no en el click del botón).
- SPA/View Transitions: page_view manual en cada navegación (GA4 no las ve solo).

## 4. Cierre del círculo
- Search Console conectada (además de analítica): qué búsquedas traen a la gente.
- Al cliente se le enseña UN número al mes ("12 llamadas y 9 formularios desde la web"), no el dashboard.
- A los 30 días del lanzamiento: revisar si las conversiones disparan de verdad y si el contenido más
  visto coincide con lo que el negocio quiere vender (si no, es input para la siguiente iteración).
