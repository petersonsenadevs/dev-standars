# Caché: niveles, claves e invalidación

## Índice
- [Antes de cachear](#antes-de-cachear)
- [Niveles (del más barato al más caro)](#niveles-del-más-barato-al-más-caro)
- [Claves y TTL](#claves-y-ttl)
- [Invalidación](#invalidación)
- [Cache stampede](#cache-stampede)
- [Qué NO cachear](#qué-no-cachear)
- [Por stack](#por-stack)
- [Checklist](#checklist)

## Antes de cachear
La caché es la ÚLTIMA optimización, no la primera: antes arregla N+1, añade índices y pagina
(`performance.md` §medir). Cachear un query malo esconde el problema y añade un bug de invalidación.
Cada caché nueva se anota: qué guarda, TTL, cómo se invalida, qué pasa si está desactualizada.

## Niveles (del más barato al más caro)
1. **HTTP** (el mejor: no llega ni al servidor): `Cache-Control` en assets con hash (`immutable, max-age=1y`);
   páginas públicas con `s-maxage` + CDN; `ETag`/`Last-Modified` para APIs de lectura.
2. **Página/fragmento**: Astro/Next estático o ISR (`revalidate`), fragmentos cacheados en vistas.
3. **Aplicación (Redis/Memcached)**: resultados de queries caras, agregados, respuestas de APIs externas.
4. **En proceso** (array/memo por request): resolver lo mismo 2 veces en una request es un bug, no una caché.

## Claves y TTL
- Clave = `contexto:entidad:id:versión` (`shop:product:42:v2`). Incluye TODO lo que cambia el resultado:
  usuario/tenant, idioma, filtros (normalizados y ordenados). Si dudas de una dimensión, inclúyela.
- TTL SIEMPRE (aunque haya invalidación activa): valores volátiles 1-5 min, listados 15-60 min, catálogos horas.
  El TTL es la red de seguridad cuando la invalidación falla.
- Nunca claves construidas con input del usuario sin normalizar (inyección de claves / colisiones).

## Invalidación
- **Por escritura** (preferida): al guardar la entidad, borra/actualiza sus claves conocidas
  (observer/evento del modelo). Borra, no reescribas: la siguiente lectura repuebla.
- **Por versión**: guarda `version` por entidad/colección y ponla en la clave; invalidar = incrementar versión
  (barato cuando hay muchas claves derivadas).
- **Por tags** si el driver los soporta (Redis + Laravel tags): agrupa por entidad y `flush` del tag.
- Regla: quien escribe invalida. Si un tercero escribe en la BD por fuera, la caché no puede saberlo → TTL corto.

## Cache stampede
Cuando expira una clave caliente, 100 requests recalculan a la vez:
- Lock de recálculo: solo uno regenera, el resto sirve el valor viejo o espera (`Cache::lock` en Laravel,
  `stale-while-revalidate` en HTTP/Next ISR).
- Jitter en TTLs (±10 %) para que mil claves no expiren en el mismo segundo.
- Precalienta (job programado) las 5-10 claves realmente calientes en vez de confiar en el primer visitante.

## Qué NO cachear
- Nada con permisos por usuario en una caché compartida sin el usuario en la clave (fuga de datos entre usuarios:
  el bug de caché más grave). Ante la duda: no cachees respuestas autenticadas.
- Resultados de escrituras, carritos, estados de pago, tokens.
- Config/feature flags con TTL largo (usa segundos, no horas: si no, no puedes apagar nada rápido).

## Por stack
| Stack | Usa |
|---|---|
| Laravel | `Cache::remember` + tags (Redis); `Cache::lock` para stampede; observers para invalidar; `route:cache`/`config:cache` en deploy |
| Next.js | `fetch` con `revalidate`/tags + `revalidateTag()` al escribir; ISR para páginas; `unstable_cache` para funciones |
| Astro | Estático por defecto (la mejor caché); SSR: `Cache-Control`/CDN por ruta; Netlify cache headers |
| Python | Redis con `cache_key` helper propio; `functools.lru_cache` SOLO para puro-en-proceso (ojo memoria en workers) |

## Checklist
- [ ] ¿El problema real era N+1/índice? (si sí, arreglado antes de cachear)
- [ ] Clave con todas las dimensiones (usuario/tenant/idioma/filtros) y TTL con jitter.
- [ ] Invalidación por escritura o versión, documentada junto al código que escribe.
- [ ] Clave caliente protegida contra stampede (lock o stale-while-revalidate).
- [ ] Nada autenticado en caché compartida sin usuario en la clave.
- [ ] Se puede vaciar por entorno sin tumbar el resto (prefijo por app/entorno).
