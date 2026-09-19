# Analítica y Google Tag Manager (el contenedor bien hecho)

## Índice
- [Decisión: gtag directo vs GTM](#decisión-gtag-directo-vs-gtm)
- [Estructura del contenedor](#estructura-del-contenedor)
- [dataLayer: el contrato con el código](#datalayer-el-contrato-con-el-código)
- [Consent Mode v2](#consent-mode-v2)
- [Depurar y publicar](#depurar-y-publicar)
- [Server-side (cuándo)](#server-side-cuándo)
- [Checklist](#checklist)

El QUÉ medir viene de `ui-ux-pro-max §references/es/measurement.md` (2-5 conversiones por negocio);
esto es el CÓMO instrumentarlo sin que el contenedor se convierta en un vertedero.

## Decisión: gtag directo vs GTM
- **gtag directo** (script GA4 en el `<head>` + eventos por código): suficiente cuando solo hay GA4 y
  los eventos del plan. Menos piezas, menos peso, todo versionado en el repo.
- **GTM (contenedor)** cuando: hay VARIOS tags (GA4 + Google Ads + Meta Pixel + Hotjar…), marketing
  publica cambios sin tocar código, o hay varios sitios con la misma instrumentación. El contenedor
  centraliza; el código solo empuja `dataLayer`.
- Nunca ambos a la vez para lo mismo (GA4 por gtag Y por GTM = eventos duplicados, el clásico).

## Estructura del contenedor
- **Convención de nombres** (sin ella, el contenedor muere): `GA4 - Evento - click_llamar`,
  `Trigger - Click - Teléfono`, `Var - DL - valor_pedido`. Tipo primero, qué después.
- Un tag de configuración GA4 (o Google tag) + un tag por evento del plan; triggers sobre atributos
  estables (`data-track`), NUNCA sobre clases CSS o textos de botón (cambian con el diseño y la
  medición muere en silencio).
- Carpetas por finalidad (Analytics / Ads / Consent); lo que no se sabe qué hace, se pausa y documenta.
- Variables integradas justas + las del dataLayer; nada de scraping del DOM si se puede empujar el dato.

## dataLayer: el contrato con el código
```js
// El código empuja hechos de negocio; GTM decide qué hacer con ellos.
window.dataLayer = window.dataLayer || [];
dataLayer.push({ event: 'form_presupuesto', form_id: 'contacto', servicio: 'escombros' });
// E-commerce: usa el esquema estándar GA4 (add_to_cart, begin_checkout, purchase con items[])
```
- El push va en el ÉXITO de la acción (envío ok, no click del botón) — regla de measurement.md.
- Los nombres de evento del dataLayer = los del plan de medición, documentados en `plan/brief.md`
  §Medición. Cambiar un nombre = cambiar plan + código + contenedor a la vez.
- SPA/View Transitions: empuja `page_view` virtual en cada navegación (GA4 no las ve solo).
- Nunca PII en el dataLayer (ni email ni teléfono del visitante).

## Consent Mode v2
- Obligatorio con GA4/Ads en la UE: el banner (CMP) actualiza `consent` ANTES de que disparen los tags.
- En GTM: consent por defecto `denied` (region ES/EU), el CMP hace `gtag('consent','update',…)` al
  aceptar; cada tag revisado en su pestaña de consentimiento (los de marketing exigen `ad_storage`).
- Probar los DOS caminos: rechazar (no deben salir hits con cookies) y aceptar (salen). El banner que
  "bloquea" pero los tags disparan igual es el fallo nº 1 en auditorías.

## Depurar y publicar
1. **Preview de GTM** (Tag Assistant): navega el flujo completo y verifica qué tag dispara con qué
   trigger y qué variables lleva.
2. **DebugView de GA4**: los eventos llegan con sus parámetros correctos.
3. Conversiones marcadas como key events en GA4 (y enlazadas a Ads si hay campañas).
4. Publicar SIEMPRE con nombre y descripción de versión ("v12 — evento form_presupuesto"): el historial
  de versiones es tu git del contenedor; ante un desastre, restaurar versión anterior.
5. El acceso al contenedor y a GA4 es del CLIENTE (su cuenta, tú como usuario): nunca en cuentas de la
   agencia de las que el cliente no pueda salir.

## Server-side (cuándo)
Contenedor server (p. ej. en subdominio propio) solo cuando el proyecto lo justifica: pérdida notable
por bloqueadores/ITP, requisitos de first-party, o volumen de Ads serio. Añade coste (hosting) y
mantenimiento — para la web local típica, el contenedor web con Consent Mode bien hecho es suficiente.

## Checklist
- [ ] Decisión gtag vs GTM justificada; sin doble instrumentación.
- [ ] Nombres con convención; triggers sobre `data-track`, no sobre clases.
- [ ] dataLayer con los eventos EXACTOS del plan de medición; push en el éxito; sin PII.
- [ ] Consent Mode v2 probado en ambos caminos (rechazar/aceptar).
- [ ] Preview + DebugView verificados; conversiones marcadas; versión publicada con descripción.
- [ ] Cuenta y contenedor propiedad del cliente.
