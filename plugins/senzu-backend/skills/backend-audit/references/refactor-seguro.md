# Refactor seguro (/refactor)

Refactorizar es cambiar la estructura **sin cambiar el comportamiento**. Si el comportamiento cambia,
no es un refactor: es una feature o un bug. Todo el protocolo existe para poder demostrar eso.

Índice: 1 Antes de tocar nada · 2 Tests de caracterización · 3 Pasos pequeños · 4 Técnicas por caso ·
5 Estrangular código legado · 6 Cuándo parar · 7 Cierre

## 1. Antes de tocar nada
- **Objetivo en una frase** y por qué ahora ("sacar el cálculo de precios del controlador porque es el
  hotspot nº 1 y cada cambio rompe algo"). Si viene de una auditoría, enlaza el hallazgo.
- **Rama propia** y árbol limpio. Nada de refactor mezclado con una feature en el mismo commit.
- **Suite en verde AHORA** (`/verificar`). Si ya está en rojo, primero se arregla o se aísla: sobre una
  base rota no se puede demostrar que el refactor no rompe nada.

## 2. Tests de caracterización (la red de seguridad)
Congelan lo que el código HACE hoy, aunque esté mal:
1. Localiza las entradas y salidas del código a tocar (endpoint, método público, comando).
2. Escribe tests que llamen con casos reales (felices, límite y error) y comprueben la salida ACTUAL,
   sin juzgarla. Si hoy devuelve algo raro, el test lo fija igual y se anota como hallazgo aparte.
3. Si el código es difícil de probar, sube de nivel: test de endpoint en vez de unitario. Mejor un test
   lento que ninguno.
4. Comprueba que los tests detectan cambios: rompe algo a propósito y verifica que fallan.

## 3. Pasos pequeños
- Un paso = un cambio de estructura que se entiende en una frase (extraer método, mover clase,
  renombrar, introducir interfaz).
- Después de CADA paso: tests de caracterización y suite en verde. Si algo falla, se deshace el paso,
  no se "arregla hacia delante".
- Un commit por paso o por grupo pequeño de pasos, con mensaje `refactor(...)`: se puede revertir y se
  revisa fácil.
- El IDE o herramientas automáticas (Rector en PHP, codemods en TS) antes que editar a mano cuando
  hacen exactamente el cambio.

## 4. Técnicas por caso
| Situación | Técnica |
|---|---|
| Controlador con lógica de negocio | Extraer a un Action o Service con los tests del endpoint como red; el controlador queda en recibir, delegar y responder |
| Método gigante | Extraer métodos por bloque con nombre de intención; después, si hay datos compartidos, extraer clase |
| Condicionales por tipo repetidos | Sustituir por polimorfismo o mapa de estrategias |
| Misma regla de negocio en varios sitios | Moverla a un único lugar (modelo, value object o servicio de dominio) y hacer que todos llamen ahí |
| Dependencia dura de un servicio externo | Introducir una interfaz y un adaptador (skill `ddd-hexagonal`), con un doble en los tests |
| Consultas repartidas por el código | Repositorio o scopes con nombre; cada consulta en un sitio |

## 5. Estrangular código legado
Cuando reescribir de golpe es demasiado arriesgado:
1. Pon una fachada delante del código viejo (misma interfaz).
2. Implementa lo nuevo detrás de la fachada, pieza a pieza, desviando tráfico o casos de uso de uno en uno.
3. Cuando lo viejo ya no recibe nada, se borra.
Cada paso se puede desplegar solo. Nunca un "big bang" de semanas en una rama.

## 6. Cuándo parar
- Cuando se cumple el objetivo de la frase inicial. El refactor no tiene que dejar el código perfecto.
- Si aparece un bug real: se anota, se termina el paso actual en verde y el bug se arregla después,
  en su propio commit con su test.

## 7. Cierre
- Tests de caracterización: los útiles se quedan como regresión; los que fijaban comportamiento
  erróneo se convierten en el test del bug que habrá que arreglar.
- `/verificar` en verde, devlog con antes y después (métricas si las hay: tamaño, complejidad, nº de
  dependencias), y la tarjeta del plan marcada como hecha.
