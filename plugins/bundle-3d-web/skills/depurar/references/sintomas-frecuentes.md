# Síntomas frecuentes y su causa habitual

Antes de formular una hipótesis nueva, mira si el síntoma está aquí: suele ahorrar la mitad del camino.
Sigue siendo una hipótesis: confírmala con el test o la reproducción.

| Síntoma | Causa habitual | Cómo confirmarlo |
|---|---|---|
| "En local va y en producción no" | Configuración o variables de entorno distintas, caché de configuración vieja, versión distinta de una dependencia o del lenguaje | Compara versiones y variables; en Laravel `env()` fuera de `config/` devuelve null con la configuración cacheada |
| Funciona a veces sí y a veces no | Condición de carrera, orden de ejecución, caché, dependencia de la hora o de datos aleatorios | Repite el test 20 veces; fija la hora y la semilla; mira si hay estado compartido |
| `undefined` / `null` donde no debería | Dato que no llega (API, relación sin cargar, clave mal escrita), promesa sin `await` | Registra el valor y el tipo justo antes; comprueba la respuesta real de la API |
| Error 500 sin detalle | Excepción tragada o log en otro sitio | Log del servidor (`storage/logs`, consola del proceso), modo debug solo en local |
| Error 419 / 403 en formularios (Laravel) | Token CSRF caducado o ausente, sesión perdida (dominio de cookie) | Mira la cabecera y la cookie en la pestaña Network |
| CORS bloqueado | Origen no permitido o petición preflight sin respuesta correcta en el servidor | La petición OPTIONS en Network y la configuración CORS del backend |
| Hora desplazada 1-2 horas | Zona horaria: se guarda en local y se interpreta como UTC, o al revés | Compara el valor guardado con el mostrado; todo en UTC en BD |
| Consulta lenta de repente | Falta un índice o apareció un N+1 al cambiar la vista | `EXPLAIN` y contar consultas por petición |
| Test que pasa solo y falla en la suite | Estado compartido entre tests (BD sin limpiar, variable global, mock sin restaurar) | Ejecuta el test solo y en orden inverso |
| Cambio que "no se aplica" | Caché (navegador, CDN, config, OPcache, build viejo), worker con código viejo | Recarga sin caché, reinicia workers, limpia cachés del framework |
| Hidratación fallida (Next, Nuxt, Astro) | El servidor y el cliente pintan distinto (fechas, aleatorios, `window`) | Compara el HTML del servidor con el primer render |
| Texto con caracteres raros (Ã©, �) | Codificación: se lee o escribe sin UTF-8 | Mira los bytes del archivo o de la respuesta y la cabecera `charset` |
