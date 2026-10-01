# Estimación y presupuesto (/estimar)

Convierte un brief o un plan en horas, coste y riesgos que se puedan poner en un presupuesto y
defender delante del cliente. Una estimación es un **rango con supuestos**, nunca un número suelto.

Índice: 1 De dónde sale · 2 Horas por tarea · 3 Lo que siempre se olvida · 4 Riesgo e incertidumbre ·
5 Rango final · 6 Presupuesto · 7 Salida · 8 Errores típicos

## 1. De dónde sale la estimación
- Con `senzu/plan/PLAN.md`: se estima tarjeta a tarjeta (lo más fiable).
- Solo con brief o una descripción: primero se trocea en fases y tareas S/M/L con el mismo criterio
  del plan (`plan-format.md`), aunque no se escriba el plan completo. **Sin troceo no se estima.**
- Si falta información que cambia el tamaño (¿hay pasarela de pago?, ¿cuántos idiomas?, ¿quién pone
  los textos?), se pregunta ANTES; lo que no se pueda saber se convierte en supuesto escrito.

## 2. Horas por tarea (tres valores)
Para cada tarea, optimista (O), probable (P) y pesimista (Pe). Referencia de los tamaños del plan:
| Tamaño | O | P | Pe |
|---|---|---|---|
| S | 0,5 h | 1 h | 2 h |
| M | 2 h | 3 h | 5 h |
| L | 5 h | 8 h | 14 h |
Esperado por tarea (PERT) = (O + 4·P + Pe) / 6. Ajusta los valores por tarea si la conoces mejor que
la tabla (una integración con una API mal documentada no es una M normal).

## 3. Lo que siempre se olvida (añádelo como partidas propias)
| Partida | Referencia orientativa |
|---|---|
| Descubrimiento, brief y propuestas de diseño | 4-12 h según tamaño |
| Reuniones y comunicación con el cliente | 10-15% del desarrollo |
| Contenido (textos, fotos, traducciones) si lo pone la agencia | Aparte, por página o por idioma |
| QA: revisión en móvil, navegadores y accesibilidad | 10-15% del desarrollo |
| Rondas de cambios del cliente | 2 rondas incluidas; el resto, aparte |
| Despliegue, dominio, SSL, analítica y SEO técnico | 4-8 h |
| Entrega: manual, formación y traspaso (`/entregar`) | 2-6 h |
| Gestión del proyecto | 10% del total |

## 4. Riesgo e incertidumbre
- **Riesgos concretos**, cada uno con su efecto en horas: "API del ERP sin documentación: +8-16 h".
- **Factor de incertidumbre** sobre el total según lo definido que esté:
  proyecto muy definido ×1,1 · normal ×1,25 · con incógnitas importantes ×1,5.
  Si el factor sería mayor, la estimación no es fiable: propón una fase de descubrimiento pagada.

## 5. Rango final
- **Mínimo**: suma de optimistas + partidas.
- **Previsto**: suma de esperados + partidas, por el factor de incertidumbre.
- **Máximo**: suma de pesimistas + partidas + riesgos.
El presupuesto se hace sobre el **previsto**; el máximo sirve para decidir el colchón y los hitos.

## 6. Presupuesto
- Horas × tarifa del proyecto (la que indique el usuario; no la inventes).
- Por **fases entregables** (las del plan): el cliente ve qué recibe en cada una y se puede facturar por hitos.
- **Qué incluye y qué no**, explícito: número de páginas, idiomas, rondas de cambios, contenido,
  mantenimiento posterior, licencias y servicios de terceros (hosting, plugins de pago, APIs).

## 7. Salida
`senzu/plan/estimacion.md` con: resumen (rango y previsto), tabla por fase (horas mínimo, previsto y máximo;
importe si hay tarifa), partidas añadidas, riesgos con su efecto, supuestos, exclusiones y lo que
cambiaría la estimación. Lenguaje para el cliente en el resumen; detalle técnico debajo.

## 8. Errores típicos
- Estimar solo el desarrollo (olvidar reuniones, QA, cambios, contenido y despliegue).
- Dar un número en vez de un rango; o un rango sin supuestos.
- Estimar sin trocear ("una web corporativa son unas 40 horas").
- Esconder el riesgo en una tarifa alta en vez de escribirlo: si ocurre, no hay cómo explicarlo.
