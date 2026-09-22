# Java (moderno) + Spring Boot: buenas prácticas

Índice: 1 Java moderno (17/21) · 2 Spring Boot: capas · 3 Datos (JPA sin sustos) · 4 Errores ·
5 Config · 6 Tests · 7 Errores típicos

## 1. Java moderno — usa el Java del proyecto (LTS: 17, 21)
- `record` para DTOs/valores inmutables; `sealed` + pattern matching en `switch` para modelar variantes;
  `var` en locales obvias; text blocks para SQL/JSON largos; Streams para transformar (sin abusar en hot paths).
- 21: virtual threads (`Executors.newVirtualThreadPerTaskExecutor`) para IO concurrente — adiós a pools gigantes.
- `Optional` como RETORNO (nunca como campo o parámetro); nulls fuera de las fronteras públicas.
- Inmutable por defecto: `final`, `List.copyOf`, records; los setters se justifican, no se generan por inercia.

## 2. Spring Boot: capas
- `@RestController` fino (mapea HTTP↔DTO) → `@Service` (lógica) → `Repository` (datos). El controller no ve entidades.
- Inyección por CONSTRUCTOR (sin `@Autowired` en campos): testeable y con dependencias explícitas.
- DTOs de request con Bean Validation (`@Valid`, `@NotBlank`, `@Positive`); respuesta con records propios,
  no la entidad JPA (lazy loading + campos de más).

## 3. Datos (JPA sin sustos)
- N+1 es LA trampa: `@EntityGraph` o `join fetch` en queries concretas; nunca `FetchType.EAGER` global.
- Transacciones en el servicio (`@Transactional`), no en el controller; solo lectura → `readOnly = true`.
- Migraciones con Flyway/Liquibase versionadas (nunca `ddl-auto: update` fuera de dev).
- Queries derivadas para lo simple; `@Query` JPQL para lo demás; SQL nativo solo con motivo.

## 4. Errores
- Excepciones de dominio propias + un `@RestControllerAdvice` que las mapea a HTTP (ProblemDetail en Boot 3).
- Checked exceptions: envuélvelas en la frontera; no las propagues por todo el dominio.
- Nunca `catch (Exception e) { e.printStackTrace(); }` — logger (SLF4J) con contexto o propagar.

## 5. Config
- `@ConfigurationProperties(prefix = "app")` sobre record validado — no `@Value` disperso por el código.
- Perfiles (`application-prod.yml`) para diferencias por entorno; secretos por variables de entorno, no en el YAML.

## 6. Tests
- JUnit 5 + AssertJ. Unit para servicios (Mockito con moderación); `@SpringBootTest` solo para lo que necesita
  el contexto; slices (`@WebMvcTest`, `@DataJpaTest`) para lo intermedio; Testcontainers para BD real en integración.

## 7. Errores típicos del agente
- Devolver entidades JPA del controller · EAGER global "para que no falle el lazy" · lógica en el controller.
- `@Autowired` en campo · Optional como parámetro · getters/setters + constructor vacío donde iba un record.
- Ignorar la versión: records/sealed en un proyecto Java 8 (¡no compilan!) — mira `pom.xml`/`build.gradle` primero.
