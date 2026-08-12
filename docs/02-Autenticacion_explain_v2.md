# Autenticación en `quini-api` — explicación inicial v2

Este documento explica la autenticación de `quini-api` con un nivel **más básico** que el documento técnico original.

La idea es que primero entiendas:

- qué intenta hacer el sistema,
- qué pasos sigue una petición,
- qué papel tiene cada fichero `.ts`,
- y cómo encajan todas las piezas.

> Si luego quieres ver el detalle completo y más técnico, puedes leer:
>
> - `/Users/jfernandez/Desarrollo/Proyectos/quini-api/docs/02-Autenticacion.md`
> - `/Users/jfernandez/Desarrollo/Proyectos/quini-api/docs/02-Autenticacion_explain.md`

---

## Resumen rápido

La autenticación de esta API funciona así:

1. El usuario entra con **email + contraseña** o con **Google**.
2. Si todo va bien, la API le devuelve:
   - un **access token**
   - y un **refresh token**
3. El **access token** se usa para entrar en rutas protegidas.
4. El **refresh token** se usa para conseguir tokens nuevos sin volver a poner la contraseña.
5. Si una ruta necesita permisos especiales, la API también mira el **rol** del usuario.

Si te quedas solo con una idea, que sea esta:

> **La autenticación sirve para saber quién eres. La autorización sirve para saber qué puedes hacer.**

---

## Antes de mirar código: los 4 conceptos principales

### 1. Contraseña

Es la forma clásica de demostrar quién eres.

La API no guarda la contraseña tal cual. Guarda un **hash** seguro.

### 2. Access token

Es el token que el cliente manda en las peticiones normales.

Sirve como un “pase temporal” para no enviar email y contraseña cada vez.

### 3. Refresh token

Sirve para renovar la sesión cuando el access token caduca.

### 4. Rol

El rol dice si un usuario puede hacer solo cosas normales o también tareas de administrador.

---

## Qué ficheros forman el sistema

Aquí tienes el mapa principal de ficheros:

| Fichero                               | Para qué sirve                             |
| ------------------------------------- | ------------------------------------------ |
| `src/modules/auth/auth.routes.ts`     | Declara las rutas de autenticación         |
| `src/modules/auth/auth.controller.ts` | Recibe la petición HTTP y llama al service |
| `src/modules/auth/auth.service.ts`    | Contiene la lógica principal del negocio   |
| `src/modules/auth/auth.repository.ts` | Habla con la base de datos                 |
| `src/modules/auth/auth.schemas.ts`    | Define qué datos espera cada endpoint      |
| `src/modules/auth/tokens.ts`          | Crea y valida tokens                       |
| `src/modules/auth/password.ts`        | Hace hash y verifica contraseñas           |
| `src/modules/auth/google.ts`          | Encapsula la autenticación con Google      |
| `src/middleware/require-auth.ts`      | Comprueba que el access token sea válido   |
| `src/middleware/require-role.ts`      | Comprueba el rol del usuario               |
| `src/middleware/validate.ts`          | Valida body, params y query con Zod        |
| `src/middleware/rate-limit.ts`        | Limita intentos repetidos                  |
| `src/middleware/error-handler.ts`     | Convierte errores en respuestas HTTP       |
| `src/config/env.ts`                   | Lee y valida variables de entorno          |
| `src/core/async-context.ts`           | Guarda el `requestId` de la petición       |

---

## La idea de arquitectura, explicada fácil

La app separa responsabilidades.

Eso significa que cada fichero tiene una tarea bastante concreta.

### Forma simple de verlo

- **routes**: dice qué rutas existen
- **controller**: recibe la petición y decide a qué lógica llamar
- **service**: toma las decisiones importantes
- **repository**: consulta o actualiza la base de datos
- **middleware**: hace comprobaciones reutilizables

Esto está bien porque evita meter todo en un único archivo gigante.

---

## Flujo general de una petición de autenticación

Cuando llega una petición, normalmente pasa por este camino:

1. **La ruta** recibe la URL correcta.
2. **Los middlewares** validan o protegen la petición.
3. **El controller** lee los datos y llama al service.
4. **El service** aplica la lógica principal.
5. **El repository** consulta o actualiza datos.
6. **El controller** devuelve la respuesta final.
7. Si algo falla, **error-handler** construye el error HTTP.

