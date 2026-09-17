# Sesión de revisión conversacional: repasamos la web JUNTOS

La auditoría (`review-rubric.md`) es unilateral: tú evalúas y reportas. Esto es lo otro: el usuario
está delante y repasáis la web sección a sección, como haría un diseñador con su cliente. Se activa
con "repasamos la web", "vamos a verla juntos", `/repaso`, o cuando entregas algo grande.

## 1. Preparación (2 min)
1. App corriendo y URL a mano; si tienes navegador (Chrome MCP), ábrela tú y compartes lo que ves;
   si no, pídele al usuario que la abra y os sincronizáis por sección ("baja hasta los servicios").
2. Ten delante `gustos.md` y el brief: la revisión se hace CONTRA sus objetivos, no contra tu gusto.
3. Orden del repaso: móvil primero si el negocio es local (su cliente entra desde el móvil).

## 2. El repaso, sección a sección
Por cada sección (hero → servicios → prueba social → contacto → footer):
1. **Tú primero, una frase**: qué intenta conseguir la sección ("aquí el objetivo es que llame").
2. **Pregunta abierta en llano**: "¿qué te transmite? ¿cambiarías algo?" — y CALLA. No defiendas.
3. **Traduce su feedback** con el glosario (`brief-discovery.md` §3) y confirma en sus palabras:
   - "se ve apretado" → más espaciado/aire → "¿más aire entre bloques, como respirando?"
   - "no me convence esa letra" → tipografía → ofrece 2 alternativas concretas del mismo mood
   - "no se ve profesional" → suele ser jerarquía/contraste/fotos, no el color: indaga con A/B
   - "le falta vida" → 1 efecto protagonista (catálogo + F4), no cinco
   - "no sé, algo raro" → pregunta binaria: "¿es el color, el orden de las cosas, o las fotos?"
4. **Clasifica en voz alta** cada punto: AHORA (rápido y claro) / DESPUÉS (tarjeta X-Tn en el plan) /
   VETADO (va a gustos.md). No arregles en mitad del repaso salvo lo trivial: anota y sigue.

## 3. Reglas del acompañante
- El usuario SIEMPRE tiene razón en lo que siente ("me agobia") y tú en cómo resolverlo técnicamente.
  Nunca "es que así es más moderno": si algo le chirría, se cambia o se le enseña una alternativa.
- Máximo 2 alternativas por punto (elegir entre 2 es fácil; entre 5, imposible).
- Si pide algo que rompe una regla dura (contraste, accesibilidad, scroll-jacking en checkout):
  explícalo en llano UNA vez con el porqué de negocio ("así el 20 % de tus clientes no podrá leerlo")
  y ofrece la versión que respeta la regla. Si insiste, se documenta en devlog como decisión suya.
- Un "me encanta" también se apunta en gustos.md (§Sí): vale tanto como un veto.

## 4. Cierre de la sesión (siempre)
1. Resumen hablado: "cambiamos X ahora, Y queda para la siguiente, y Z no lo vuelvo a proponer".
2. Persistir: gustos.md (síes y vetos con fecha), tarjetas X-Tn para los DESPUÉS, devlog con lo acordado.
3. Aplica los AHORA, verifica (`/verificar` + móvil) y enseña el resultado en la misma sesión si es posible.
