---
description: Depuración con método — reproducir, test que falla, hipótesis, acotar, arreglar la causa y verificar
---

Uso: `/depurar [síntoma o error, p. ej. "el checkout devuelve 500 con cupones"]` — el argumento es opcional; si no llega, depura el último fallo de la sesión.

Aplica la skill `depurar` completa sobre lo que el usuario escribió tras el comando (o sobre el último
error o test en rojo de la sesión):

1. **Reproduce** el fallo y enseña el error exacto (mensaje y traza desde el código propio).
2. Escribe el **test más pequeño que falla** por ese motivo y comprueba que falla.
3. Mira `references/sintomas-frecuentes.md` por si el síntoma es conocido y escribe **una hipótesis**.
4. **Acota** con las técnicas de `references/tecnicas-por-stack.md` hasta aislar dónde nace.
5. **Arregla la causa** con el cambio mínimo; tras tres intentos fallidos, para y replantea la hipótesis.
6. **Verifica**: el test en verde, `/verificar` en verde y el caso real funcionando. Quita los logs temporales.
7. Resume al usuario en tres líneas: causa, arreglo y cómo se ha comprobado; y déjalo en el devlog.
