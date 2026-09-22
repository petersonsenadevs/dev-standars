# C# (.NET moderno) + ASP.NET Core: buenas prácticas

Índice: 1 C# moderno · 2 ASP.NET Core: estructura · 3 EF Core sin sustos · 4 Async correcto ·
5 Errores y config · 6 Tests · 7 Errores típicos

## 1. C# moderno — usa el .NET del proyecto (LTS: 8; mira `TargetFramework` en el .csproj)
- `record` para DTOs/valores; `init` y objetos inmutables por defecto; pattern matching en `switch`;
  **nullable reference types activados** (`<Nullable>enable</Nullable>`) y respetados: un warning de null es un bug.
- Primary constructors (C# 12) para servicios con DI; collection expressions `[...]`; `required` para propiedades obligatorias.
- LINQ para transformar colecciones; `IEnumerable` en firmas públicas solo si de verdad es diferible.

## 2. ASP.NET Core: estructura
- Minimal APIs (endpoints agrupados con `MapGroup`) o Controllers — según lo que ya use el proyecto, sin mezclar.
- DI nativa por constructor; lifetimes correctos: `Scoped` para DbContext y servicios por-request,
  `Singleton` solo sin estado mutable (un DbContext en Singleton es un bug clásico).
- DTOs de entrada validados (DataAnnotations o FluentValidation); la entidad de EF no sale del servicio.

## 3. EF Core sin sustos
- N+1: `Include`/`ThenInclude` explícitos o proyección directa a DTO con `Select` (mejor: solo pides lo que usas).
- `AsNoTracking()` en lecturas; transacciones implícitas de `SaveChanges` bastan para lo simple.
- Migraciones versionadas (`dotnet ef migrations add`) — nunca editar una aplicada; `EnsureCreated` solo en tests.

## 4. Async correcto
- `async`/`await` de punta a punta: nada de `.Result` ni `.Wait()` (deadlocks); `Task` nunca ignorada.
- `CancellationToken` aceptado y propagado en endpoints y servicios (ASP.NET lo pasa gratis).
- `IAsyncEnumerable` para streams grandes; `Task.WhenAll` para IO independiente.

## 5. Errores y config
- Excepciones de dominio + `IExceptionHandler`/ProblemDetails (RFC 7807) — un solo sitio mapea a HTTP.
- `IOptions<T>` sobre clase validada (`ValidateDataAnnotations().ValidateOnStart()`): si falta config, no arranca.
- Secretos: user-secrets en dev, variables de entorno/Key Vault en prod; jamás en `appsettings.json` commiteado.
- Logging estructurado con `ILogger<T>` (plantillas, no interpolación: `_logger.LogInformation("Pedido {Id}", id)`).

## 6. Tests
- xUnit + FluentAssertions; `WebApplicationFactory` para tests de integración de la API;
  Testcontainers o SQLite in-memory (con cuidado: no es SQL Server) para datos.

## 7. Errores típicos del agente
- `.Result`/`.Wait()` "para simplificar" · DbContext Singleton · devolver entidades EF con ciclos de navegación.
- Ignorar nullable warnings con `!` en cadena · lógica en el controller · `catch (Exception) {}`.
- Usar API de .NET 9 en un proyecto net6.0: mira el `TargetFramework` ANTES de escribir.
