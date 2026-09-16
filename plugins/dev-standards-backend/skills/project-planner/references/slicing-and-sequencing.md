# Trocear y ordenar el trabajo

Un plan bueno no es una lista de capas ("primero la base de datos, luego el backend, luego
el front"), sino una secuencia de cortes verticales que dejan algo funcionando cada pocas
horas. Este documento explica cómo cortar, en qué orden y con qué tamaño.

## Índice

- [Vertical frente a horizontal](#vertical-frente-a-horizontal)
- [Walking skeleton](#walking-skeleton)
- [Tamaño ideal de tarea](#tamaño-ideal-de-tarea)
- [Orden por riesgo e incertidumbre](#orden-por-riesgo-e-incertidumbre)
- [Orden por dependencias](#orden-por-dependencias)
- [Qué paralelizar](#qué-paralelizar)
- [Hitos verificables por el usuario](#hitos-verificables-por-el-usuario)
- [Mal troceado y su corrección](#mal-troceado-y-su-corrección)
- [Checklist](#checklist)

## Vertical frente a horizontal

**Corte horizontal** (evitar): una tarea por capa. "Crear todas las migraciones", "hacer todos
los endpoints", "hacer todas las pantallas". Nada funciona hasta el final; los errores de
integración aparecen tarde; el usuario no puede opinar hasta la última semana.

**Corte vertical** (preferir): una tarea o un grupo pequeño de tareas atraviesa todas las
capas para UN caso de uso: ruta + caso de uso + persistencia + UI mínima + test.

```
Horizontal                      Vertical
┌──────── UI (todas) ────────┐  ┌───┐┌───┐┌───┐
├──── endpoints (todos) ─────┤  │ U ││ U ││ U │
├──── casos de uso (todos) ──┤  │ E ││ E ││ E │
├──── migraciones (todas) ───┤  │ C ││ C ││ C │
└────────────────────────────┘  │ M ││ M ││ M │
                                └───┘└───┘└───┘
                                crear listar editar
```

Cada columna vertical se puede enseñar, probar y desplegar por separado. Si una tarea sola es
demasiado grande para atravesar todas las capas, se divide en 2-3 tarjetas con dependencia
lineal (T1 datos+dominio, T2 ruta+caso de uso, T3 UI), pero dentro de la misma fase y
para el mismo caso de uso.

## Walking skeleton

El walking skeleton es F1 en todo plan: la implementación más pequeña posible del camino
completo, con calidad de producto en lo que incluye y sin nada de lo que no incluye.

Qué contiene siempre:

- Un caso de uso principal de extremo a extremo (el que da nombre al proyecto).
- Persistencia real (migración, no datos en memoria) si el producto la tendrá.
- UI mínima pero con el design system aplicado (no HTML sin estilo).
- Un test de feature que recorre el camino.
- Infraestructura de trabajo: devlog, `.env.example`, script de test, lint, CI mínima.

Qué NO contiene: casos secundarios, validaciones exhaustivas, roles, emails, animaciones,
optimizaciones. Todo eso son fases posteriores que se apoyan en el esqueleto.

Ejemplo (facturación): "desde un pedido cerrado se crea una factura numerada y aparece en el
listado admin". Sin PDF, sin email, sin panel de cliente. Cuatro tareas, un día y medio.

Ejemplo (landing): "la página carga con hero, una sección y un formulario que envía al CRM".
Sin animaciones, sin casos de éxito, sin FAQ. Tres tareas, medio día.

## Tamaño ideal de tarea

| Tamaño | Duración | Uso |
|--------|----------|-----|
| S | ≤ 1 h | Migración, componente pequeño, test, documentación, ajuste |
| M | ≤ 3 h | Caso de uso con tests, página completa, endpoint con validación |
| L | ≤ 1 día | Solo en planificación inicial; se divide antes de ejecutar |

Señales de que una tarea es demasiado grande: el título tiene "y" ("crear modelo y endpoint y
página"), toca más de 6 archivos previstos, requiere más de dos skills, o la verificación
necesita más de un comando y una captura.

Señales de que es demasiado pequeña: no tiene verificación propia, o su devlog sería una
línea. Fusionar con la vecina.

Objetivo práctico: 3-8 tareas por fase, 60-70 % de tamaño M.

## Orden por riesgo e incertidumbre

Primero lo que puede tirar el plan. Preguntas que ordenan:

1. ¿Qué parte no sé cómo hacer? (integración externa nueva, algoritmo, rendimiento)
2. ¿Qué parte, si sale mal, obliga a rediseñar el resto? (modelo de datos, numeración legal, auth)
3. ¿Qué parte necesita feedback del usuario para no desperdiciar trabajo? (diseño, flujo)

Lo incierto va al principio de la fase, como tarea S de "spike" con salida escrita
(devlog + decisión), o como primera tarea real. Lo conocido y mecánico va al final: se hace
rápido y no cambia nada.

Ejemplo: en el agente de soporte, la clasificación con umbral de confianza es lo incierto:
F1-T1 es un spike de 1 h con 10 tickets reales antes de construir el grafo completo.

## Orden por dependencias

Reglas mecánicas:

- Una tarea solo depende de tareas de su fase o de fases anteriores.
- Las dependencias se escriben explícitas en la tarjeta ("Depende de:").
- Cadenas largas (T1 -> T2 -> T3 -> T4 -> T5) indican corte horizontal encubierto: revisar.
- Si dos tareas se dependen mutuamente, son una sola tarea mal dividida.

Orden típico dentro de un slice vertical: datos/dominio -> caso de uso -> ruta/endpoint ->
UI -> documentación de cierre. Se invierte (UI primero con datos falsos) cuando el riesgo
está en el diseño (ver `skill-map.md` "Combinar dos skills").

## Qué paralelizar

El agente ejecuta una tarea a la vez, pero el plan puede tener ramas independientes para que
el usuario o un segundo agente avancen sin colisionar:

- Paralelizable: tareas sin dependencia entre sí que tocan archivos distintos (p. ej.
  "PDF de factura" y "panel de cliente" tras el esqueleto).
- No paralelizable: dos tareas que tocan la misma migración, el mismo componente o el mismo
  archivo de rutas; una tarea de refactor con cualquier otra del mismo módulo.

En la tarjeta no hay campo "paralelo"; basta con que "Depende de" esté vacío o apunte a
tareas ya `done`. El planner puede señalarlo en la fase: "T2 y T3 son independientes".

## Hitos verificables por el usuario

Cada fase termina en un hito que el usuario puede comprobar sin leer código, en menos de
5 minutos, siguiendo instrucciones escritas en el devlog de fase:

```markdown
### Hito F1 — cómo comprobarlo
1. `php artisan migrate:fresh --seed && php artisan serve`
2. Entrar en http://localhost:8000/admin/pedidos/1 y pulsar "Emitir factura".
3. Ir a http://localhost:8000/admin/facturas: aparece F-2026-000001 con total 121,00 €.
```

Si un hito no se puede describir así, la fase no está bien definida. Los hitos también son
el punto natural para preguntas de alcance y para la retro corta (`replanning-and-risks.md`).

## Mal troceado y su corrección

**Caso 1: por capas.**
Mal: F1-T1 "Todas las migraciones", F1-T2 "Todos los modelos", F1-T3 "Todos los endpoints",
F1-T4 "Todas las páginas".
Bien: F1-T1 "Migración y modelo Factura", F1-T2 "Caso de uso EmitirFactura", F1-T3 "Ruta y
página de listado". F2 añade PDF, F3 panel de cliente, cada una vertical.

**Caso 2: tarea gigante con "y".**
Mal: F2-T1 "Implementar PDF, email y descarga desde el panel" (L).
Bien: F2-T1 "Generar PDF" (M), F2-T2 "Enviar por email con job" (S, depende de T1), F2-T3
"Descargar desde el panel" (M, depende de T1). T2 y T3 independientes.

**Caso 3: UI sin datos reales hasta el final.**
Mal: F1 solo backend; F2 solo front. El usuario ve algo en F2.
Bien: F1 incluye la página de listado mínima con design system. El usuario ve algo el
primer día.

**Caso 4: la incertidumbre al final.**
Mal: la integración con la pasarela de pago es F4-T6.
Bien: F1-T1 spike de 1 h: crear un cargo de prueba con la SDK y anotar límites. Si no funciona,
el plan cambia antes de haber construido todo lo demás encima.

**Caso 5: tareas sin verificación.**
Mal: "Mejorar el rendimiento del listado" (¿cuánto? ¿cómo se sabe?).
Bien: "Eliminar N+1 en listado de facturas: de 45 consultas a ≤ 5 con 50 filas; verificar con
`DB::enableQueryLog()` en test y pegar recuento".

**Caso 6: refactor mezclado con feature.**
Mal: "Añadir rectificativas y de paso reorganizar el módulo en DDD".
Bien: F3-T1 "Extraer casos de uso existentes a Application (sin cambiar comportamiento; tests
verdes antes y después)", F3-T2 "Añadir rectificativas". El refactor primero, aislado, con
la red de tests como verificación.

## Checklist

- [ ] F1 es un walking skeleton de extremo a extremo con infraestructura de trabajo.
- [ ] Cada fase entrega algo que el usuario puede comprobar en 5 minutos.
- [ ] Las tareas son verticales; no hay "todas las X" en ningún título.
- [ ] Ninguna tarea L sin dividir; ningún título con "y" que una dos entregables.
- [ ] Lo incierto o arriesgado está al principio (spike o primera tarea).
- [ ] Dependencias explícitas; sin cadenas largas ni ciclos.
- [ ] Refactors separados de features, con tests como red.
- [ ] Toda tarea tiene una verificación concreta y reproducible.
