# Evals del plugin (claude plugin eval)

Comprueban que un agente REAL usa las skills correctamente (no solo el hook del router).
Se copian a `plugins/dev-standards-front/evals/` por build-plugins.ps1. Ejecutar (cuesta dinero:
cada run es una sesion real; ~0,01-0,20 $/caso):

    cd plugins/dev-standards-front
    claude plugin eval . --trust-plugin --runs 1 --ablation none --case landing-usa-uiux   # 1 caso barato
    claude plugin eval . --trust-plugin --runs 3 --judge-model claude-haiku-4-5 --threshold 0.8  # suite completa

Casos: landing-usa-uiux (usa ui-ux-pro-max/front-activation y pide brief), efecto-por-catalogo
(marquee bien hecho, sin isla en Astro), backend-sintoma (idempotencia+UNIQUE, no disable del boton),
no-molestar (pregunta trivial: CERO skills).
