# Autenticación y sesiones (patrones seguros por defecto)

## Índice
- [Decisión: sesión vs token](#decisión-sesión-vs-token)
- [Contraseñas](#contraseñas)
- [Password reset](#password-reset)
- [OAuth / login social](#oauth--login-social)
- [2FA y remember-me](#2fa-y-remember-me)
- [API keys y tokens de servicio](#api-keys-y-tokens-de-servicio)
- [Autorización (quién puede qué)](#autorización-quién-puede-qué)
- [Por stack](#por-stack)
- [Checklist](#checklist)

## Decisión: sesión vs token
- **Web con backend propio (Laravel, Next, Astro SSR)** → **cookie de sesión** `HttpOnly; Secure; SameSite=Lax`.
  Es lo más seguro y simple: el navegador la gestiona, XSS no puede leerla. CSRF: token del framework.
- **API consumida por terceros o apps móviles** → tokens (Sanctum tokens, JWT corto). JWT solo si de verdad
  hay varios servicios sin estado compartido; si hay un solo backend, el JWT solo añade problemas (revocación).
- JWT si lo usas: vida corta (≤15 min) + refresh token rotativo en cookie HttpOnly; NUNCA en localStorage;
  firma con secreto fuerte del entorno; valida `alg` esperado (rechaza `none`).

## Contraseñas
- Hash con el del framework: bcrypt/argon2id (`Hash::make`, `password_hash`, `argon2-cffi`). Nunca MD5/SHA a pelo.
- Política: longitud mínima 8-12 SIN reglas absurdas de símbolos; comprueba contra contraseñas filtradas si
  el framework lo trae (Laravel `Password::uncompromised()`).
- Login: mensaje de error ÚNICO ("credenciales incorrectas") — no reveles si el email existe.
- Rate limiting en login/registro/reset (p. ej. 5/min por IP+email) con el throttle del framework.

## Password reset
1. Token aleatorio de un solo uso con caducidad ≤ 60 min, **guardado hasheado** en BD.
2. Respuesta idéntica exista o no el email ("si existe, te hemos enviado un correo").
3. Al usarlo: invalidar el token, invalidar TODAS las sesiones del usuario, notificar por email el cambio.
4. Nunca mandes contraseñas por email ni las generes tú "temporales".

## OAuth / login social
- Usa la librería del stack (Socialite, Auth.js, authlib): flujo Authorization Code + PKCE; jamás implementes
  el intercambio a mano en el cliente.
- Vincula por `provider` + `provider_id`, NO por email a secas (el email del proveedor puede cambiar o no estar
  verificado → account takeover). Si el email coincide con cuenta local, pide confirmación antes de vincular.
- Guarda refresh tokens cifrados si los necesitas; scopes mínimos.

## 2FA y remember-me
- 2FA: TOTP con librería estándar + códigos de recuperación de un solo uso (hasheados). SMS solo como último recurso.
- Remember-me: token propio (serie + validador hasheado) con rotación en cada uso; NO alargar la sesión a 6 meses.
- Sesiones activas visibles para el usuario y "cerrar todas".

## API keys y tokens de servicio
- Prefijo identificable (`sk_live_…`), se muestran UNA vez, se guardan hasheadas, revocables, con scopes.
- En peticiones: header `Authorization: Bearer`, nunca en query string (acaba en logs).
- Rotación documentada; claves distintas por entorno.

## Autorización (quién puede qué)
- SIEMPRE en servidor, en cada acción sensible, aunque la UI ya oculte el botón.
- Modelo simple primero: Policies/Gates (Laravel), middleware + helpers (Next/Astro), dependencias (FastAPI).
  Roles y permisos en BD solo cuando hay gestión dinámica; si no, enum de rol basta.
- **IDOR es el bug nº 1**: toda consulta por id filtra por propietario/tenant (`where user_id = auth`).

## Por stack
| Stack | Usa | Evita |
|---|---|---|
| Laravel | Breeze/Fortify + sesión; Sanctum para SPA/tokens; Socialite; Policies | JWT casero, guards inventados |
| Next.js | Auth.js (NextAuth) o Better Auth; sesión en cookie; middleware para proteger rutas | tokens en localStorage, lógica de auth en Client Components |
| Astro SSR | Sesión en cookie (middleware + `Astro.locals`); Better Auth/Lucia-style | auth solo en el cliente |
| FastAPI | fastapi-users o authlib; `Depends` para el usuario actual | validar JWT a mano sin librería |

## Checklist
- [ ] Cookies `HttpOnly; Secure; SameSite`; CSRF activo en formularios.
- [ ] Rate limit en login/registro/reset; mensajes que no filtran existencia de cuentas.
- [ ] Reset con token hasheado + caducidad + invalidación de sesiones.
- [ ] OAuth vincula por provider_id; email verificado antes de fusionar cuentas.
- [ ] Autorización en servidor en CADA acción; consultas filtradas por propietario (IDOR).
- [ ] Logout invalida servidor, no solo borra cookie. Sesiones listables/revocables.
