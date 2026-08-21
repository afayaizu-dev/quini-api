# Insomnia: colección, entornos y helper de OAuth2

> **Ámbito de este documento**: lo implementado en **F9** del plan (`00-Plan-inicial.md`) — importar `openapi/openapi.json` en Insomnia, configurar el helper de OAuth2 para no pegar tokens a mano, los entornos de rol, y la exportación versionada de la colección. Queda pendiente (baja prioridad) el flujo de Google con Authorization Code + PKCE.
>
> **Para quién**: documento de estudio y, sobre todo, **chuleta**. La parte de código de este proyecto se entiende leyendo los ficheros; Insomnia es una herramienta de interfaz gráfica que cambia de versión en versión, y aquí quedan anotadas las trampas concretas con las que nos tropezamos configurándola, para no tener que redescubrirlas la próxima vez.

---

## Índice

1. [Objetivo de F9](#1-objetivo-de-f9)
2. [Tipo de almacenamiento del proyecto](#2-tipo-de-almacenamiento-del-proyecto)
3. [Generar la colección](#3-generar-la-colección)
   - 3.1. [El import manual (procedimiento original de F9)](#31-el-import-manual-procedimiento-original-de-f9)
4. [La trampa de los dos niveles de entornos](#4-la-trampa-de-los-dos-niveles-de-entornos)
5. [El helper de OAuth2 (Resource Owner Password Credentials)](#5-el-helper-de-oauth2-resource-owner-password-credentials)
6. [Herencia de autenticación entre carpetas](#6-herencia-de-autenticación-entre-carpetas)
7. [Login con Google (Authorization Code + PKCE)](#7-login-con-google-authorization-code--pkce)
8. [Chuleta: síntoma → causa real → solución](#8-chuleta-síntoma--causa-real--solución)
9. [Lo que falta](#9-lo-que-falta)
10. [Glosario](#10-glosario)

---

## 1. Objetivo de F9

Tener una colección de Insomnia **funcional y versionada** (exportada a `insomnia/quini-api.insomnia.yaml`, comiteada y pusheada) que:

- Se genera automáticamente a partir de `openapi/openapi.json` (F7) — no se escriben peticiones a mano. **Desde la revisión de 2026-08-21, con `npm run insomnia:generate` en vez de con el import de la app (ver §3).**
- Obtiene y renueva el access token sola, vía un helper de OAuth2, sin que haya que copiar `Authorization: Bearer ...` en cada petición.
- Permite cambiar de rol (`admin`/`user`) con un simple cambio de entorno, para comprobar los `403` sin editar ninguna petición.
- Se puede ejecutar también desde terminal (y más adelante CI) con `inso`.

---

## 2. Tipo de almacenamiento del proyecto

Al crear un proyecto nuevo, Insomnia pregunta entre **Local Vault**, **Cloud Sync** y **Git Sync**. Se eligió **Local Vault**:

| Opción          | Qué hace                                                                          | Por qué (no) se usa aquí                                                                                                                                                     |
| --------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local Vault** | Todo vive cifrado solo en el disco local; tú decides cuándo exportar              | **Elegida**: encaja con el paso explícito del plan de exportar a mano a un `.yaml` versionado en el repo — tú controlas el momento exacto en que la colección "entra" en git |
| **Cloud Sync**  | Sincroniza con la cuenta de Insomnia/Kong                                         | Añade una dependencia externa que el plan no pide; la fuente de verdad dejaría de ser solo el repo                                                                           |
| **Git Sync**    | Sincroniza el proyecto directamente y de forma continua contra un repositorio git | Es un flujo distinto (automático) al que describe el plan (export puntual y manual) — no está mal, pero no es lo que se sigue aquí                                           |

---

## 3. Generar la colección

> **Cambio respecto a F9**: la colección ya no se importa a mano. La genera `npm run insomnia:generate` a partir de `openapi/openapi.json`. Lo que sigue en esta sección describe el generador; el import manual queda documentado en §3.1 porque las trampas que descubrió siguen explicando por qué el generador hace lo que hace.

```bash
npm run insomnia:generate
```

Lee `openapi/openapi.json`, escribe `insomnia/quini-api.insomnia.yaml` y le pasa Prettier (igual que hace CI con el propio contrato). Después, en la app: `Create → Import → File` → seleccionar ese `.yaml`.

**Qué resuelve respecto al import de la app**:

| Problema del import manual                                                              | Qué hace el generador                                                                                                                  |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Deja las 51 peticiones con `{{ bearerToken }}`, variable que nunca se define (§6)       | Las emite con `{{ _.accessToken }}`, que sí existe en los entornos generados                                                           |
| Crea una carpeta por `tag` sin contenedor común, y hay que mover carpetas a mano (§3.1) | Emite las 11 carpetas ya ordenadas según el orden de `tags` de la spec                                                                 |
| Cada export genera ids y timestamps nuevos: el diff en git es ruido                     | Los ids se derivan de `sha1(método + ruta)` y el timestamp es fijo — dos ejecuciones con el mismo contrato dan un fichero **idéntico** |
| Se queda atrás en silencio en cuanto cambia el contrato                                 | Se regenera con un comando; el fichero es un derivado del contrato, no una copia manual                                                |
| No rellena el cuerpo de `POST /auth/token`                                              | Usa los `examples` del contrato: el grant de contraseña llega con `grant_type`, `username` y `password` puestos                        |

**Los entornos que emite** (todos en _Collection Environments_, que es el nivel que las peticiones sí resuelven — ver §4):

| Entorno            | `base_url`                        | `accessToken`                    |
| ------------------ | --------------------------------- | -------------------------------- |
| `Base environment` | `http://localhost:3000/api/v1`    | vacío                            |
| `Local · admin`    | `http://localhost:3000/api/v1`    | pegar aquí el token del admin    |
| `Local · user`     | `http://localhost:3000/api/v1`    | pegar aquí el token de un `user` |
| `Producción`       | `https://api.quiniweb.com/api/v1` | vacío                            |

**Por qué un `accessToken` a mano y no el helper de OAuth2**: por el bug de §4.1. El helper cachea el token por carpeta y no lo renueva al cambiar de entorno, que era justo lo que hacía falta para comprobar los `403` de rol. Con dos entornos que solo difieren en el `accessToken`, cambiar de rol es cambiar de entorno y ya está — sin helper, sin caché y sin el workaround manual de §4.1. El token se obtiene una vez con `POST /auth/token` (petición pública, `Auth: No Auth`) y se pega en el entorno.

**Las 51 peticiones por dominio**: auth 8 · invitaciones 2 · temporadas 6 · equipos 5 · jornadas 8 · usuarios 5 · resultados 3 · apuestas 5 · cálculos 2 · pagos 4 · dashboard 3. De ellas, 46 llevan token y 23 están marcadas `[Solo admin]` en su descripción, tomado del `x-required-role` del contrato.

---

## 3.1. El import manual (procedimiento original de F9)

`Create → Import → File` → seleccionar `openapi/openapi.json`. Dos detalles que no son evidentes a la primera:

- **Se abre en "modo documento"**: tres pestañas, `Spec` / `Collection` / `Tests`. `Spec` es solo el JSON crudo de la spec (de solo lectura, tal cual se generó en F7); las peticiones importadas y ejecutables viven en la pestaña **`Collection`**.
- **No se genera una única "carpeta raíz"**: Insomnia crea **una carpeta por cada `tag`** de la spec. Como `src/openapi/generate.ts` define dos tags (`auth`, `invitaciones`), el resultado son dos carpetas de nivel superior, sin ningún nodo común por encima de ambas en el árbol de la colección.

Esto último importa para el siguiente paso: si se quiere un único sitio donde configurar la autenticación (como pide el plan), hay que **crear una carpeta nueva y mover dentro las carpetas generadas** (`auth`, `invitaciones`) — el import no deja ya preparado ese contenedor común.

---

## 4. La trampa de los dos niveles de entornos

Esta versión de Insomnia distingue dos grupos de entornos, visibles al abrir el desplegable de entornos dentro de la pestaña `Collection`:

- **Project Environments**: entornos que cuelgan del **proyecto** (`quini-api`), al mismo nivel que el propio documento de la spec. Aparecen en el árbol de la izquierda como ficheros hermanos de `quini-api 1.0.0`.
- **Collection Environments**: entornos específicos de **esa colección concreta** (`Base environment`, y un `OpenAPI env null` generado automáticamente al importar) — son los que de verdad usan las peticiones de `auth`/`invitaciones`.

**La trampa**: es muy fácil crear el entorno `Local` (con `base_url`, `access_token`, `refresh_token`) desde el desplegable equivocado y que acabe como un _Project Environment_ — se ve perfectamente bien (las variables están ahí, con los valores correctos), pero las peticiones de la colección **no lo ven**, porque ellas resuelven sus variables contra los _Collection Environments_, un espacio completamente distinto.

**Síntoma de este error concreto**: el "URL PREVIEW" de una petición se queda en `...` en vez de mostrar la URL ya resuelta (por ejemplo `http://localhost:3000/api/v1/auth/me`) — es la señal de que una variable referenciada en la URL no se está resolviendo.

**Solución**: editar (o crear) el entorno directamente dentro de **Collection Environments**, no en Project Environments. Ambos pueden coexistir sin problema (el de nivel de proyecto simplemente no se usa aquí).

### 4.1. Bug conocido: el token OAuth2 se queda cacheado al cambiar de entorno de rol

Para probar el `403` de rol (Q4 del plan), la idea era crear dos entornos, `Local-admin` y `Local-user`, con el helper de OAuth2 de la carpeta apuntando a variables (`{{ _.username }}`/`{{ _.password }}`) en vez de credenciales fijas — así, cambiar de entorno activo cambiaría con quién te autenticas, sin tocar ninguna petición.

**No funciona en la práctica**: Insomnia cachea el token ya obtenido por el helper de OAuth2 de una carpeta, y cambiar el entorno activo (o incluso pulsar "Clear OAuth 2 session"/"Refresh Token") no siempre fuerza a pedir uno nuevo — se comprobó decodificando el JWT realmente enviado, y seguía siendo el del admin aunque `Local-user` estuviera activo. **No es un error de configuración nuestro**: es un bug reconocido de Insomnia, documentado en varios issues de su repositorio (`Kong/insomnia#260`, `#8374`, `#2042`).

**Workaround manual usado aquí** (solo para esta comprobación puntual, no para el día a día):

1. Llamar directamente a `POST /auth/token` (grant `password`) con el usuario de rol `user`, en `Auth: No Auth` (esa ruta es pública) — copiar el `access_token` de la respuesta.
2. En la petición que se quiere probar (p. ej. `POST /invitaciones`), cambiar temporalmente su Auth de "Inherit from Parent" a **Bearer Token** y pegar ese `access_token`.
3. Enviar la petición — ahora sí refleja el rol real (`403` para un `user` contra un endpoint de admin).
4. Al terminar, devolver esa petición a "Inherit from Parent" para que vuelva a usar el helper de admin normal.

---

## 5. El helper de OAuth2 (Resource Owner Password Credentials)

En la carpeta que envuelve a `auth`/`invitaciones` → pestaña **Auth** → tipo **OAuth 2.0**:

| Campo                  | Valor                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grant Type             | **Resource Owner Password Credentials** (el nombre formal, RFC 6749, del grant que el plan llama "Password Credentials")                              |
| Username               | `admin@quini.local`                                                                                                                                   |
| Password               | la del admin creado con `admin:create`                                                                                                                |
| Access Token URL       | `{{ _.base_url }}/auth/token`                                                                                                                         |
| Credentials (Advanced) | **In Request Body** (no como Basic Auth en la cabecera — nuestro `TokenRequestSchema` espera `grant_type`/`username`/`password` como campos del body) |

`{{ _.base_url }}` es la sintaxis actual de Insomnia para referenciar una variable de entorno (`_.` es el espacio de nombres del entorno activo).

**El fallo más tonto y el más fácil de cometer**: dejar el campo **Access Token URL** vacío sin darse cuenta al rellenar el formulario. Sin él, el resto de campos (usuario, contraseña, grant type) pueden estar perfectos y aun así la API nunca llega a recibir la petición de token — el síntoma es un `401 UNAUTHORIZED` de la propia API (la petición sí llega, pero sin ningún `Authorization` válido), distinto del error de "URL inválida" que da un `base_url` sin resolver.

---

## 6. Herencia de autenticación entre carpetas

Cuando se configura el OAuth2 en una carpeta, las peticiones que cuelgan de ella **no lo heredan automáticamente por defecto** en todos los casos:

- **El import de OpenAPI configura cada petición protegida (`bearerAuth` en la spec) con su propio Auth en "Bearer Token"**, apuntando a una variable genérica `{{ bearerToken }}` que nunca se define — hay que entrar en la pestaña `Auth` de **cada petición** y cambiarla a **"Inherit from Parent"** para que use el OAuth2 de la carpeta en vez de ese Bearer Token suelto.
- **Si hay carpetas anidadas** (por ejemplo, la carpeta envolvente con el OAuth2, y dentro de ella la carpeta `auth` generada por el import), cada nivel intermedio necesita **también** estar en "Inherit from Parent" en su propia pestaña `Auth` — si una carpeta intermedia tiene su Auth puesta en "No Auth" en vez de heredar, la cadena se corta ahí y nunca llega al OAuth2 de más arriba, aunque la petición final sí esté en "Inherit from Parent".

En resumen, la cadena completa que tiene que estar en "Inherit from Parent" (o llegar hasta donde vive el OAuth2 real) es: **petición → carpeta `auth` → carpeta envolvente (OAuth2 configurado aquí)**.

---

## 7. Login con Google (Authorization Code + PKCE)

Sirve para probar `POST /auth/google/id-token` con un `id_token` **real** de Google, sin necesitar un frontend con la librería JS de Google — cerrando un hueco que quedó pendiente desde F6 (ver `docs/02-Autenticacion.md`).

**Prerrequisitos**:

- Tu app de Google sigue en modo "Testing" en Google Cloud Console — la cuenta de Google con la que inicies sesión tiene que estar en la lista de "test users", o Google rechaza el login.
- El email de esa cuenta real casi seguro no tiene invitación ni usuario en tu BD de desarrollo. Invítalo antes con `POST /invitaciones` (con el helper de admin ya funcionando) para obtener un `200` en vez de un `403 REGISTRATION_NOT_ALLOWED` — ambos son resultados válidos, pero el `200` es el que de verdad ejercita todo el flujo de creación.

**Configuración** (carpeta nueva, p. ej. `Google (Authorization Code)` → pestaña Auth → OAuth 2.0 → Grant Type: Authorization Code):

| Campo             | Valor                                                             |
| ----------------- | ----------------------------------------------------------------- |
| Authorization URL | `https://accounts.google.com/o/oauth2/v2/auth`                    |
| Access Token URL  | `https://oauth2.googleapis.com/token`                             |
| Client ID         | el de `.env` (`GOOGLE_CLIENT_ID`)                                 |
| Client Secret     | el de `.env` (`GOOGLE_CLIENT_SECRET`)                             |
| Redirect URI      | **`https://app.insomnia.rest/oauth/redirect`** (ver trampa abajo) |
| Scope             | `openid email profile`                                            |
| PKCE              | activado                                                          |

**La trampa del Redirect URI**: Insomnia no usa la URL de callback de tu propio backend (`.../auth/google/callback`) para capturar la redirección — usa una URI propia suya que intercepta internamente. Buscando en la documentación de Insomnia se sugiere `http://insomnia`, pero **en la versión 13.1.0 la real es `https://app.insomnia.rest/oauth/redirect`**. Si usas cualquier otra, Google responde con:

```
Error 400: redirect_uri_mismatch
```

Hay que **añadir esa URI a la lista de "Authorized redirect URIs"** del Client ID en Google Cloud Console (Console → APIs & Services → Credentials), sin quitar la que ya tienes para tu backend real — un mismo Client ID admite varias.

**Tras el login**, Insomnia muestra la respuesta de Google con dos tokens: `access_token` y **`identity_token`** (así llama Insomnia al `id_token` — mismo JWT, solo el nombre del campo cambia). Es el `identity_token` el que hay que copiar.

**Última trampa**: al pegar el `identity_token` en la petición `POST /auth/google/id-token`, comprueba que va **solo en el body** (`{ "id_token": "..." }`) y no también en la pestaña "Params" de la petición como query string — si se cuela ahí, la petición puede acabar devolviendo un `500 INTERNAL_ERROR` en vez del `200` esperado, con un body de la petición inconsistente con lo que crees que has enviado.

---

## 8. Chuleta: síntoma → causa real → solución

| Síntoma / error                                                                                                                             | Causa real                                                                                                                                        | Solución                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No aparece pestaña "Auth" en ningún sitio evidente                                                                                          | Hay que hacer clic directamente sobre el **nombre de la carpeta** (o de la colección) en el árbol, no sobre una petición dentro de ella           | Clic en el nodo de la carpeta/colección → se abre un panel propio con pestañas `Auth`/`Headers`/`Docs`                                                              |
| Solo aparecen "Authorization Code", "Implicit", "Resource Owner Password Credentials", "Client Credentials" en el desplegable de grant type | Es el nombre formal RFC 6749; no existe una opción literal llamada "Password Credentials"                                                         | Elegir **Resource Owner Password Credentials**                                                                                                                      |
| El import no genera una carpeta raíz única                                                                                                  | Insomnia crea una carpeta por cada `tag` de la spec (aquí: `auth`, `invitaciones`), sin contenedor común                                          | Crear una carpeta nueva y mover dentro las carpetas generadas, o configurar el OAuth2 por separado en cada una                                                      |
| `Error: Couldn't resolve host name`                                                                                                         | Una variable de la URL (`{{ _.base_url }}`) no se resolvió — se intentó conectar literalmente al texto sin resolver                               | Comprobar qué entorno está activo y en qué variables vive `base_url` (ver fila siguiente)                                                                           |
| `TypeError: Failed to construct 'URL': Invalid URL`                                                                                         | Igual que arriba: la URL resultante, tras sustituir variables, no es válida                                                                       | Mismo diagnóstico: revisar el entorno activo y dónde vive la variable                                                                                               |
| "1 environment variable is missing: bearerToken"                                                                                            | El import puso "Bearer Token" como Auth de esa petición concreta, con una variable que no existe                                                  | Cambiar el Auth de esa petición a "Inherit from Parent"                                                                                                             |
| El "URL PREVIEW" de una petición se queda en `...`                                                                                          | La variable referenciada en la URL no se resuelve — normalmente, vive en el entorno equivocado                                                    | Comprobar que la variable está en **Collection Environments**, no en **Project Environments**                                                                       |
| `401 UNAUTHORIZED` de la propia API, aunque el OAuth2 parece bien configurado                                                               | El campo **Access Token URL** del OAuth2 se quedó vacío                                                                                           | Rellenarlo con `{{ _.base_url }}/auth/token`                                                                                                                        |
| Una carpeta intermedia corta la herencia de Auth                                                                                            | Esa carpeta tiene su propio Auth en "No Auth" en vez de "Inherit from Parent"                                                                     | Poner "Inherit from Parent" en **todos** los niveles de la cadena, no solo en la petición final                                                                     |
| Al cambiar de entorno (`Local-admin` → `Local-user`), la petición sigue usando el token del admin (comprobado decodificando el JWT enviado) | Bug conocido de Insomnia: el token OAuth2 de una carpeta se cachea y no siempre se refresca al cambiar de entorno, ni con "Clear OAuth 2 session" | Workaround manual: pedir el token con `POST /auth/token` aparte y pegarlo como "Bearer Token" en la petición concreta que se está probando (ver §4.1)               |
| `FATAL Expected an Insomnia v4 export file; unexpected data found` al correr `inso run test`                                                | El paquete de npm `insomnia-inso` está descontinuado y congelado en v3.6.0, que solo entiende el formato v4; Insomnia 13 exporta en v5            | Sin solución limpia hoy — el `inso` mantenido de verdad se distribuye por GitHub releases de `Kong/insomnia`, no por npm (ver §9)                                   |
| `Error 400: redirect_uri_mismatch` al iniciar sesión con Google desde el helper OAuth2 de Insomnia                                          | El Redirect URI configurado no es uno de los registrados en Google Cloud Console para ese Client ID                                               | Usar `https://app.insomnia.rest/oauth/redirect` (la real en v13.1.0, no `http://insomnia`) y añadirla a "Authorized redirect URIs" en Google Cloud Console (ver §7) |
| `500 INTERNAL_ERROR` al enviar un `id_token`/`identity_token` real a `POST /auth/google/id-token`, aunque el body parece correcto           | El valor se coló también como query string en la URL de la petición (pestaña "Params"), no solo en el body                                        | Quitarlo de "Params", dejarlo solo en el body JSON                                                                                                                  |

---

## 9. Lo que falta

- **Entornos de rol** (`Local-admin`, `Local-user`): creados, con un usuario `user@quini.local` real (invitado y registrado a través de la propia colección). El cambio de entorno para el helper de OAuth2 automático no funciona por el bug descrito en §4.1 — la comprobación del `403` se hace con el workaround manual documentado ahí, no de forma tan fluida como preveía el plan.
- **`npm run insomnia:test` no funciona todavía, y no es un fallo de configuración nuestro**: el paquete `insomnia-inso` de npm está **descontinuado** ("Use at your own risk" en su propia página de npm), congelado en la versión `3.6.0`. Insomnia 13 exporta en un formato v5 (YAML) que esa versión de `inso` no entiende — falla con `FATAL Expected an Insomnia v4 export file`. El `inso` que Kong mantiene de verdad ahora se distribuye por los _releases_ de GitHub de `Kong/insomnia`, no por este paquete de npm, y ni siquiera esa versión más reciente tiene el soporte de v5 totalmente resuelto (issue abierto `Kong/insomnia#8599`). Se deja documentado como limitación externa conocida; la colección se sigue usando con normalidad desde la propia app de Insomnia. Retomar esto cuando el proyecto conecte de verdad con CI, evaluando entonces si instalar el binario desde GitHub releases en vez de este paquete de npm.

---

## 10. Glosario

- **Grant type**: la variante concreta del protocolo OAuth2 que se usa para obtener un token — aquí, "Resource Owner Password Credentials" (usuario/contraseña directos), distinto del "Authorization Code" que se usa para el login con Google.
- **Inherit from Parent**: opción de la pestaña Auth de una petición o carpeta que le dice "no definas tu propia autenticación, usa la que tenga configurada quien te contiene".
- **Project Environment vs. Collection Environment**: dos espacios de variables distintos en Insomnia; el primero vive a nivel de proyecto (hermano de los documentos/colecciones), el segundo es específico de una colección concreta — una petición solo resuelve variables del segundo.
- **Local Vault**: modo de almacenamiento de un proyecto de Insomnia en el que los datos viven solo en el disco local, sin sincronización externa, hasta que se exportan manualmente.