En versión muy resumida:

`route -> middleware -> controller -> service -> repository -> response`

---

## Flujo 1 — Login con email y contraseña

Este es el flujo más importante para empezar a entender el sistema.

### Qué endpoint se usa

`POST /auth/token`

con `grant_type = password`

### Flujo de llamadas

1. La ruta `/token` está en `auth.routes.ts`.
2. Antes de entrar al controller, pasan dos cosas:
   - `authRateLimit` limita intentos
   - `validate({ body: TokenRequestSchema })` revisa que el body tenga la forma correcta
3. Si todo está bien, se llama a `token()` en `auth.controller.ts`.
4. El controller mira el `grant_type`.
5. Si es `password`, llama a `loginWithPassword()` en `auth.service.ts`.
6. El service busca al usuario con `findUserByEmail()` en `auth.repository.ts`.
7. El service comprueba la contraseña usando `verify()` de `password.ts`.
8. Si la contraseña es correcta, el service llama a `issueTokenPair()`.
9. `issueTokenPair()`:
   - crea el access token con `signAccessToken()` de `tokens.ts`
   - crea un refresh token nuevo con `newRefreshToken()`
   - guarda el hash del refresh token en base de datos con `createRefreshToken()`
10. El controller devuelve los tokens al cliente.

### Qué aprende un estudiante aquí

- la ruta no decide la lógica
- el controller no toca directamente la base de datos
- el service coordina casi todo
- repository solo accede a datos

---

## Flujo 2 — Entrar en una ruta protegida

Ejemplo:

`GET /auth/me`

### Flujo de llamadas

1. La ruta está en `auth.routes.ts`.
2. Antes de ejecutar `me()`, pasa por `requireAuth`.
3. `requireAuth` busca la cabecera `Authorization`.
4. Si existe un `Bearer <token>`, llama a `verifyAccessToken()` en `tokens.ts`.
5. Si el token es válido, guarda la información en `req.auth`.
6. Entonces sí se ejecuta `me()` en `auth.controller.ts`.
7. El controller responde con los datos ya preparados en `req.auth`.

### Qué idea importante hay aquí

El controller `me()` es muy pequeño porque otra pieza ya hizo el trabajo de seguridad antes.

Eso hace el código más limpio.

---

## Flujo 3 — Renovar sesión con refresh token

Esto también usa:

`POST /auth/token`

pero ahora con:

`grant_type = refresh_token`

### Flujo de llamadas

1. La ruta `/token` vuelve a pasar por rate limit y validación.
2. El controller `token()` detecta que ahora el `grant_type` no es `password`.
3. Entonces llama a `refresh()` en `auth.service.ts`.
4. `refresh()` hace varias comprobaciones:
   - busca el token en base de datos por su hash
   - comprueba si existe
   - comprueba si fue revocado
   - comprueba si ha caducado
5. Si todo está bien:
   - revoca el refresh token antiguo
   - crea uno nuevo
   - genera también un nuevo access token
6. Devuelve el nuevo par de tokens.

### Qué idea importante hay aquí

El refresh token viejo se invalida cuando se usa.

Eso mejora la seguridad.

---

## Flujo 4 — Cerrar sesión o revocar tokens

Hay dos ideas aquí:

### A. Revocar un refresh token concreto

Ruta:

`POST /auth/revoke`

Flujo:

1. pasa por `requireAuth`
2. pasa por `validate()`
3. controller `revoke()`
4. service `revoke()`
5. repository `findRefreshTokenByHash()`
6. si existe y no estaba revocado, repository `revokeRefreshToken()`

### B. Cerrar todas las sesiones del usuario

Ruta:

`POST /auth/logout`

Flujo:

1. pasa por `requireAuth`
2. controller `logout()`
3. obtiene `req.auth.userId`
4. llama a `logoutAll()` en el service
5. el service llama a `revokeAllUserTokens()` en el repository

### Idea simple

- `revoke`: afecta a un refresh token concreto
- `logout`: afecta a todos los refresh tokens del usuario

---

## Flujo 5 — Registro con invitación

