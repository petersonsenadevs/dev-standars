# Plan — web y marca de Senzu

Brief: [brief.md](brief.md) · Marca: [../design-system/senzu/marca.md](../design-system/senzu/marca.md) ·
Blueprint: [../design-system/senzu/blueprint.md](../design-system/senzu/blueprint.md)

## Fases
| Fase | Entregable | Estado |
|---|---|---|
| F0 | Brief, marca, briefs de logos y blueprint | done |
| F1 | Logos elegidos por rondas (símbolo → logotipo → combinado → mascota) | todo |
| F2 | Maquetas A/B de la portada (técnica oscura vs editorial clara) y dirección elegida | todo |
| F3 | Web con Astro + Starlight, contenido generado del repo | todo |
| F4 | Vercel: vistas previas por rama y producción con aprobación | todo |

## F1 · Logos
- [ ] **F1-T1** Generar 4 variantes de cada dirección del símbolo (A, B, C) · skill graphic-design o image-gen ·
  Hecho cuando: 12 bocetos en `logos/generados/simbolo/` · Verificar: se ven a 16 px.
- [ ] **F1-T2** Ronda de símbolo con piezas votables y elección · /ronda · Hecho cuando: símbolo en «Fijado» de gustos.md.
- [ ] **F1-T3** Logotipo: variantes + ronda · Hecho cuando: logotipo fijado.
- [ ] **F1-T4** Combinado en SVG (horizontal, vertical, negativo) · Hecho cuando: 4 SVG en `logos/final/`.
- [ ] **F1-T5** Mascota o ilustración: variantes + ronda · Hecho cuando: decidida (o descartada).

## F2 · Maquetas
- [ ] **F2-T1** /propuestas portada: ronda 1 con A (técnica oscura) y B (editorial clara), con el logo fijado.
- [ ] **F2-T2** Rondas hasta elegir dirección → MASTER.md con tokens.

## F3 · Web
- [ ] **F3-T1** Proyecto Astro + Starlight en `web/` con los tokens del MASTER.md.
- [ ] **F3-T2** Script que copia y adapta docs del repo a la web en cada build (sin contenido a mano).
- [ ] **F3-T3** Portada según el blueprint, con checkpoint por sección.
- [ ] **F3-T4** /verificar + ui-verify (375/768/1440, dark, accesibilidad) + /lanzar.

## F4 · Despliegue
- [ ] **F4-T1** Proyecto en Vercel conectado a GitHub (raíz `web/`), vista previa por rama · lo conecta el usuario.
- [ ] **F4-T2** Primer despliegue a producción con /desplegar y aprobación explícita.
