# Mapa del proyecto (/mapa)

Explica un proyecto (heredado o propio) a quien llega nuevo, persona o agente: qué es, cómo se
arranca, dónde está cada cosa y por dónde pasan los flujos importantes. `/adoptar` imita el ESTILO;
el mapa explica la ESTRUCTURA. Solo lectura: no cambia código.

Índice: 1 Cómo se construye · 2 Contenido del mapa · 3 Mantenerlo vivo · 4 Errores típicos

## 1. Cómo se construye (con evidencia, no de memoria)
1. Manifiestos y configuración: stack y versiones, scripts de arranque, variables de entorno
   necesarias (de `.env.example`, nunca de `.env`), servicios externos.
2. Estructura de carpetas: las de primer y segundo nivel con qué contienen de verdad.
3. Puntos de entrada: rutas, comandos, colas, tareas programadas, webhooks.
4. Flujos críticos (3-5): se siguen en el código de principio a fin (petición → controlador → servicio
   → datos → respuesta) anotando archivo y función en cada paso.
5. Modelos de datos principales y sus relaciones.
6. Zonas de riesgo: `node <skills>/backend-audit/scripts/hotspots.mjs` (lo que cambia mucho y es grande).

## 2. Contenido del mapa (`docs/MAPA.md`)
- **Qué es**: una frase de negocio y a quién sirve.
- **Arrancarlo en local**: requisitos, pasos y variables de entorno necesarias.
- **Stack y versiones**.
- **Estructura**: tabla carpeta → qué hay.
- **Flujos críticos**: cada uno con su recorrido archivo a archivo (un diagrama Mermaid si ayuda).
- **Datos**: entidades principales y relaciones.
- **Integraciones externas**: servicio, para qué, dónde se configura, qué pasa si cae.
- **Dónde tocar para…**: tabla de tareas frecuentes → archivos ("añadir un campo al formulario de
  contacto → …", "cambiar el precio del envío → …"). Es lo que más ahorra a quien llega nuevo.
- **Zonas de riesgo**: los hotspots y lo que conviene no tocar sin tests.
- **Glosario** del negocio si tiene términos propios.

## 3. Mantenerlo vivo
- Fecha y commit en la cabecera ("mapa del <fecha>, commit <sha>").
- Se actualiza cuando cambia la estructura (módulo nuevo, integración nueva), no en cada tarea.
- `CLAUDE.md` o `CLAUDE.project.md` pueden enlazarlo para que el agente lo lea al empezar.

## 4. Errores típicos
- Describir la estructura teórica del framework en vez de la real del proyecto.
- Copiar variables de `.env` (secretos) en vez de las de `.env.example`.
- Un mapa de 30 páginas que nadie lee: lo esencial en la primera pantalla, el detalle debajo.
