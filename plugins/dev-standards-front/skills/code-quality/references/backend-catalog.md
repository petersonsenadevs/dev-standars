# Catálogo backend: tarea o síntoma → receta exacta

Equivalente backend del catálogo de efectos: localiza la fila y abre SOLO el archivo §sección indicado.
Si la tarea es de arquitectura (módulos, dominio rico), primero el árbol B1 de
`skill-router/references/decision-trees.md`; por síntoma rápido, el B2.

## Autenticación y usuarios
| Tarea / síntoma | Receta |
|---|---|
| Login/registro nuevos, "añade auth" | `auth-patterns.md` §Decisión + §Por stack |
| Password reset / "olvidé mi contraseña" | `auth-patterns.md` §Password reset |
| Login con Google/GitHub | `auth-patterns.md` §OAuth (vincular por provider_id) |
| 2FA / sesiones activas / remember-me | `auth-patterns.md` §2FA y remember-me |
| API keys para terceros | `auth-patterns.md` §API keys |
| "Un usuario ve datos de otro" (IDOR) | `auth-patterns.md` §Autorización + `security-owasp.md` |

## Trabajo en segundo plano
| Tarea / síntoma | Receta |
|---|---|
| Email/PDF/llamada externa lenta en la request | `jobs-and-queues.md` §Cuándo va algo a una cola |
| "El job se ejecutó dos veces" / duplicados por reintento | `jobs-and-queues.md` §Idempotencia |
| Jobs que fallan en silencio | `jobs-and-queues.md` §Reintentos y fallos (muertos con alerta) |
| Import masivo / trabajo pesado | `jobs-and-queues.md` §Colas, prioridades y timeouts |
| Tarea diaria/recurrente | `jobs-and-queues.md` §Cron (lock + idempotente + encola) |

## Rendimiento y caché
| Tarea / síntoma | Receta |
|---|---|
| "Va lento" (primero medir) | `performance.md` §medir → N+1/índices/paginación |
| Cachear un listado/agregado caro | `caching.md` §Claves y TTL + §Invalidación |
| "La caché muestra datos viejos" | `caching.md` §Invalidación (quien escribe invalida) |
| Picos al expirar caché | `caching.md` §Cache stampede |
| Usuario A ve datos de B cacheados | `caching.md` §Qué NO cachear (¡grave!) |

## Datos correctos
| Tarea / síntoma | Receta |
|---|---|
| Precios/facturación, céntimos que no cuadran | `data-integrity.md` §Dinero |
| Fechas que salen con un día menos / zonas horarias | `data-integrity.md` §Fechas |
| Doble clic = doble pedido; stock en negativo | `data-integrity.md` §Concurrencia (atómico/lock/idempotency key) |
| Dos usuarios pisándose una edición | `data-integrity.md` §Concurrencia (lock optimista con versión) |
| Duplicados que no deberían existir | `data-integrity.md` §Unicidad (UNIQUE en BD, no exists()) |
| Soft delete / "borrar mi cuenta" (RGPD) | `data-integrity.md` §Borrados |
| Escritura multi-tabla a medias | `data-integrity.md` §Transacciones |

## Integraciones
| Tarea / síntoma | Receta |
|---|---|
| Consumir API de un tercero | `integrations.md` §Llamar a APIs externas (timeout+backoff+adaptador) |
| Recibir webhook (Stripe, etc.) | `integrations.md` §Recibir webhooks (firma, 200+job, event id) |
| Cobros / pasarela de pago / suscripciones | `integrations.md` §Pagos (verdad por webhook; tarjeta jamás en tu servidor) |
| Emails que llegan a spam / enviar emails | `integrations.md` §Email transaccional |
| Emitir webhooks a clientes | `integrations.md` §Emitir webhooks |

## API y contratos
| Tarea / síntoma | Receta |
|---|---|
| Endpoint/recurso nuevo, versionado, errores HTTP | `api-design.md` |
| Validación de entrada | `security-owasp.md` + la referencia del lenguaje |
| Paginación/filtros/orden en listados | `api-design.md` §listados |
| Multiidioma, hreflang, slugs traducidos, locales | `i18n.md` |

## Calidad continua
| Tarea / síntoma | Receta |
|---|---|
| Tests (crear/arreglar) | `testing.md` §pirámide + §tu stack |
| Errores, logs, reintentos | `errors-logging.md` |
| "Falla en producción" | B2: seguridad → `security-owasp.md`; si no → `errors-logging.md` |
| PR/commits/revisión | `git-and-reviews.md` |
| Migraciones seguras | `php-laravel.md` §Migraciones (o la del stack); DDD: `ddd-hexagonal §persistence/migrations-and-domain.md` |

## Escalones a ddd-hexagonal (cuando la versión simple se queda corta)
| Necesitas garantía de… | Sube a |
|---|---|
| Publicar eventos SIEMPRE que se persiste (ni uno perdido) | `ddd-hexagonal §integration/outbox-pattern.md` |
| Idempotencia formal entre servicios | `ddd-hexagonal §integration/idempotency.md` |
| Mensajería/colas entre módulos con contratos | `ddd-hexagonal §integration/messaging-and-queues.md` |
| Invariantes de negocio ricas (no un CRUD) | árbol B1; después la checklist §1 "¿Hace falta?" del SKILL.md de ddd-hexagonal |
