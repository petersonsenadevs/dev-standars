# Técnicas de depuración por stack

Índice: Transversal · Laravel / PHP · Node, TypeScript y Next · Front (navegador) · Python · Go, Java y .NET

## Transversal
- **Bisección con git**: si "antes funcionaba", `git bisect start`, `git bisect bad` (ahora), `git bisect
  good <commit que iba>` y prueba en cada paso; con un script, `git bisect run <comando de test>`.
  Encuentra el commit exacto en log2(n) pasos.
- **Bisección en el código**: comenta o salta la mitad del flujo sospechoso y mira si el error sigue.
- **Reducir la entrada**: quita datos de la entrada que falla hasta quedarte con el caso mínimo.
- **Comparar con lo que funciona**: mismo flujo con datos que sí van; la diferencia suele ser la causa.
- **Logs temporales** con `senzu-allow` en la línea (el hook lo exige) y borrados antes de cerrar.
  Registra el VALOR y el TIPO (`gettype`, `typeof`, `type()`), no solo "llega aquí".

## Laravel / PHP
- Depurador: Xdebug con el IDE (punto de ruptura en la línea, inspección de variables).
- Sin depurador: `logger()->debug('ctx', compact('a', 'b'))` y leer `storage/logs/laravel.log`
  (`dd()` y `dump()` los bloquea el hook: si los necesitas un momento, `senzu-allow` y fuera).
- Consultas: `DB::enableQueryLog()` + `DB::getQueryLog()`, o `->toRawSql()` en el builder.
- Errores silenciosos: `php artisan config:clear` y `cache:clear` (configuración cacheada vieja),
  `php artisan queue:restart` (workers con código viejo), `tail -f storage/logs/laravel.log`.
- Tests: `php artisan test --filter=NombreDelTest --stop-on-failure`.

## Node, TypeScript y Next
- Depurador: `node --inspect-brk` y Chrome (`chrome://inspect`) o el depurador del IDE; en tests,
  `vitest --inspect-brk --no-file-parallelism` o el modo depuración de Jest.
- Tipos: `npx tsc --noEmit` antes de depurar en ejecución; muchos "bugs" son un tipo mal asumido.
- Asincronía: busca promesas sin `await` (ESLint `no-floating-promises`) y errores no capturados.
- Next: distingue si el código corre en servidor o cliente (los logs de servidor salen en la terminal,
  los de cliente en el navegador); errores de hidratación = diferencia entre el HTML del servidor y el
  primer render del cliente (fechas, `Math.random`, `window`).

## Front (navegador)
- DevTools: pestaña **Network** (petición, estado, respuesta real), **Console** (errores y avisos),
  puntos de ruptura en **Sources**, y el inspector de estado del framework (Vue DevTools, React DevTools).
- CSS roto: inspecciona el elemento, mira qué regla gana y por qué (especificidad, orden, `@layer`).
- "En móvil falla": reprodúcelo con el modo dispositivo y después en un móvil real si depende del táctil.

## Python
- `breakpoint()` (pdb) en la línea; en FastAPI, depurador del IDE sobre uvicorn con `--reload` desactivado.
- `pytest -x --pdb` para parar en el primer fallo con el depurador abierto; `-k nombre` para uno solo.
- Logging con `logging.getLogger(__name__).debug(...)` y nivel DEBUG en local.

## Go, Java y .NET
- **Go**: Delve (`dlv test`, `dlv debug`), `go test -run TestNombre -v -race`.
- **Java**: depurador del IDE sobre el test; logs con SLF4J a nivel DEBUG en el paquete implicado.
- **.NET**: depurador de Visual Studio o Rider; `dotnet test --filter NombreDelTest`.
