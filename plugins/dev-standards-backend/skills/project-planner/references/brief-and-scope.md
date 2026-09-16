# Brief de trabajo y negociación de alcance

El brief es la página que convierte una petición ("hazme una landing") en un acuerdo
verificable. Se escribe antes del plan, cabe en una pantalla y vive en la cabecera de
`plan/PLAN.md` (sección "Brief"). Si el brief no está claro, el plan será ruido.

## Índice

- [Estructura del brief](#estructura-del-brief)
- [Reglas de redacción](#reglas-de-redacción)
- [Alcance IN/OUT](#alcance-inout)
- [Restricciones](#restricciones)
- [Definición de hecho global](#definición-de-hecho-global)
- [Supuestos y preguntas abiertas](#supuestos-y-preguntas-abiertas)
- [Negociar alcance: producto completo por fases](#negociar-alcance-producto-completo-por-fases)
- [Ejemplo: landing](#ejemplo-landing)
- [Ejemplo: módulo de facturación](#ejemplo-módulo-de-facturación)
- [Ejemplo: agente de soporte](#ejemplo-agente-de-soporte)
- [Checklist](#checklist)

## Estructura del brief

```markdown
## Brief
- Objetivo: <una frase: verbo + para quién + resultado>
- Usuarios: <quién lo usa y en qué contexto>
- Resultado observable: <qué se puede ver/probar cuando esté hecho>
- Alcance IN: <lista>
- Alcance OUT: <lista explícita de lo que NO se hace ahora>
- Restricciones: stack | plazo | marca | datos | legal
- Definición de hecho global: <criterios que aplican a todo el proyecto>
- Supuestos: <lo que damos por cierto sin confirmar>
- Preguntas abiertas: <pregunta -> dueño -> default si no hay respuesta>
```

Ocho apartados, ninguno opcional. "No aplica" es una respuesta válida; dejarlo en blanco no.

## Reglas de redacción

- Objetivo en UNA frase. Si necesita dos, hay dos proyectos.
- Resultado observable en términos de usuario, no de código: "el cliente descarga su factura
  en PDF desde su panel", no "endpoint de facturas implementado".
- Cada línea de OUT evita una discusión futura. Escribir lo que el usuario podría esperar
  y no va a recibir en esta entrega.
- Nada de adjetivos vacíos ("moderno", "robusto"). Sustituir por criterios medibles.
- Los supuestos se escriben aunque parezcan obvios; son los que más duelen cuando fallan.

## Alcance IN/OUT

IN se escribe como capacidades observables; OUT como exclusiones concretas con motivo breve.

```markdown
- Alcance IN:
  - Registro e inicio de sesión con email + contraseña.
  - Listado, creación y edición de proyectos por el propietario.
  - Invitación de miembros por email con rol lector/editor.
- Alcance OUT:
  - Login social (Google/GitHub): fase posterior, no bloquea el valor.
  - Facturación y planes de pago: no hay pasarela decidida.
  - App móvil nativa: la web es responsive y cubre el caso.
```

Prueba rápida: si un elemento de IN no se puede demostrar en una demo de 2 minutos, está mal
formulado o pertenece a una fase distinta.

## Restricciones

| Tipo | Preguntas que resuelve | Ejemplo |
|------|------------------------|---------|
| Stack | ¿Qué no se puede cambiar? | Laravel 12 + Inertia + Vue 3; sin añadir React |
| Plazo | ¿Hay fecha dura? ¿Qué debe estar para esa fecha? | Demo el 15/09: F1 y F2 completas |
| Marca | ¿Logo, paleta, tipografía, tono? | Paleta corporativa en `design-system/web/MASTER.md`; tono cercano, tuteo |
| Datos | ¿Datos reales? ¿Migraciones destructivas? ¿RGPD? | BD de producción; solo migraciones aditivas; datos personales cifrados en reposo |
| Legal/compliance | ¿Cookies, facturación legal, accesibilidad exigida? | Facturas con numeración correlativa sin huecos (ley española) |
| Operación | ¿Dónde se despliega? ¿Quién despliega? | Forge; despliega el usuario, nunca el agente |

Las restricciones se propagan a las tareas: una restricción de datos "sin migraciones
destructivas" aparece en la DoD de toda tarea de migración.

## Definición de hecho global

Criterios que se cumplen en TODAS las tareas además de la DoD por tipo
(ver `definition-of-done.md`). Se pactan una vez y no se renegocian por tarea.

```markdown
- Definición de hecho global:
  - Tests del módulo tocado pasan; lint y tipos limpios.
  - Sin secretos en el código; sin TODO sin issue asociado.
  - Entrada de devlog por tarea; commit Conventional.
  - UI responsive (360 px a 1440 px) y navegable por teclado.
  - Nunca se despliega sin aprobación explícita del usuario.
```

## Supuestos y preguntas abiertas

Supuesto = decisión tomada sin confirmar, reversible, anotada. Pregunta abierta = decisión que
no se puede tomar sin el usuario o que tiene coste alto si se equivoca.

```markdown
- Supuestos:
  - S1. El idioma de la UI es español; i18n se prepara pero solo se traduce ES.
  - S2. Los PDF se generan en servidor con DomPDF (ya en composer.json).
- Preguntas abiertas:
  | # | Pregunta | Dueño | Default si no hay respuesta | Bloquea |
  |---|----------|-------|------------------------------|---------|
  | Q1 | ¿Numeración de facturas por serie o global? | Usuario | Serie anual `2026-000001` | F2-T3 |
  | Q2 | ¿Pasarela: Stripe o Redsys? | Usuario | Stripe (SDK más simple) | F3 |
```

Cada pregunta tiene dueño, default y qué tarea bloquea. Si no bloquea nada, no es urgente.

## Negociar alcance: producto completo por fases

Principio: se construye el producto completo, no un MVP recortado que haya que tirar.
La negociación no quita funcionalidad; la ordena en fases que se entregan y usan por separado.

Cómo se negocia:

1. Escribir todo lo que el usuario pidió en IN, sin filtrar.
2. Agrupar en fases donde cada fase deja algo usable (ver `slicing-and-sequencing.md`).
3. Mover a OUT solo lo que no aporta valor en este ciclo o depende de decisiones externas.
4. Presentar al usuario: "F1 entrega X usable el día N; F2 añade Y; Z queda fuera porque W".
5. Si el usuario quiere todo en F1: mostrar el tamaño en tareas y proponer qué va primero.

Frases que ayudan:

- "Esto se hace completo, pero lo primero que podrás usar es ..."
- "Si aceptamos el default de Q2, F3 puede empezar sin esperar."
- "Sacar el login social a F4 no cambia el diseño; se añade sin tocar lo hecho."

Frases que se evitan: "MVP", "versión básica", "de momento lo hacemos simple". Todo lo que se
entrega en cada fase tiene calidad de producto (DoD completa), no de prototipo.

## Ejemplo: landing

```markdown
## Brief
- Objetivo: captar leads de empresas para el servicio de auditoría energética mediante una landing en Astro.
- Usuarios: responsables de operaciones de pymes, visitan desde móvil (60 %) tras un anuncio.
- Resultado observable: la landing carga en < 2 s, explica el servicio, muestra 3 casos y el formulario envía el lead al CRM con confirmación.
- Alcance IN: hero, propuesta de valor, 3 casos de éxito, FAQ, formulario con validación y envío a HubSpot, SEO básico, analítica.
- Alcance OUT: blog (sin contenido aún); multi-idioma (solo ES); calculadora de ahorro (F3 si hay tiempo).
- Restricciones: Astro 5 + Tailwind; marca existente (logo y paleta en `brand/`); plazo 10 días; RGPD con checkbox de consentimiento.
- DoD global: Lighthouse ≥ 90 en móvil, a11y AA, responsive 360-1440, devlog por tarea.
- Supuestos: S1 API key de HubSpot disponible en `.env`; S2 copy lo redacta el agente y lo revisa el usuario.
- Preguntas abiertas: Q1 ¿Dominio y hosting? (Usuario; default Vercel; bloquea F2-T4).
```

## Ejemplo: módulo de facturación

```markdown
## Brief
- Objetivo: permitir a los administradores emitir, enviar y cobrar facturas desde la app Laravel existente.
- Usuarios: 3 administradores internos; clientes finales reciben PDF por email y ven sus facturas en su panel.
- Resultado observable: desde un pedido cerrado se emite una factura numerada, se genera el PDF, se envía por email y el cliente la ve en `/mi-cuenta/facturas`.
- Alcance IN: entidad Factura con líneas e impuestos; numeración correlativa por serie; PDF; envío por email; listado admin con filtros; panel cliente; rectificativas.
- Alcance OUT: cobro online (Q2 pendiente); contabilidad/exportación a gestoría (F4); multi-moneda.
- Restricciones: Laravel 12 + Inertia + Vue; BD de producción, migraciones solo aditivas; ley española de facturación; design system admin existente.
- DoD global: tests Pest por caso de uso; sin huecos de numeración bajo concurrencia; devlog; commits Conventional.
- Supuestos: S1 DomPDF para PDF; S2 el IVA es único (21 %) hasta que Q1 diga lo contrario.
- Preguntas abiertas: Q1 tipos de IVA (Usuario; default 21 %; bloquea F2-T2). Q2 pasarela (Usuario; default Stripe; bloquea F3).
```

Aquí el dominio es rico (numeración, rectificativas, impuestos): el plan asignará
`ddd-hexagonal` al núcleo y `code-quality php-laravel` al resto.

## Ejemplo: agente de soporte

```markdown
## Brief
- Objetivo: responder tickets de soporte de primer nivel con un agente LangGraph que consulta la base de conocimiento y escala al humano cuando no está seguro.
- Usuarios: clientes que escriben por el widget web; agentes humanos que reciben escalados.
- Resultado observable: un ticket de prueba sobre "cambiar contraseña" se responde correctamente citando el artículo; uno sobre "reembolso" se escala con resumen.
- Alcance IN: grafo con nodos clasificar -> buscar -> responder -> escalar; API FastAPI `/chat`; ingesta de la KB (Markdown); trazas; evaluación con 30 casos.
- Alcance OUT: voz; integración con Zendesk (F4); aprendizaje continuo.
- Restricciones: Python 3.12 + LangGraph + FastAPI; modelo Claude vía API con clave del usuario; datos de clientes no salen del sistema salvo al proveedor LLM; presupuesto de tokens por conversación.
- DoD global: pytest por nodo; evaluación ≥ 85 % en los 30 casos; sin PII en logs; devlog.
- Supuestos: S1 KB en `kb/*.md`; S2 embeddings locales; S3 umbral de confianza 0,7 ajustable.
- Preguntas abiertas: Q1 ¿quién recibe los escalados y por qué canal? (Usuario; default email; bloquea F2-T5).
```

## Checklist

- [ ] Objetivo en una frase con verbo, usuario y resultado.
- [ ] Resultado observable demostrable en una demo corta.
- [ ] IN como capacidades; OUT explícito con motivo.
- [ ] Restricciones de stack, plazo, marca, datos y operación rellenas o "no aplica".
- [ ] DoD global pactada y coherente con `definition-of-done.md`.
- [ ] Supuestos numerados (S1..Sn), reversibles y anotados.
- [ ] Preguntas con dueño, default y tarea bloqueada.
- [ ] Alcance negociado como producto completo por fases; ninguna fase es un prototipo.
- [ ] Brief copiado en la cabecera de `plan/PLAN.md`.