Ruta:

`POST /auth/register`

### Flujo de llamadas

1. la ruta pasa por `authRateLimit`
2. pasa por `validate({ body: RegisterRequestSchema })`
3. entra en `register()` del controller
4. el controller llama a `registerWithInvitation()` en el service
5. el service hace hash de la contraseña con `hash()` de `password.ts`
6. el service abre una transacción de base de datos
7. dentro de la transacción:
   - consume la invitación
   - crea el usuario
8. después emite los tokens con `issueTokenPair()`
9. el controller devuelve el resultado

### Qué idea importante hay aquí

El usuario no se crea libremente.

Primero tiene que haber una invitación válida.

---

## Flujo 6 — Login con Google

Hay dos formas principales:

- redirección a Google
- envío directo de un `id_token`

### A. Ruta `/auth/google`

1. `googleAuthorize()` en el controller llama a `createAuthorizationRequest()` en `google.ts`
2. `google.ts` prepara la URL de Google, el `state` y el `codeVerifier`
3. el controller guarda `state` y `codeVerifier` en una cookie firmada
4. el navegador es redirigido a Google

### B. Ruta `/auth/google/callback`

1. Google redirige de vuelta a la API
2. `googleCallback()` lee `code` y `state`
3. recupera la cookie firmada
4. comprueba que el `state` coincida
5. llama a `exchangeCodeForProfile()` en `google.ts`
6. `google.ts` valida el login con Google y devuelve un perfil
7. el controller llama a `loginWithGoogle()` en el service
8. el service decide qué hacer:
   - si la cuenta Google ya estaba vinculada, hace login
   - si existe usuario con ese email, vincula Google a ese usuario
   - si no existe, intenta crear usuario con invitación por email
9. después emite tokens propios de la API

### C. Ruta `/auth/google/id-token`

1. pasa por rate limit y validación
2. controller `googleIdToken()`
3. llama a `verifyGoogleIdToken()` en `google.ts`
4. obtiene el perfil
5. llama a `loginWithGoogle()` en el service
6. devuelve los tokens

### Qué idea debes quedarte

Google ayuda a identificar al usuario, pero la sesión final sigue siendo de `quini-api`.

---

## Qué hace cada fichero `.ts`, explicado fácil

## `src/modules/auth/auth.routes.ts`

### Qué contiene

Contiene la lista de endpoints de autenticación.

### Qué hace

Dice:

- qué URL existe
- qué método HTTP usa
- qué middlewares se aplican
- qué controller se ejecuta al final

### Ejemplos claros

- `/token` -> rate limit + validate + `token`
- `/me` -> `requireAuth` + `me`
- `/logout` -> `requireAuth` + `logout`

### Cómo pensar este fichero

Es como la **tabla de entradas** del módulo de autenticación.

---

## `src/modules/auth/auth.controller.ts`

### Qué contiene

Las funciones controller de cada endpoint.

### Qué hace

Se encarga de:

- leer `req.body`, `req.query` o `req.auth`
- llamar al service correcto
- devolver la respuesta HTTP
- poner cabeceras como `Cache-Control: no-store`

### Qué NO hace

No contiene la lógica fuerte de negocio.

Por ejemplo, no decide cómo se firma un token ni cómo se busca un usuario en base de datos.

### Funciones importantes

- `token()` -> login por password o refresh
- `revoke()` -> revoca un refresh token
- `logout()` -> cierra todas las sesiones
- `me()` -> devuelve el usuario autenticado
- `register()` -> registra con invitación
- `googleAuthorize()` -> inicia Google OAuth
- `googleCallback()` -> procesa el retorno desde Google
- `googleIdToken()` -> login por `id_token`

---

## `src/modules/auth/auth.service.ts`

### Qué contiene

La lógica principal del sistema de autenticación.

### Qué hace

Aquí se toman las decisiones importantes:

- si una contraseña es válida
- cuándo emitir tokens
- cómo renovar tokens
- qué hacer si un refresh token fue revocado
- cómo registrar usuarios con invitación
- cómo actuar si el login viene de Google

### Funciones clave

#### `issueTokenPair()`

Es una función central.

Crea:

- access token
- refresh token
- registro del refresh token en base de datos

