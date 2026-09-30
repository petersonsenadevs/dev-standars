---
description: Instala o actualiza dev-standards completo en este proyecto (todo, por categorías o a medida)
---

Uso: `/instalar [stack opcional, p. ej. "laravel"]` — el argumento es opcional; si no llega, detecta el stack.

Aplica la skill `instalar-proyecto` paso a paso: localizar o clonar el paquete, detectar el stack,
confirmar con el usuario, preguntar qué instalar (todo, por categorías o a medida), ejecutar el
instalador y pedir una sesión nueva. Si el usuario indicó un stack tras el comando, úsalo.
