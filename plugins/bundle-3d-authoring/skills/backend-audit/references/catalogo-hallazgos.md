# Catálogo de hallazgos: qué buscar, qué evidencia exige y qué lo arregla

Es el puente entre la auditoría y las skills de backend: cada fila dice cómo se DETECTA, qué PRUEBA
hace falta para reportarlo y qué RECETA lo arregla (`code-quality`, `ddd-hexagonal`, `deploy-ops`).
Gravedad por defecto; ajústala con superficie y probabilidad (`protocolo.md` §6).

## Seguridad

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| Un usuario accede a datos de otro (IDOR) | Rutas con id sin policy o scope por usuario | Test que pide el recurso de otro usuario y recibe 200 | Crítica | `code-quality/references/auth-patterns.md` + `security-owasp.md` |
| SQL construido con texto del usuario | Semgrep, grep de consultas crudas con variables | archivo:línea + test con una comilla que rompe la consulta | Crítica | `code-quality/references/security-owasp.md` |
| Entrada sin validar en el borde | Controladores o handlers que usan la request directa | archivo:línea + petición con datos inválidos aceptada | Alta | `code-quality/references/security-owasp.md` |
| Asignación masiva sin proteger | Modelos sin `$fillable`, `create($request->all())` | archivo:línea + test que cambia un campo protegido | Alta | `code-quality/references/php-laravel.md` |
| Secretos en código o historial | gitleaks, secrets-guard, grep | Salida de la herramienta (sin copiar el secreto en el informe) | Crítica | `deploy-ops/references/envs-secrets.md` (rotar YA) |
| Dependencia con vulnerabilidad | `composer audit`, `npm audit`, `pip-audit` | Salida con CVE y versión | Según CVE | Actualizar; si no se puede, mitigar y documentar |
| Webhook sin verificar firma | Revisión de endpoints de terceros | archivo:línea + petición falsificada aceptada | Crítica | `code-quality/references/integrations.md` |

## Datos e integridad

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| Doble envío crea duplicados | Flujos de pago o alta sin idempotencia | Test con dos peticiones simultáneas → dos registros | Alta | `code-quality/references/data-integrity.md` |
| Operación de varios pasos sin transacción | Varias escrituras seguidas sin transacción | Test que falla a mitad y deja datos a medias | Alta | `code-quality/references/data-integrity.md` |
| Dinero en float | Tipos de columna y cálculos | archivo:línea + cálculo con redondeo incorrecto | Alta | `code-quality/references/data-integrity.md` |
| Invariante sin restricción en BD | Unicidad o FK solo en el código | Esquema + inserción directa que la rompe | Media | `code-quality/references/database-design.md` |
| Migración destructiva en un paso | Migraciones con drop o rename junto al código nuevo | archivo de migración | Alta | `code-quality/references/database-design.md` (expandir → contraer) |

## Rendimiento

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| N+1 | preventLazyLoading, log de queries | Nº de consultas en una petición real (ej. 1 + 50) | Alta en listados | `code-quality/references/performance.md` |
| Falta índice en un filtro frecuente | `EXPLAIN` de la consulta lenta | Plan de ejecución con escaneo completo + tiempo | Media-alta | `code-quality/references/database-design.md` |
| Trabajo lento dentro de la petición | Emails, PDFs o llamadas externas síncronas | Tiempo de respuesta medido | Media | `code-quality/references/jobs-and-queues.md` |
| Listado sin paginar | Consultas que devuelven todo | Tamaño de la respuesta con datos realistas | Media | `code-quality/references/api-design.md` |
| Caché que nunca se invalida | Revisión de claves y escrituras | Test: se escribe y la lectura devuelve lo viejo | Media | `code-quality/references/caching.md` |

## Arquitectura y acoplamiento

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| Lógica de negocio en controladores o vistas | Hotspots + tamaño de controladores | archivo:línea + nº de responsabilidades distintas | Media | `code-quality/references/php-laravel.md` o la del stack |
| Capas que se saltan las reglas | Deptrac, dependency-cruiser, import-linter, arch tests | Salida de la herramienta | Media-alta | `reglas-arquitectura.md` + `ddd-hexagonal` |
| Dependencias circulares | madge, dependency-cruiser | Ciclo listado | Media | `ddd-hexagonal` (límites de módulo) |
| Clase "dios" | Complejidad y tamaño + hotspots | Métricas + lista de responsabilidades | Media (Alta si es hotspot) | `refactor-seguro.md` |
| Dominio rico metido en un CRUD | Reglas de negocio repartidas en muchos sitios | Misma regla duplicada en 3+ archivos | Media | `ddd-hexagonal` (empieza por su checklist de si hace falta) |

## Errores, observabilidad y tests

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| Errores tragados | `catch` vacío o que solo registra y sigue | archivo:línea | Media-alta | `code-quality/references/errors-logging.md` |
| Datos personales en logs | Registro de la request o del usuario completos | archivo:línea | Alta (RGPD) | `code-quality/references/errors-logging.md` |
| Flujo crítico sin tests | Cobertura de login, pago, alta | Informe de cobertura | Alta | `code-quality/references/testing.md` |
| Tests que no prueban nada | Tests sin aserciones o con todo simulado | archivo:línea | Media | `code-quality/references/testing.md` |
| Sin health check ni alertas | Revisión de infraestructura | Ausencia de endpoint o monitorización | Media | `deploy-ops/references/backups-monitoring.md` |

## Versiones y dependencias

| Hallazgo | Cómo se detecta | Evidencia mínima | Gravedad | Receta |
|---|---|---|---|---|
| Framework o lenguaje sin soporte | Aviso EOL de session-start | Versión y fecha de fin de soporte | Alta | `code-quality/references/stack-versions.md` |
| Paquete abandonado | Último release, issues | Fecha y enlace | Media | Sustituir o aislar tras una interfaz |
| Dependencia sin usar | knip, `composer why-not` | Salida de la herramienta | Baja | Quitarla |