#### `loginWithPassword()`

Hace login clásico con email y contraseña.

#### `refresh()`

Renueva la sesión usando refresh token.

#### `revoke()`

Revoca un refresh token concreto.

#### `logoutAll()`

Revoca todos los refresh tokens de un usuario.

#### `registerWithInvitation()`

Crea un usuario nuevo a partir de una invitación.

#### `loginWithGoogle()`

Gestiona los diferentes casos del login con Google.

### Cómo pensar este fichero

Es el **cerebro** del módulo.

---

## `src/modules/auth/auth.repository.ts`

### Qué contiene

Funciones para leer y escribir datos de autenticación en la base de datos.

### Qué hace

- busca usuarios
- crea usuarios
- guarda refresh tokens
- busca refresh tokens
- revoca tokens
- busca o crea cuentas OAuth de Google

### Funciones principales

- `findUserByEmail()`
- `findUserById()`
- `createUser()`
- `createRefreshToken()`
- `findRefreshTokenByHash()`
- `revokeRefreshToken()`
- `revokeFamily()`
- `revokeAllUserTokens()`
- `findOAuthAccount()`
- `createOAuthAccount()`

### Qué NO hace

No devuelve códigos HTTP ni decide reglas funcionales.

Solo trabaja con datos.

---

## `src/modules/auth/auth.schemas.ts`

### Qué contiene

Esquemas Zod para validar los datos de entrada y salida.

### Qué hace

Describe qué forma deben tener los datos.

### Ejemplos

#### `TokenRequestSchema`

Acepta dos tipos de petición:

- login con `password`
- refresh con `refresh_token`

#### `RegisterRequestSchema`

Exige:

- `token`
- `password`
- `nombre`

#### `GoogleIdTokenRequestSchema`

Exige:

- `id_token`

### Cómo pensar este fichero

Es como el **contrato** de datos del módulo.

---

## `src/modules/auth/tokens.ts`

### Qué contiene

Funciones relacionadas con los tokens.

### Qué hace

- firma access tokens
- verifica access tokens
- genera refresh tokens aleatorios
- calcula el hash del refresh token

### Funciones principales

#### `signAccessToken()`

Crea el JWT del access token.

#### `verifyAccessToken()`

Comprueba que ese JWT sea válido.

#### `newRefreshToken()`

Crea un token aleatorio nuevo.

#### `hashRefresh()`

Transforma el refresh token en un hash para guardarlo en base de datos.

### Idea importante

El refresh token real no se guarda directamente: se guarda su hash.

---

## `src/modules/auth/password.ts`

### Qué contiene

Las utilidades para contraseñas.

### Qué hace

- `hash()` crea el hash de una contraseña
- `verify()` compara una contraseña con su hash

### Cómo pensar este fichero

Es un fichero pequeño, pero muy importante: encapsula el uso de Argon2.

---

## `src/modules/auth/google.ts`

### Qué contiene

Todo lo específico de Google OAuth.

### Qué hace

- comprueba que la configuración de Google exista
- prepara la URL para iniciar login con Google
- intercambia el `code` por datos del usuario
- verifica un `id_token`
- extrae el perfil de Google de forma segura

### Funciones importantes

- `requireGoogleConfig()`
- `createAuthorizationRequest()`
- `exchangeCodeForProfile()`
- `verifyGoogleIdToken()`
- `extractProfile()`

### Cómo pensar este fichero

Es el **adaptador** entre la API y Google.

---

## `src/middleware/require-auth.ts`

### Qué contiene

El middleware que protege rutas autenticadas.

### Qué hace

- mira si existe header `Authorization`
- comprueba que empiece por `Bearer `
- valida el token
- guarda los datos del usuario en `req.auth`

### Idea importante

Gracias a este middleware, los controllers no tienen que volver a verificar el token una y otra vez.

---

## `src/middleware/require-role.ts`

### Qué contiene

Un middleware reutilizable para exigir un rol concreto.

### Qué hace

Comprueba si `req.auth?.role` coincide con el rol exigido.

Si no coincide, lanza error 403.

### Idea simple

- `requireAuth` comprueba identidad
- `requireRole` comprueba permisos

---

