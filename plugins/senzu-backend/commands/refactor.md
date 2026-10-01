---
description: Refactor seguro — tests de caracterización primero, pasos pequeños verificados y mismo comportamiento demostrado
---

Uso: `/refactor <objetivo, p. ej. "sacar la lógica de precios de OrderController">` — el argumento es opcional salvo que se indique lo contrario; si no llega, aplica el comportamiento por defecto de abajo.

Aplica `backend-audit §references/refactor-seguro.md` para: lo que el usuario escribió tras el comando

1. **Objetivo en una frase** y por qué (si viene de `/auditar`, enlaza el hallazgo). Rama propia.
2. **Suite en verde antes de empezar** (`/verificar`). Si está en rojo, dilo y para: primero se arregla.
3. **Tests de caracterización** que congelan el comportamiento actual del código a tocar. Rompe algo a
   propósito para comprobar que los tests lo detectan y deshaz el cambio.
4. **Pasos pequeños**: un cambio de estructura por paso, tests en verde después de cada uno, commit
   `refactor(...)` por paso o grupo pequeño. Si un paso rompe algo, se deshace; no se arregla hacia delante.
5. Si aparece un bug real: anótalo, termina el paso actual en verde y arréglalo aparte con su propio test.
6. **Cierre**: `/verificar` en verde, devlog con el antes y el después (tamaño, complejidad o
   dependencias si hay métricas) y la tarjeta del plan marcada como hecha.

Refactor = misma conducta, distinta estructura. Si el comportamiento tiene que cambiar, es otra tarea.
