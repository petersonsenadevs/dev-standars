# Roadmap de dev-standards (para que nada se olvide)

Actualizado: 2026-09-18. Las tandas completadas viven en `devlog/INDEX.md` (029 entradas).

## 1. Pendientes que dependen del usuario
- [ ] **Estreno real del ciclo completo**: un proyecto de verdad con `/brief` → `/propuestas` (maquetas A/B)
  → construir → `/repaso` → `/lanzar`. Lo que falle ahí define la siguiente tanda (regla aprendida:
  lo real destapa más que construir en vacío).
- [ ] **Publicar en GitHub** (todo preparado desde el commit `a069964`): falta decidir **owner** y
  **público/privado**. Activa `/plugin marketplace add <owner>/dev-standards` y el `irm … install.ps1 | iex`.
- [ ] En `un proyecto Laravel`: verificación móvil de `/escombros` (F2-T1), fotos reales del servicio,
  cifras de contadores confirmadas, alta del subdominio en Netlify/DNS, y commit del proyecto.
- [ ] Ejecutar una vez las **evals de plugin** (cuestan ~0,01-0,20 $/caso):
  `cd plugins/dev-standards-front && claude plugin eval . --trust-plugin --runs 1 --ablation none`.

## 2. MOBILE — decidido (dev-023), pendiente de proyecto real que lo estrene
**Decisión**: mobile va EN ESTE repo como stacks nuevos (NO repo aparte). Motivo: la maquinaria
(registro, router, hooks, checks, suite, vendor, renderers, install) es única y el núcleo (planner,
devlog, brief, gustos, backend de code-quality) aplica igual. Separar = mantener todo dos veces.
La disciplina de contexto ya evita la saturación: cada proyecto instala SOLO su stack.

**Los 4 stacks previstos** (se construye CADA UNO cuando llegue su primer proyecto real, no antes):

| Stack | Contenido clave | Verificación en Windows |
|---|---|---|
| `react-native-expo` | Expo/EAS, Reanimated ("el gsap de RN"), React Navigation | ✔ npm test + eas build |
| `flutter` | Widgets, Riverpod/Bloc, Material 3 | ✔ flutter analyze/test |
| `android-kotlin` | Jetpack Compose, Gradle, Material 3 | ✔ gradlew lint test assembleDebug |
| `ios-swift` | SwiftUI, HIG, SPM | ✘ **xcodebuild exige macOS**: sin Mac (o Xcode Cloud/CI), el agente escribiría Swift a ciegas — NO arrancar iOS nativo sin resolver esto |

**Grupo `mobile` nuevo en el registro** (compartido por los 4): skill de diseño móvil hermana de
ui-ux-pro-max (Material 3 + Human Interface Guidelines — el design system de una app NO es el de una
web), navegación y patrones de pantalla, push notifications, offline/sync, y launch-checklist de
stores (App Store review, Play Console, screenshots, privacidad). `mobileProfile` análogo al
frontProfile; verify sobre emulador/Expo Go como nuestro ui-verify.

**Orden recomendado para agencia**: cross-platform primero (RN/Expo o Flutter cubre ~90 % de encargos
con un código); Kotlin/Swift nativos solo si el proyecto lo exige (rendimiento extremo, APIs de
plataforma profundas, heredar app nativa) — y Swift solo con Mac disponible.

## 3. Mejoras conocidas de menor prioridad (cuando toquen)
- [ ] Backend por stack profundo: colas Horizon en php-laravel.md, server actions seguras en
  react-next.md, uploads de archivos como receta propia.
- [ ] Refresco periódico (~mensual): `tools/vendor.ps1` (upstream de skills), `vendor-effects.ps1 -Missing`
  y los índices scrapeados de `front-activation/references/sources/` (instrucciones en cada índice).
- [ ] Portabilidad de scripts a macOS/Linux (hoy todo PS 5.1) — solo si entra alguien sin Windows.
- [ ] Más canteras MIT al manifest de effects-vendor a medida que aparezcan (codrops está agotado).

## Cómo se usa este archivo
Al cerrar una tanda: marcar lo hecho y añadir lo nuevo que quede pendiente. El planner y los agentes
pueden leerlo, pero la fuente de tareas de un proyecto sigue siendo su `plan/PLAN.md`; esto es el
backlog del PAQUETE.