## `src/middleware/validate.ts`

### Qué contiene

Middleware genérico de validación.

### Qué hace

Usa los esquemas Zod para validar:

- `body`
- `params`
- `query`

Si algo no cumple el esquema, lanza error.

### Cómo pensar este fichero

Es una puerta de entrada para evitar que la lógica de negocio reciba datos mal formados.

---

## `src/middleware/rate-limit.ts`

### Qué contiene

La configuración del limitador de peticiones.

### Qué hace

Protege rutas sensibles frente a demasiados intentos.

En este módulo se usa sobre todo en:

- `/auth/token`
- `/auth/register`
- endpoints de Google

### Idea simple

Sirve para poner freno a intentos repetidos, por ejemplo ataques de fuerza bruta.

---

## `src/middleware/error-handler.ts`

### Qué contiene

El middleware final de manejo de errores.

### Qué hace

Convierte errores internos en respuestas HTTP bien formadas.

Por ejemplo:

- errores de negocio (`AppError`)
- errores de validación (`ZodError`)
- JSON mal formado
- errores inesperados

### Idea importante

Con este fichero, el resto del código puede lanzar errores y dejar que un único sitio construya la respuesta final.

---

## `src/config/env.ts`

### Qué contiene

La lectura y validación de variables de entorno.

### Qué hace

Comprueba que existan valores importantes como:

- `JWT_SECRET`
- `ACCESS_TOKEN_TTL`
- `REFRESH_TOKEN_TTL`
- variables de Google
- URLs base

### Idea simple

Si la configuración está mal, la app falla pronto al arrancar, en vez de fallar más tarde de forma confusa.

---

## `src/core/async-context.ts`

### Qué contiene

El contexto de petición con `AsyncLocalStorage`.

### Qué hace

Permite recuperar el `requestId` actual.

### Para qué sirve

Ese `requestId` ayuda a relacionar:

- logs del servidor
- errores devueltos al cliente

---

## Qué orden seguiría yo para estudiar estos ficheros

Si eres principiante, te recomiendo este orden:

1. `auth.routes.ts`
2. `auth.controller.ts`
3. `auth.service.ts`
4. `auth.repository.ts`
5. `tokens.ts`
6. `password.ts`
7. `require-auth.ts`
8. `require-role.ts`
9. `auth.schemas.ts`
10. `google.ts`
11. `rate-limit.ts`
12. `error-handler.ts`
13. `env.ts`

¿Por qué este orden?

Porque así primero ves el camino principal de la petición y luego bajas al detalle.

---

## Errores de concepto que conviene evitar

### Error 1: pensar que el controller lo hace todo

No. El controller coordina, pero la lógica fuerte está en el service.

### Error 2: pensar que el repository decide permisos

No. El repository solo mueve datos.

### Error 3: pensar que autenticar y autorizar es lo mismo

No. Son dos comprobaciones distintas.

### Error 4: pensar que el refresh token es igual que el access token

No. Tienen funciones distintas.

### Error 5: pensar que Google sustituye toda la autenticación de la app

No. Google solo ayuda a identificar. La sesión y los permisos siguen siendo de la API.

---

## Resumen final

Si miras este sistema desde lejos, la historia es esta:

- `routes` recibe la petición
- `middleware` la protege o la valida
- `controller` la encamina
- `service` decide qué hacer
- `repository` toca la base de datos
- `tokens` y `password` resuelven la parte criptográfica
- `google.ts` gestiona el caso especial de Google
- `error-handler` unifica los errores

Ese reparto hace que el sistema sea más fácil de entender, explicar y mantener.

---

## Ejercicio recomendado

Prueba este ejercicio mientras lees el código:

### Ejercicio 1

Sigue el flujo completo de `POST /auth/token` con contraseña.

### Ejercicio 2

Sigue el flujo completo de `GET /auth/me`.

### Ejercicio 3

Busca en qué punto exacto se genera el refresh token.

### Ejercicio 4

Busca en qué punto exacto se valida el JWT.

### Ejercicio 5

Busca en qué punto exacto se decide si Google crea usuario, vincula usuario o solo hace login.

Si puedes responder esas 5 cosas, ya tendrás una visión muy buena del módulo.
