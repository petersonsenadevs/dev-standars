# Herramientas de generación por agente (verificado 2026-09)

## Codex / app de ChatGPT (el agente del equipo — empieza aquí)
- **App de ChatGPT/Codex de escritorio (Windows/Mac): genera imágenes NATIVAMENTE** — el agente pide la
  imagen con el prompt de la receta y ya está. No busques la API ni ejecutes el script: es tiempo perdido.
- **Codex CLI o entornos sin generación nativa**: usa **`scripts/generate.mjs`** con la **misma
  `OPENAI_API_KEY`** que ya tienes configurada para Codex (cero fricción).
- Modelo por defecto: **gpt-image** — el mejor siguiendo instrucciones finas ("exactly these hex colors",
  "leave negative space on the left") y editando imágenes existentes. Soporta `--background transparent`.
- Coste orientativo: ~0,02 $ (low) / ~0,07 $ (medium) / ~0,19 $ (high) por imagen 1024². Genera 2-3
  variantes en `medium` y sube a `high` solo la elegida final.
- La skill se instala global con `install-skills.ps1` (queda en `~/.codex/skills` y `~/.agents/skills`);
  Codex la autodescubre por la description o con `$image-gen`.

## Antigravity (Google)
- Trae **Nano Banana Pro (Gemini 3 Pro Image) integrado**: puedes pedirle la imagen directamente en el
  IDE — dale el prompt YA construido con la receta y la paleta (no un "haz una imagen bonita").
- Es especialmente bueno en: mockups de UI, texto legible dentro de la imagen, ediciones iterativas.
- Vía script: `--provider gemini` con `GEMINI_API_KEY` (modelo `gemini-3-pro-image-preview`, con
  fallback automático a `gemini-2.5-flash-image` si el preview no está disponible en tu clave).

## Claude Code / Cursor / Windsurf
- El mismo script con el proveedor que tenga clave: `--provider openai` | `gemini` | `fal`.
- En Claude Code además puedes ABRIR la imagen generada (Read) y evaluarla antes de colocarla.

## Qué modelo cuándo (resumen del panorama 2026)
| Modelo | Fuerte en | Vía |
|---|---|---|
| gpt-image (OpenAI) | Seguir instrucciones exactas, edición, transparencia | script (default) |
| Nano Banana Pro / Gemini 3 Pro Image | Mockups UI, texto en imagen, iteración | Antigravity nativo o `--provider gemini` |
| FLUX (1.1 Pro / 2 Pro) | Fotorrealismo puro | `--provider fal` (modelo `fal-ai/flux-pro/v1.1`) |
| Imagen 4 Ultra | Fotorrealismo máximo en Google Cloud | Vertex AI (si el proyecto ya vive en GCP) |
| Recraft V3 | Vector/SVG, iconos, sistemas de marca, estilos consistentes | API propia de Recraft o fal |
| Ideogram | Tipografía dentro de la imagen (banners con claim) | fal |
| Midjourney | Dirección artística | SIN API oficial: solo manual, no automatizable |

## Post-proceso (obligatorio antes de usar en la web)
1. Recorte al aspect del hueco real del layout.
2. **WebP/AVIF** (squoosh.app, o `sharp` si el proyecto es Node) — una imagen IA en PNG de 2 MB en el
   hero destroza el LCP.
3. Dimensiones (`width`/`height` o `aspect-ratio`) + `alt` que describa el CONTENIDO (no "imagen generada").
4. Fondos transparentes: genera con `--background transparent` o quita fondo (remove.bg / rembg local).
5. El prompt usado se guarda en `senzu/design-system/<slug>/prompts.md` (para regenerar coherente en el futuro).

## Licencias y ética (resumen operativo)
- OpenAI/Google/FLUX-pro/Recraft: el output es utilizable comercialmente según sus términos vigentes —
  pero revisa los términos del proveedor si el cliente es sensible (algunos exigen mención de IA).
- Nunca: caras de personas reales, logos/marcas de terceros dentro de la imagen, ni presentar una imagen
  generada como foto real del trabajo/local/equipo del cliente (recurso genérico ≠ evidencia).
- Anota en el devlog qué imágenes son generadas y con qué prompt/modelo.
