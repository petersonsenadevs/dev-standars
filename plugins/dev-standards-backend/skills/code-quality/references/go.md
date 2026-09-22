# Go: buenas prácticas de servicios y CLIs

Índice: 1 Idioma Go (no traduzcas de otros lenguajes) · 2 Errores · 3 Estructura · 4 Concurrencia ·
5 HTTP y contexto · 6 Tests · 7 Herramientas · 8 Errores típicos

## 1. Idioma Go: escribe Go, no Java/TS con sintaxis Go
- Simple y explícito gana: sin jerarquías de herencia (composición + interfaces pequeñas), sin genéricos
  donde un tipo concreto vale, sin frameworks mágicos (la stdlib llega lejísimos).
- Interfaces las define el CONSUMIDOR y pequeñas (1–3 métodos); se aceptan interfaces, se devuelven structs.
- Nombres cortos en scope corto (`i`, `buf`), descriptivos en API pública. `gofmt` no se discute.
- Zero values útiles: diseña structs que funcionen sin constructor cuando sea posible; si no, `NewX()`.

## 2. Errores (el corazón de Go)
```go
if err != nil {
    return fmt.Errorf("cargando pedido %d: %w", id, err)   // envolver con contexto y %w
}
```
- Se manejan o se propagan envueltos; JAMÁS `_ = err` silencioso ni panic para errores esperables.
- `errors.Is`/`errors.As` para decidir; errores centinela (`var ErrNoEncontrado = errors.New(...)`) o tipos propios.
- panic solo para bugs de programación (índice imposible); recover en los bordes (handler HTTP) si acaso.

## 3. Estructura
- `cmd/<binario>/main.go` (main mínimo: wiring) + `internal/` (código no importable desde fuera) + `pkg/` solo
  si de verdad es librería pública. No calques "clean architecture" de carpetas infinitas: paquetes por dominio.
- Config al arrancar (env → struct validada); dependencias inyectadas por constructor explícito (sin contenedor DI).

## 4. Concurrencia
- Las goroutines son baratas pero se FUGAN: toda goroutine necesita final conocido (context cancelado, canal cerrado).
- `sync.WaitGroup`/`errgroup.Group` para esperar; canales para comunicar, mutex para proteger estado — no mezcles ambos para lo mismo.
- `context.Context` primer parámetro de toda función que hace IO: `func (s *Svc) Cargar(ctx context.Context, id int)`.
- Corre los tests con `-race` SIEMPRE; un data race es un bug aunque "funcione".

## 5. HTTP y contexto
- stdlib `net/http` + `http.ServeMux` (1.22+ soporta métodos y wildcards) o chi si hay middlewares complejos.
- Timeouts en el servidor (`ReadTimeout`, `WriteTimeout`) y en clientes (`http.Client{Timeout: ...}`) — los default son infinitos.
- Graceful shutdown con `signal.NotifyContext` + `server.Shutdown(ctx)`.

## 6. Tests
- Table-driven tests idiomáticos + subtests `t.Run`; `t.Helper()` en helpers; `testify` solo si el proyecto ya lo usa.
- Interfaces pequeñas hacen los fakes triviales: nada de frameworks de mocks pesados.

## 7. Herramientas
- `go vet` + `golangci-lint` en CI; `go mod tidy` antes de commitear; versiona con go.mod (mínima que necesites).
- Go no rompe compatibilidad (Go 1.x): actualizar toolchain es seguro; cada minor se soporta ~1 año.

## 8. Errores típicos del agente
- Ignorar errores devueltos · goroutine sin cancelación · capturar variable de bucle en goroutine (pre-1.22).
- Interfaces gigantes "por si acaso" · punteros a todo sin necesidad · `init()` con lógica.
- Traducir excepciones: envolver todo en panic/recover como si fuera try/catch.
