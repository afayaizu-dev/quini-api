# Plan inicial — API Quiniela (REST autenticada)

> **Estado**: propuesta de trabajo con decisiones cerradas. Nada implementado todavía.
> **Fuente**: `prompts/00-plan-inicial.md`
> **Fecha**: 2026-08-06
> **Versión**: v3 — incorpora las respuestas a Q1–Q8 (§0) y la estrategia de observabilidad (§16, fase F13)
> **Objetivo del documento**: definir arquitectura, decisiones técnicas y un plan de ejecución por fases, con los comandos exactos para construirlo a mano y entender cada pieza.

---

## Índice

0. [Decisiones cerradas y su impacto](#0-decisiones-cerradas-y-su-impacto)
1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Estado actual del entorno](#2-estado-actual-del-entorno)
3. [Decisiones de arquitectura (ADR-lite)](#3-decisiones-de-arquitectura-adr-lite)
4. [Stack definitivo y para qué sirve cada pieza](#4-stack-definitivo-y-para-qué-sirve-cada-pieza)
5. [Arquitectura de la aplicación](#5-arquitectura-de-la-aplicación)
6. [Estructura de carpetas](#6-estructura-de-carpetas)
7. [Modelo de datos](#7-modelo-de-datos)
8. [Diseño de autenticación y autorización](#8-diseño-de-autenticación-y-autorización)
9. [Catálogo de endpoints](#9-catálogo-de-endpoints)
10. [Contrato de errores](#10-contrato-de-errores)
11. [Estrategia de documentación (OpenAPI)](#11-estrategia-de-documentación-openapi)
12. [Estrategia de base de datos local (docker vs embebida)](#12-estrategia-de-base-de-datos-local-docker-vs-embebida)
13. [Estrategia de testing](#13-estrategia-de-testing)
14. [Plan de fases con comandos](#14-plan-de-fases-con-comandos)
15. [Despliegue en VPS](#15-despliegue-en-vps)
16. [Observabilidad](#16-observabilidad)
17. [Roadmap y estimación](#17-roadmap-y-estimación)
18. [Checklist maestro](#18-checklist-maestro)
19. [Riesgos y decisiones que quedan abiertas](#19-riesgos-y-decisiones-que-quedan-abiertas)
20. [Convenciones del proyecto](#20-convenciones-del-proyecto)
21. [Glosario para aprender](#21-glosario-para-aprender)

---

## 0. Decisiones cerradas y su impacto

| #   | Pregunta                 | Respuesta                    | Impacto en el plan                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Versionado de rutas      | **`/api/v1`**                | Todas las rutas llevan prefijo: `/api/v1/jornadas` en lugar de `/api/jornadas`                                                                                                                                                                                                                                              |
| Q2  | Registro de usuarios     | **Invitación + admin**       | Nuevo módulo `invitations` (tabla, endpoints, TTL, un solo uso) + script CLI para crear el **primer admin**. El login con Google también queda **cerrado por invitación**; si no, sería una puerta trasera de registro abierto                                                                                              |
| Q3  | Roles                    | **`user` + `admin`**         | Columna `role` con `CHECK`, claim `role` en el JWT, middleware `requireRole`                                                                                                                                                                                                                                                |
| Q4  | Quién gestiona jornadas  | **Solo `admin`**             | `GET` para cualquier autenticado; `POST`/`PUT`/`DELETE` solo admin → **403** para `user`. Añade casos a la matriz de tests                                                                                                                                                                                                  |
| Q5  | Refresh token            | **En el body**               | Sin cookie para el refresh. `cookie-parser` se mantiene **solo** para la cookie firmada de `state` del flujo de Google                                                                                                                                                                                                      |
| Q6  | `temporada` en el modelo | **Ya**                       | **El cambio más grande.** Nueva entidad `temporadas`, `jornadas.temporada_id` obligatorio, unicidad pasa a `UNIQUE (temporada_id, numero_jornada)`, nuevo módulo antes de Jornadas, y el recurso `Jornada` gana el campo `temporada`. Forma de las rutas: ver D17                                                           |
| Q7  | Despliegue               | **VPS**                      | Fase final concreta: Docker Compose en el VPS + Caddy con HTTPS automático, imagen en GHCR, backups `pg_dump`, firewall, Postgres **no expuesta** a internet. Ver §15                                                                                                                                                       |
| Q8  | Password grant (ROPC)    | **Sí**                       | Se implementa `POST /api/v1/auth/token` con forma de password grant, con el matiz de seguridad documentado en §3                                                                                                                                                                                                            |
| Q10 | Versión de PostgreSQL    | **18 en todos los entornos** | `postgres:18-alpine` en Docker (desarrollo y producción) y `embedded-postgres@18.4.0-beta.17` en tests. Motivo: la línea que ese paquete mantiene al día es la 18, y quedarse en 17 significaría **probar en una versión y desplegar en otra**. Beneficio adicional: `uuidv7()` nativo como generador de claves por defecto |
| Q9  | RAM del VPS              | **4 GB**                     | Fija el escenario de observabilidad (§16): Prometheus + Grafana + exporters caben. Obliga a repartir memoria explícitamente entre los 7 contenedores y a **no** dejar que Postgres asuma que la máquina es suya. Ver §15, "Presupuesto de memoria"                                                                          |

### Divergencia consciente respecto al prompt (consecuencia de Q6)

El prompt define `numeroJornada` como único **global** y las rutas como `/api/jornadas/{numeroJornada}`. Con temporadas, `numeroJornada` ya **no** puede ser único global: la jornada 1 existe en cada temporada.

Lo que cambia, registrado aquí para que no sea una sorpresa dentro de tres semanas:

| Aspecto            | Prompt original                            | Con temporadas                                                                            |
| ------------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| Unicidad           | `UNIQUE (numero_jornada)`                  | `UNIQUE (temporada_id, numero_jornada)`                                                   |
| Recurso `Jornada`  | `id`, `numeroJornada`, `fecha`, `partidos` | **+ `temporada`** (código, p. ej. `"2026-27"`)                                            |
| `GET /jornadas`    | todas las jornadas                         | jornadas **de la temporada activa**; `?temporada=2026-27` para otra                       |
| `409 Conflict`     | mismo `numeroJornada`                      | mismo `numeroJornada` **dentro de la misma temporada**                                    |
| Forma de las rutas | `/api/jornadas/{n}`                        | `/api/v1/jornadas/{n}` — **sin cambio de forma** (se resuelve contra la temporada activa) |

Las rutas se mantienen planas a propósito (D17): así el contrato del prompt sigue siendo válido y no hay que rehacer los clientes cuando aparezca una segunda temporada.

---

## 1. Resumen ejecutivo

Vamos a construir una **API REST en TypeScript sobre Node + Express**, autenticada con **JWT propio** emitido por dos vías:

- **Credenciales usuario/contraseña** mediante un endpoint con forma de _OAuth2 password grant_ (`POST /api/v1/auth/token`).
- **Cuenta de Google**, mediante _Authorization Code + PKCE_, y opcionalmente verificación de _ID token_ enviado por un frontend.

**El acceso es cerrado**: no hay registro público. Un `admin` emite invitaciones de un solo uso; sin invitación válida no se crea usuario, ni por contraseña ni por Google. El primer admin se crea con un script de línea de comandos.

Persistencia en **PostgreSQL** (Docker o embebida, elegible por variable de entorno), acceso con **Drizzle ORM** y migraciones versionadas en SQL. Documentación **OpenAPI 3.1 generada desde los esquemas de validación**, servida en `/docs`. Testing con **Vitest + Supertest** contra una Postgres real, con helpers que firman tokens para probar endpoints autenticados y comprobar los roles. **Insomnia** como cliente, con la colección importada del OpenAPI y versionada en el repo. Despliegue final en **VPS con Docker Compose y HTTPS automático**.

El dominio se modela como **Temporada → Jornada → Partido**. Los módulos `temporadas` y `jornadas` se implementan al final de la base técnica y quedan como **plantilla de referencia** para lo que venga después (apuestas, resultados, peñas).

**Principio rector**: cada fase termina con algo que se puede _arrancar, llamar y probar_. No se avanza sin criterio de aceptación verificado con un comando.

---

## 2. Estado actual del entorno

Verificado en la máquina:

| Herramienta | Versión detectada               | Comentario                                                                   |
| ----------- | ------------------------------- | ---------------------------------------------------------------------------- |
| Node        | v26.6.0                         | Muy moderna. Soporta `--env-file`, `node --run` y ejecución directa de `.ts` |
| npm         | 12.0.2                          | OK                                                                           |
| Docker      | 29.6.2                          | OK, incluye `docker compose` v2                                              |
| Git         | —                               | El proyecto **no** es todavía un repositorio git                             |
| Contenido   | `prompts/`, `docs/`, `.claude/` | Sin `package.json`, sin `src/`                                               |

Consecuencias prácticas de tener Node 26:

- **No necesitas `dotenv`**: Node carga variables con `node --env-file=.env`.
- **Node ejecuta TypeScript directamente** (type stripping). Aun así usaremos `tsx` en desarrollo y `tsc` para compilar, porque necesitamos _type checking_ real: el runtime **borra** los tipos, no los comprueba.
- `node --run dev` funciona como `npm run dev` pero sin arrancar npm.

---

## 3. Decisiones de arquitectura (ADR-lite)

| #       | Decisión                                    | Elegido                                                                                                                                           | Alternativas descartadas                                                                                   | Motivo                                                                                                                                                                                                                                                                                                                                                                                |
| ------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1      | Framework HTTP                              | **Express 5**                                                                                                                                     | Fastify, NestJS, Hono                                                                                      | Lo pide el prompt. Express 5 propaga errores de handlers `async` automáticamente, lo que elimina el `try/catch` en cada ruta                                                                                                                                                                                                                                                          |
| D2      | Lenguaje / módulos                          | **TypeScript + ESM** (`"type": "module"`)                                                                                                         | CommonJS                                                                                                   | ESM es el presente; evita el mundo dual `require`/`import`                                                                                                                                                                                                                                                                                                                            |
| D3      | Validación de entrada                       | **Zod**                                                                                                                                           | Joi, class-validator, ajv a mano                                                                           | Infiere tipos TS desde el esquema: valida y tipa con una sola definición                                                                                                                                                                                                                                                                                                              |
| D4      | OpenAPI                                     | **Generado desde Zod** (code-first)                                                                                                               | Spec-first (YAML a mano)                                                                                   | Evita que documentación y código divergan. El requisito "todo documentado a nivel de endpoint" se vuelve automático                                                                                                                                                                                                                                                                   |
| D5      | Acceso a datos                              | **Drizzle ORM** + migraciones SQL                                                                                                                 | Prisma, TypeORM, `pg` a pelo                                                                               | Drizzle genera SQL legible y las migraciones son ficheros `.sql` que puedes leer. Prisma esconde más; `pg` a pelo enseña más pero es mucho boilerplate                                                                                                                                                                                                                                |
| D6      | Motor BD                                    | **PostgreSQL 18** en los tres entornos _(Q10)_                                                                                                    | MySQL, SQLite; PostgreSQL 17                                                                               | Lo pide el prompt. UUID, `CHECK`, índices parciales, transacciones y `CASCADE` sólidos. La 18 añade `uuidv7()` nativo y es la línea que mantiene `embedded-postgres`. **Misma versión en desarrollo, tests y producción**: un descuadre ahí produce bugs que solo aparecen en producción                                                                                              |
| D7      | BD local                                    | **Docker Compose** (por defecto) + **embedded-postgres** (opcional)                                                                               | Solo docker                                                                                                | Lo pide el prompt. La embebida es oro para tests y para trabajar sin Docker arrancado                                                                                                                                                                                                                                                                                                 |
| D8      | Formato de token                            | **JWT propio** (access) + **token opaco** (refresh)                                                                                               | Sesiones en servidor; JWT como refresh                                                                     | El access se valida sin ir a BD. El refresh es opaco y **revocable**                                                                                                                                                                                                                                                                                                                  |
| D9      | Firma JWT                                   | **HS256** en dev → **RS256** en prod                                                                                                              | Solo HS256                                                                                                 | RS256 permite validar con clave pública sin compartir el secreto. Se diseña para poder cambiar (JWKS) sin tocar el negocio                                                                                                                                                                                                                                                            |
| D10     | Librería JWT                                | **jose**                                                                                                                                          | jsonwebtoken                                                                                               | Moderna, ESM nativa, soporta JWKS, sin dependencias                                                                                                                                                                                                                                                                                                                                   |
| D11     | Hash de contraseñas                         | **Argon2id** (`@node-rs/argon2`)                                                                                                                  | bcrypt, scrypt                                                                                             | Recomendación actual de OWASP. `@node-rs` trae binarios precompilados                                                                                                                                                                                                                                                                                                                 |
| D12     | Testing                                     | **Vitest + Supertest**                                                                                                                            | Jest, node:test                                                                                            | Vitest habla ESM y TS sin configuración. Supertest llama a la app sin abrir puertos                                                                                                                                                                                                                                                                                                   |
| D13     | Estructura de código                        | **Modular por feature, en capas**                                                                                                                 | MVC plano                                                                                                  | En MVC plano, añadir "apuestas" toca 5 carpetas. Por feature, un módulo es una carpeta autocontenida                                                                                                                                                                                                                                                                                  |
| D14     | Logging                                     | **pino** + `pino-http` + `requestId`                                                                                                              | console.log, winston                                                                                       | Logs JSON correlacionables por petición. Imprescindible para depurar auth                                                                                                                                                                                                                                                                                                             |
| D15     | Versionado de API                           | **`/api/v1`** _(Q1)_                                                                                                                              | Sin versión                                                                                                | Coste cero ahora; evita romper clientes después                                                                                                                                                                                                                                                                                                                                       |
| D16     | Cliente de pruebas                          | **Insomnia** + colección versionada + `inso` CLI                                                                                                  | Postman, curl                                                                                              | Lo pide el prompt. `inso` permite ejecutar la colección en CI                                                                                                                                                                                                                                                                                                                         |
| **D17** | **Forma de las rutas con temporada** _(Q6)_ | **Rutas planas** `/api/v1/jornadas/{n}` resueltas contra la **temporada activa**, con `?temporada=<codigo>` para apuntar a otra                   | Rutas anidadas `/api/v1/temporadas/{codigo}/jornadas/{n}`                                                  | Mantiene **intacto** el contrato del prompt y no rompe clientes al aparecer la segunda temporada. La temporada se comporta como _contexto de trabajo_, no como jerarquía de URL. Las anidadas serían más "puras" pero obligan a cada cliente a conocer la temporada en cada llamada                                                                                                   |
| **D18** | **Acceso cerrado** _(Q2)_                   | **Invitación de un solo uso**, emitida por admin, TTL 7 días; **también obligatoria para Google**                                                 | Registro abierto; allowlist de emails en config                                                            | Una peña es un grupo cerrado. Cerrar solo el registro por contraseña y dejar Google abierto es el error clásico: cualquiera con Gmail entraría                                                                                                                                                                                                                                        |
| **D19** | **Autorización** _(Q3, Q4)_                 | **Por rol** (`user`/`admin`) en el claim del JWT, middleware `requireRole`                                                                        | Scopes granulares; ACL por recurso                                                                         | Dos roles cubren el caso real. Se deja el claim `scope` reservado para granularidad futura sin cambiar el contrato                                                                                                                                                                                                                                                                    |
| **D20** | **Envío de invitaciones**                   | **Sin email por ahora**: el endpoint devuelve la URL y el admin la reparte a mano                                                                 | Integrar SMTP/Resend/SES ya                                                                                | Cero infraestructura extra para 10 personas. El punto de extensión queda marcado en el service (§18)                                                                                                                                                                                                                                                                                  |
| **D21** | **Despliegue** _(Q7)_                       | **VPS con Docker Compose + Caddy** (HTTPS automático), imagen en GHCR                                                                             | `git pull` y build en el VPS; systemd + Node desnudo; PaaS                                                 | Caddy saca los certificados solo (sin certbot ni cron). Construir en el VPS obliga a tener devDeps y toolchain allí, y hace el deploy lento y frágil                                                                                                                                                                                                                                  |
| **D22** | **Migraciones en producción**               | Paso **explícito** antes de arrancar la nueva versión (contenedor de un solo uso)                                                                 | Migrar al arrancar la app                                                                                  | Con varias instancias, migrar al arrancar produce carreras. Y un fallo de migración debe **detener** el despliegue, no dejar la app arrancada a medias                                                                                                                                                                                                                                |
| **D23** | **Observabilidad: métricas y alertas**      | **`prom-client` en la API + Prometheus + Grafana OSS**, todo autoalojado, más **Uptime Kuma fuera del VPS**                                       | SigNoz o Sentry self-hosted (4–8 GB de RAM, 8–15 contenedores); Datadog/New Relic (suscripción); solo logs | Todo Apache-2.0/AGPL/MIT, sin cuenta ni suscripción. Grafana OSS ya incluye alerting con avisos a Telegram/email, así que no hace falta Alertmanager. Cabe en un VPS modesto. Ver §16                                                                                                                                                                                                 |
| **D24** | **Observabilidad: trazas**                  | **OpenTelemetry preparado pero desactivado** (`OTEL_ENABLED=false`); se enciende cuando haya un problema de rendimiento que los logs no expliquen | Instrumentar trazas desde el día 1; no instrumentar nunca                                                  | Las trazas son la señal más cara (CPU, memoria y un backend más) y la menos necesaria con 30 usuarios. Pero **correlacionar pino con `trace_id` desde el principio** cuesta dos líneas y evita rehacer los logs después                                                                                                                                                               |
| **D25** | **Seguimiento de errores (tipo Sentry)**    | **Aplazado**. Si hace falta, **GlitchTip** (compatible con el SDK de Sentry)                                                                      | Sentry self-hosted; Sentry SaaS                                                                            | Sentry autoalojado pide ~8 GB y una docena de contenedores. Con logs estructurados + alertas de tasa de 5xx cubres el 90 % del valor a coste cero. Verifica la licencia de GlitchTip antes de adoptarlo                                                                                                                                                                               |
| **D26** | **Automatización de módulos con skills**    | **Una sola skill, `/quini-api-new`, escrita en F14 — es decir, DESPUÉS de tener el módulo `jornadas` terminado a mano**                           | Escribirla ahora; escribir las tres (`new`/`update`/`delete`) de golpe; no automatizar nada                | Una skill que "sigue los patrones del proyecto" necesita que los patrones existan. Escrita hoy codificaría una propuesta hipotética. Escrita tras F11 codifica tu código real y lo que aprendiste haciéndolo. `update` y `delete` son problemas distintos (compatibilidad y destrucción de datos), no variantes del mismo: se extraen después de usar `new` dos o tres veces. Ver F14 |

### Aviso sobre "OAuth2 con usuario y contraseña" _(confirmado en Q8)_

El prompt pide _OAuth2 con usuario y contraseña_: técnicamente el **Resource Owner Password Credentials grant (ROPC)**, **desaconsejado por OAuth 2.1** y por las _Security BCP_ del IETF, porque obliga a que tu API vea la contraseña en claro y no soporta MFA ni redirecciones del proveedor.

Enfoque aprobado: `POST /api/v1/auth/token` **compatible en forma** con el password grant:

```
Content-Type: application/x-www-form-urlencoded
grant_type=password&username=...&password=...
```

y respuesta JSON estándar `{ access_token, token_type, expires_in, refresh_token }`.

- **Cumple el requisito** y funciona con el helper _OAuth2 → Password Credentials_ de Insomnia sin escribir scripts.
- Es un **login de primera parte** (tu app, tus usuarios): el único escenario donde ROPC sigue siendo defendible.
- Si mañana pasas a un servidor de identidad (Keycloak, Auth0, Cognito), **el contrato de respuesta no cambia** y los clientes no se rompen.

Lo que **no** haremos: un servidor de autorización OAuth2 completo (registro de clientes, consentimiento, scopes dinámicos). Es un proyecto en sí mismo.

---

## 4. Stack definitivo y para qué sirve cada pieza

### Dependencias de producción

| Paquete               | Para qué                                                                               | Fase |
| --------------------- | -------------------------------------------------------------------------------------- | ---- |
| `express`             | Servidor HTTP y enrutado                                                               | F2   |
| `zod`                 | Validación de entrada y de variables de entorno; fuente de los tipos                   | F2   |
| `pino`, `pino-http`   | Logging estructurado JSON + log por petición                                           | F2   |
| `prom-client`         | Métricas Prometheus en proceso: `/metrics`, histogramas, contadores de negocio _(§16)_ | F2   |
| `helmet`              | Cabeceras HTTP de seguridad                                                            | F2   |
| `cors`                | Control de orígenes permitidos (tu futuro frontend)                                    | F2   |
| `drizzle-orm`         | Consultas tipadas y transacciones                                                      | F3   |
| `pg`                  | Driver PostgreSQL (pool de conexiones)                                                 | F3   |
| `jose`                | Firmar y verificar JWT; soporte JWKS                                                   | F4   |
| `@node-rs/argon2`     | Hash y verificación de contraseñas                                                     | F4   |
| `express-rate-limit`  | Limitar intentos en auth e invitaciones                                                | F4   |
| `cookie-parser`       | **Solo** para la cookie firmada de `state` de Google _(Q5: el refresh va en el body)_  | F6   |
| `google-auth-library` | Intercambio de código y verificación de ID token                                       | F6   |
| `zod-openapi`         | Convertir esquemas Zod en componentes OpenAPI                                          | F7   |
| `swagger-ui-express`  | Servir la UI de documentación en `/docs`                                               | F7   |

### Dependencias de desarrollo

| Paquete                                                                                                           | Para qué                                                                                                                                | Fase  |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| `typescript`, `@types/node`, `@types/express`                                                                     | Tipos y compilador                                                                                                                      | F1    |
| `tsx`                                                                                                             | Ejecutar TS en desarrollo con `--watch`                                                                                                 | F1    |
| `eslint`, `typescript-eslint`                                                                                     | Linter (flat config, ESLint 9)                                                                                                          | F1    |
| `prettier`, `eslint-config-prettier`                                                                              | Formateo sin pelearse con el linter                                                                                                     | F1    |
| `husky`, `lint-staged`                                                                                            | Hooks de git: no commitear código roto                                                                                                  | F1    |
| `drizzle-kit`                                                                                                     | Generar/aplicar migraciones; `studio` (GUI de BD)                                                                                       | F3    |
| `@types/pg`, `@types/cookie-parser`, `@types/swagger-ui-express`                                                  | Tipos                                                                                                                                   | F3–F7 |
| `embedded-postgres`                                                                                               | PostgreSQL real sin Docker, arrancada desde Node. **Fijar versión exacta `18.4.0-beta.17`** (solo publica prereleases; ver aviso abajo) | F3    |
| `vitest`, `supertest`, `@types/supertest`, `@vitest/coverage-v8`                                                  | Tests y cobertura                                                                                                                       | F8    |
| `ajv`, `ajv-formats`                                                                                              | Validar respuestas reales contra el esquema OpenAPI                                                                                     | F8    |
| `@stoplight/spectral-cli`                                                                                         | Lint del documento OpenAPI                                                                                                              | F7    |
| `insomnia-inso`                                                                                                   | CLI de Insomnia: exportar spec y ejecutar la colección en CI                                                                            | F9    |
| `@opentelemetry/sdk-node`, `@opentelemetry/auto-instrumentations-node`, `@opentelemetry/exporter-trace-otlp-http` | Trazas distribuidas. **Se instalan en F13 y solo se activan cuando hagan falta** _(D24)_                                                | F13   |

> **Antes de instalar, comprueba versiones** — no fijes versiones de memoria:
>
> ```bash
> for p in express zod drizzle-orm drizzle-kit jose zod-openapi vitest embedded-postgres; do
>   printf '%-22s %s\n' "$p" "$(npm info "$p" version)"
> done
> ```
>
> **Versiones verificadas el 2026-08-06** (consultadas al registro de npm):

| Paquete                       | Versión                  | Nota                                                                                                                                              |
| ----------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `express`                     | 5.2.1                    | Express 5 es la línea estable ✅                                                                                                                  |
| `zod`                         | 4.4.3                    |                                                                                                                                                   |
| `zod-openapi`                 | 6.0.0                    | `peerDependencies: { zod: '^4.0.0' }` → **compatible con Zod 4** ✅ El riesgo que bloqueaba F7 queda descartado y no hacen falta las alternativas |
| `drizzle-orm` / `drizzle-kit` | 0.45.2 / 0.31.10         | Comandos `generate` / `migrate` / `studio` vigentes                                                                                               |
| `jose`                        | 6.2.8                    |                                                                                                                                                   |
| `prom-client`                 | 15.1.3                   |                                                                                                                                                   |
| `vitest`                      | 4.1.10                   | Major nueva: instala `@vitest/coverage-v8` de la **misma** major                                                                                  |
| `google-auth-library`         | 11.0.0                   |                                                                                                                                                   |
| `embedded-postgres`           | 18.4.0-beta.17           | ⚠️ Ver aviso                                                                                                                                      |
| `typescript`                  | **5.7.x** (no la última) | ⚠️ Ver aviso en F1: `typescript-eslint` aún no soporta TypeScript 7                                                                               |

> ⚠️ **`embedded-postgres` solo publica prereleases.** Todas sus versiones llevan sufijo `-beta.N`; no existe ninguna estable. No es abandono: el paquete versiona siguiendo a PostgreSQL (líneas 17.x y 18.x) y arrastra ese sufijo. Dos consecuencias:
>
> 1. **Fija la versión exacta**, sin `^`: los rangos de semver no capturan prereleases y un `npm i -D embedded-postgres` a secas puede traerte otra línea sin avisar.
>    ```bash
>    npm i -D --save-exact embedded-postgres@18.4.0-beta.17
>    ```
> 2. **Sigue siendo obligatorio el humo de F3 en tu Mac ARM**: el paquete no declara `os` ni `cpu`, así que no damos por hecho que funcione en Apple Silicon hasta verlo arrancar. Si falla, el plan B (Testcontainers o servicio Postgres en CI) está en §19.

---

## 5. Arquitectura de la aplicación

### Capas y regla de dependencia

```mermaid
flowchart TD
    C[Cliente: Insomnia / Frontend] -->|HTTP + Bearer| R
    subgraph app["Aplicación Express"]
        R["Router + middlewares<br/>requireAuth · requireRole · validate · rateLimit"]
        H["Controller<br/>traduce HTTP ↔ dominio"]
        S["Service<br/>reglas de negocio"]
        Rep["Repository<br/>consultas Drizzle"]
        R --> H --> S --> Rep
    end
    Rep -->|SQL| DB[(PostgreSQL)]
    S -.->|firma/verifica| A["Auth core<br/>jose + argon2"]
```

**Regla de oro (dirección de dependencias): las flechas nunca van hacia arriba.**

| Capa           | Sí hace                                                             | Nunca hace           |
| -------------- | ------------------------------------------------------------------- | -------------------- |
| **Router**     | Declara ruta, método, middlewares y esquema OpenAPI                 | Lógica de negocio    |
| **Controller** | Lee `req`, llama al service, elige código HTTP y cabeceras          | Consultas SQL        |
| **Service**    | Reglas de negocio, orquesta transacciones, lanza errores de dominio | Tocar `req`/`res`    |
| **Repository** | SQL/Drizzle, mapeo fila ↔ objeto de dominio                         | Decidir códigos HTTP |

**Por qué importa**: si un service nunca ve `req`/`res`, puedes testearlo sin HTTP. Si un repository nunca decide códigos de estado, puedes cambiar de BD sin tocar la API. Y cuando `POST /jornadas` falle, sabrás en qué capa mirar por el tipo de error.

### Punto clave para testear: `app.ts` separado de `server.ts`

- `src/app.ts` → construye y devuelve la instancia de Express (middlewares + rutas). **No** escucha en ningún puerto.
- `src/server.ts` → importa `app`, hace `listen()`, gestiona apagado ordenado (`SIGTERM`).

Esto permite a Supertest hacer `request(app).get('/api/v1/jornadas')` **sin abrir un puerto**: tests rápidos, paralelizables y sin conflictos.

---

## 6. Estructura de carpetas

```
quini-api/
├── docs/
│   ├── 00-Plan-inicial.md          # este documento
│   ├── 01-Arquitectura.md          # (F2) diagramas y decisiones vivas
│   ├── 02-Autenticacion.md         # (F4-F6) flujos, claims, invitaciones, roles
│   ├── 03-Base-de-datos.md         # (F3) modelo, índices, migraciones
│   ├── 04-Testing.md               # (F8) cómo probar autenticado y por rol
│   ├── 05-Insomnia.md              # (F9) cómo usar la colección
│   ├── 06-Despliegue-VPS.md        # (F12) runbook de despliegue y backups
│   ├── 07-Observabilidad.md        # (F13) métricas, alertas, qué hacer cuando salta una
│   ├── specs/
│   │   ├── _plantilla.md           # plantilla de especificación (YA CREADA)
│   │   ├── 01-jornadas.md          # la spec del prompt, pasada a la plantilla
│   │   └── NN-<recurso>.md         # una por recurso; entrada de /quini-api-new (F14)
│   └── adr/                        # decisiones futuras, una por fichero
├── prompts/                        # entradas originales (ya existe)
├── docker/
│   ├── docker-compose.yml          # DESARROLLO: postgres + adminer
│   ├── docker-compose.prod.yml     # VPS: api + postgres + caddy
│   ├── docker-compose.obs.yml      # (F13) prometheus + grafana + exporters
│   ├── prometheus.yml              # (F13) scrape configs
│   ├── grafana/provisioning/       # (F13) datasource y dashboards como código
│   ├── Caddyfile                   # HTTPS automático + reverse proxy
│   └── initdb/                     # extensiones SQL al crear el contenedor
├── drizzle/                        # migraciones .sql GENERADAS (se commitean)
│   └── meta/
├── insomnia/
│   └── quini-api.insomnia.yaml  # colección exportada y versionada
├── openapi/
│   └── openapi.json                # spec GENERADA (se commitea)
├── scripts/
│   ├── db-embedded.ts              # arranca/para PostgreSQL embebida
│   ├── create-admin.ts             # BOOTSTRAP del primer admin (Q2)
│   ├── mint-token.ts               # token de dev para Insomnia
│   ├── seed.ts                     # temporada activa + admin + 1 jornada
│   └── backup.sh                   # pg_dump con retención (VPS)
├── src/
│   ├── app.ts                      # composición de Express (sin listen)
│   ├── server.ts                   # arranque, puerto, graceful shutdown
│   ├── config/
│   │   ├── env.ts                  # carga y VALIDA process.env con Zod
│   │   └── constants.ts            # TTLs, issuer, nombres de cookie
│   ├── core/
│   │   ├── errors.ts               # AppError y subclases
│   │   └── async-context.ts        # AsyncLocalStorage: requestId, usuario
│   ├── db/
│   │   ├── index.ts                # pool + instancia de drizzle
│   │   ├── schema/
│   │   │   ├── users.ts
│   │   │   ├── invitations.ts      # (Q2)
│   │   │   ├── oauth-accounts.ts
│   │   │   ├── refresh-tokens.ts
│   │   │   ├── temporadas.ts       # (Q6)
│   │   │   ├── jornadas.ts         # jornadas + partidos
│   │   │   └── index.ts            # re-exporta todo (lo lee drizzle-kit)
│   │   └── migrate.ts              # aplica migraciones programáticamente
│   ├── observability/
│   │   ├── metrics.ts              # registro prom-client, contadores e histogramas
│   │   ├── metrics.middleware.ts   # mide cada peticion con la PLANTILLA de ruta
│   │   └── tracing.ts              # (F13) OTel, apagado por defecto
│   ├── middleware/
│   │   ├── request-id.ts
│   │   ├── http-logger.ts
│   │   ├── validate.ts             # body/params/query con Zod → 400
│   │   ├── require-auth.ts         # verifica JWT → req.auth
│   │   ├── require-role.ts         # 'admin' → 403 si no cumple (Q3, Q4)
│   │   └── error-handler.ts        # ÚNICO sitio que serializa errores
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts     # login, refresh, revoke, register
│   │   │   ├── auth.repository.ts
│   │   │   ├── auth.schemas.ts
│   │   │   ├── tokens.ts           # firmar/verificar JWT, refresh opaco
│   │   │   ├── password.ts         # argon2 hash/verify
│   │   │   └── google.ts           # authorization code + PKCE, id_token
│   │   ├── invitations/            # (Q2)
│   │   │   ├── invitations.routes.ts
│   │   │   ├── invitations.controller.ts
│   │   │   ├── invitations.service.ts
│   │   │   ├── invitations.repository.ts
│   │   │   └── invitations.schemas.ts
│   │   ├── users/                  # /auth/me, perfil, listado (admin)
│   │   ├── temporadas/             # (Q6) mismo patrón de 5 ficheros
│   │   └── jornadas/               # mismo patrón de 5 ficheros
│   ├── openapi/
│   │   ├── registry.ts             # registro central de esquemas y rutas
│   │   ├── security-schemes.ts     # bearerAuth, oauth2Password, oauth2Google
│   │   └── generate.ts             # escribe openapi/openapi.json
│   └── routes.ts                   # monta todos los módulos bajo /api/v1
├── tests/
│   ├── setup/
│   │   ├── global-setup.ts         # arranca BD de test + migra
│   │   └── truncate.ts             # limpia tablas entre tests
│   ├── helpers/
│   │   ├── auth.ts                 # createUser/createAdmin, authHeader, loginAs
│   │   ├── factories.ts            # buildJornada() con 15 partidos válidos
│   │   └── openapi.ts              # contract testing con ajv
│   ├── fixtures/
│   │   └── jornada-valida.json
│   ├── unit/
│   └── integration/
│       ├── auth.token.test.ts
│       ├── auth.google.test.ts
│       ├── invitations.test.ts
│       ├── temporadas.test.ts
│       └── jornadas.crud.test.ts
├── .github/workflows/
│   ├── ci.yml
│   └── deploy.yml                  # (F12) build → GHCR → ssh al VPS
├── .env.example                    # SE commitea (sin secretos reales)
├── .env                            # NO se commitea
├── .env.test                       # SE commitea (secretos de test)
├── .gitignore
├── eslint.config.js
├── .prettierrc.json
├── .spectral.yaml
├── drizzle.config.ts
├── vitest.config.ts
├── tsconfig.json
├── Dockerfile
├── README.md
└── package.json
```

---

## 7. Modelo de datos

### Diagrama

```mermaid
erDiagram
    USERS ||--o{ OAUTH_ACCOUNTS : "tiene"
    USERS ||--o{ REFRESH_TOKENS : "posee"
    USERS ||--o{ INVITATIONS : "emite"
    TEMPORADAS ||--o{ JORNADAS : "agrupa"
    JORNADAS ||--|{ PARTIDOS : "contiene 15"

    USERS {
        uuid id PK
        citext email UK
        text password_hash "NULL si solo Google"
        text nombre
        text role "user | admin"
        boolean email_verified
        timestamptz created_at
        timestamptz updated_at
    }
    INVITATIONS {
        uuid id PK
        citext email
        text role "rol que tendra al aceptar"
        text token_hash "sha256, nunca el token"
        uuid invited_by FK
        timestamptz expires_at
        timestamptz accepted_at
        timestamptz revoked_at
        timestamptz created_at
    }
    OAUTH_ACCOUNTS {
        uuid id PK
        uuid user_id FK
        text provider "google"
        text provider_user_id "sub de Google"
        text email
        timestamptz created_at
    }
    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        text token_hash "sha256"
        uuid family_id "deteccion de reuso"
        timestamptz expires_at
        timestamptz revoked_at
        text user_agent
        inet ip
    }
    TEMPORADAS {
        uuid id PK
        text codigo UK "2026-27"
        text nombre
        date fecha_inicio
        date fecha_fin
        boolean activa "solo UNA true"
        timestamptz created_at
    }
    JORNADAS {
        uuid id PK
        uuid temporada_id FK
        int numero_jornada "unico por temporada"
        date fecha
        uuid created_by FK
        timestamptz created_at
        timestamptz updated_at
    }
    PARTIDOS {
        uuid id PK
        uuid jornada_id FK
        smallint orden "1..15"
        text equipo_local
        text equipo_visitante
    }
```

### Restricciones que impone la base de datos (no solo el código)

Las reglas de la sección 4 del prompt se defienden **en dos capas**: Zod rechaza en el borde (400) y Postgres garantiza la integridad (409 / imposible). Nunca confíes solo en el código: dos peticiones concurrentes pasan la validación a la vez.

| Regla del prompt                      | Defensa en Zod (→400)                          | Defensa en PostgreSQL                                                                                    |
| ------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `numeroJornada` único y ≥ 1           | `z.number().int().positive()`                  | **`UNIQUE (temporada_id, numero_jornada)`** _(Q6)_ + `CHECK (numero_jornada >= 1)` → violación ⇒ **409** |
| `fecha` ISO 8601 válida               | `z.string().date()`                            | Columna `DATE`                                                                                           |
| Exactamente 15 partidos               | `.length(15)` en el array                      | Validado dentro de la transacción del service                                                            |
| `orden` = 1..15 sin repetir ni huecos | `refine` que compara el conjunto con `[1..15]` | `UNIQUE (jornada_id, orden)` + `CHECK (orden BETWEEN 1 AND 15)`                                          |
| Equipos obligatorios y no vacíos      | `z.string().trim().min(1)`                     | `NOT NULL` + `CHECK (length(trim(equipo_local)) > 0)`                                                    |
| Borrado de jornada elimina partidos   | —                                              | `FOREIGN KEY ... ON DELETE CASCADE`                                                                      |

### Reglas propias del modelo con temporadas _(Q6)_

| Regla                                             | Implementación                                                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Solo una temporada activa**                     | Índice único parcial: `CREATE UNIQUE INDEX temporadas_una_activa ON temporadas (activa) WHERE activa;` — la BD hace imposible tener dos. Es el truco que evita todo un mundo de bugs |
| Código de temporada con formato                   | `CHECK (codigo ~ '^\d{4}-\d{2}$')` y en Zod `z.string().regex(/^\d{4}-\d{2}$/)`. Ejemplo: `2026-27`                                                                                  |
| Coherencia de fechas                              | `CHECK (fecha_fin > fecha_inicio)`                                                                                                                                                   |
| No borrar una temporada con jornadas              | `FOREIGN KEY ... ON DELETE RESTRICT` → intento ⇒ **409**. Un `CASCADE` aquí borraría 38 jornadas por un `DELETE` mal escrito                                                         |
| La fecha de la jornada cae dentro de la temporada | Regla de **negocio** (en el service), no `CHECK`: los aplazamientos se salen del rango y no quieres que la BD te bloquee                                                             |

### Reglas del acceso cerrado _(Q2)_

| Regla                                  | Implementación                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Invitación de un solo uso              | `accepted_at IS NULL` para ser usable; se marca dentro de la **misma transacción** que crea el usuario                          |
| Una invitación pendiente por email     | Índice único parcial: `CREATE UNIQUE INDEX ON invitations (email) WHERE accepted_at IS NULL AND revoked_at IS NULL;`            |
| Caducidad                              | `expires_at` (7 días por defecto); vencida ⇒ **410 Gone**                                                                       |
| El token nunca en claro en BD          | Se guarda `sha256(token)`. Si la BD se filtra, las invitaciones no son utilizables                                              |
| Google no puede saltarse la invitación | El service de Google exige usuario existente **o** invitación válida para ese email; si no ⇒ **403 `REGISTRATION_NOT_ALLOWED`** |

Decisiones adicionales del modelo:

- **`citext` para email** (`CREATE EXTENSION IF NOT EXISTS citext`) o `UNIQUE` sobre `lower(email)`. Sin esto, `Juan@x.com` y `juan@x.com` son dos usuarios distintos: fuente clásica de bugs de login y de secuestro de cuenta vía Google.
- **`password_hash` nullable**: quien solo entra con Google no tiene contraseña. El login por contraseña devuelve 401 genérico (nunca "esta cuenta usa Google": filtra información).
- **`created_by` en jornadas**: auditoría desde el principio; después es doloroso rellenarlo.
- **Claves primarias con `uuidv7()`** _(Q10)_: nativo en PostgreSQL 18, sin extensiones. Un UUID v7 lleva la marca de tiempo en los bits altos, así que los valores nuevos se insertan **al final** del índice B-tree en lugar de en posiciones aleatorias: menos fragmentación de páginas y mejor localidad de caché que con `gen_random_uuid()` (v4). En una peña no lo vas a notar, pero es gratis y es la práctica correcta. Como efecto secundario útil, ordenar por `id` equivale a ordenar por antigüedad.
  > **Ojo con el detalle de privacidad**: un UUID v7 **revela el instante de creación** del registro. Para claves internas es indiferente; si algún día generas tokens o identificadores públicos que no deban filtrar cuándo se crearon, usa `gen_random_uuid()` (v4) para esos.
- **`timestamptz` siempre**, nunca `timestamp`. Guarda en UTC y deja el formateo al cliente.

---

## 8. Diseño de autenticación y autorización

### Flujo 1 — Contraseña (password grant)

```mermaid
sequenceDiagram
    participant I as Insomnia
    participant A as API
    participant DB as PostgreSQL
    I->>A: POST /auth/token (grant_type=password, username, password)
    A->>DB: SELECT usuario por email normalizado
    A->>A: argon2.verify(password_hash, password)
    Note over A: Si falla → 401 genérico<br/>+ rate limit por IP y por cuenta
    A->>DB: INSERT refresh_token (sha256, family_id, expires_at)
    A-->>I: 200 { access_token (JWT 15m, claim role), refresh_token, expires_in }
    I->>A: GET /api/v1/jornadas (Authorization: Bearer ...)
    A->>A: jwtVerify (firma, exp, iss, aud) → req.auth = { userId, role }
    A-->>I: 200 [...]
```

### Flujo 2 — Alta por invitación _(Q2)_

```mermaid
sequenceDiagram
    participant AD as Admin
    participant A as API
    participant U as Invitado
    AD->>A: POST /api/v1/invitaciones { email, role } (Bearer admin)
    A->>A: genera token 32B, guarda sha256, expires_at = +7d
    A-->>AD: 201 { id, email, expiresAt, url: ".../registro?token=..." }
    Note over AD,U: el admin envía la URL a mano (D20: sin email todavía)
    U->>A: GET /api/v1/invitaciones/{token}/validar
    A-->>U: 200 { email } · 410 si caducada · 404 si no existe
    U->>A: POST /api/v1/auth/register { token, password, nombre }
    A->>A: TRANSACCIÓN: crea usuario con el role de la invitación + marca accepted_at
    A-->>U: 201 { access_token, refresh_token }
```

### Flujo 3 — Google (Authorization Code + PKCE), cerrado por invitación

```mermaid
sequenceDiagram
    participant B as Navegador
    participant A as API
    participant G as Google
    participant DB as PostgreSQL
    B->>A: GET /auth/google
    A->>A: genera state + code_verifier (cookie firmada, corta vida)
    A-->>B: 302 → accounts.google.com/o/oauth2/v2/auth?...&code_challenge=...
    B->>G: login + consentimiento
    G-->>B: 302 → /auth/google/callback?code&state
    B->>A: GET /auth/google/callback
    A->>A: valida state (anti-CSRF) y lo borra
    A->>G: POST /token (code + code_verifier + client_secret)
    G-->>A: id_token
    A->>A: verifica id_token (firma, aud, iss, exp, email_verified)
    A->>DB: ¿oauth_accounts(google, sub)?
    alt usuario ya existe
        A->>DB: vincula o reutiliza
    else no existe
        A->>DB: ¿invitación válida para ese email?
        Note over A: si NO → 403 REGISTRATION_NOT_ALLOWED
    end
    A-->>B: tokens propios de la API
```

### Autorización por rol _(Q3, Q4)_

| Recurso                                      | `user`     | `admin` |
| -------------------------------------------- | ---------- | ------- |
| `GET /jornadas`, `GET /jornadas/{n}`         | ✅         | ✅      |
| `POST`/`PUT`/`DELETE /jornadas`              | ❌ **403** | ✅      |
| `GET /temporadas`                            | ✅         | ✅      |
| `POST`/`PUT`/`DELETE /temporadas`, `activar` | ❌ **403** | ✅      |
| `/invitaciones` (crear, listar, revocar)     | ❌ **403** | ✅      |
| `GET /auth/me`                               | ✅         | ✅      |
| `GET /usuarios`                              | ❌ **403** | ✅      |

El rol viaja en el claim `role` del access token. Consecuencia a tener presente: **cambiar el rol de un usuario no surte efecto hasta que su access token expira** (máx. 15 min) o refresca. Es el precio de no consultar la BD en cada petición. Si algún día necesitas revocación inmediata, se añade una comprobación de `token_version` en BD — pero no lo hagas todavía: sacrifica justo lo que hace rápido al JWT.

### Reglas de seguridad no negociables

| Tema                            | Regla                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access token                    | TTL **15 min**. Claims: `iss`, `aud`, `sub`, `iat`, `exp`, `jti`, `role`, `scope` (reservado). **Nunca** datos sensibles: un JWT lo lee cualquiera |
| Refresh token                   | Opaco (32 bytes aleatorios), TTL **30 días**, guardado **solo como `sha256`**, **en el body** de la respuesta _(Q5)_                               |
| Rotación                        | Cada uso emite uno nuevo e invalida el anterior. Si llega uno ya usado ⇒ **reuso ⇒ revocar toda la `family_id`** y registrar alerta                |
| Errores de login                | Siempre `401`, mismo mensaje y **tiempo de respuesta similar**, exista el usuario o no (evita enumeración de cuentas)                              |
| Rate limiting                   | `/auth/token`, `/auth/register` y `/invitaciones/{token}/validar`: por IP **y** por identificador                                                  |
| Invitaciones                    | Un solo uso, TTL 7 días, `sha256` en BD, revocables. Obligatorias **también** para Google                                                          |
| Vinculación por email en Google | Solo si `email_verified === true` en el ID token. Sin esto, quien registre ese email en un proveedor laxo entra en la cuenta                       |
| Secretos                        | `JWT_SECRET` y `COOKIE_SECRET` ≥ 32 bytes aleatorios, distintos por entorno. `.env` en `.gitignore` desde el primer commit                         |
| CORS                            | Lista blanca explícita, nunca `*` con credenciales                                                                                                 |
| Cookie de `state`               | `HttpOnly; Secure; SameSite=Lax; Max-Age=600; Path=/api/v1/auth/google`                                                                            |

### Bootstrap del primer admin _(Q2 — problema del huevo y la gallina)_

Con registro cerrado, **nadie puede crear al primer admin por HTTP**. Solución: script CLI que actúa directamente contra la BD.

```bash
npm run admin:create -- --email=jfernandez@intermarkit.es --nombre="Jose"
# pide la contraseña por stdin (nunca como argumento: quedaría en el historial del shell)
```

Reglas del script: se niega a ejecutarse si **ya existe** un admin (salvo `--force`), exige contraseña de ≥ 12 caracteres, y no tiene endpoint HTTP equivalente en ningún entorno.

### Tokens para desarrollo (requisito 4 del prompt)

Dos mecanismos, ambos **imposibles de activar en producción**:

1. **Script CLI** (recomendado, sin superficie de ataque):

   ```bash
   npm run token -- --email=dev@quiniela.local --role=admin --ttl=8h
   ```

   Imprime el JWT listo para pegar en Insomnia. Solo firma, no toca la BD.

2. **Endpoint `POST /api/v1/dev/token`**, montado **únicamente** si `NODE_ENV !== 'production'` **y** `ENABLE_DEV_TOKENS === 'true'`. La guarda va en el **montaje** de la ruta (`if` en `routes.ts`), no dentro del handler: si la ruta no existe, no puede fallar abierta. Un test de integración debe verificar que con `NODE_ENV=production` responde 404.

---

## 9. Catálogo de endpoints

Base: `/api/v1`. La columna **Auth** indica lo mínimo exigido.

### Autenticación

| Método | Ruta                     | Auth                                            | Descripción                                                           |
| ------ | ------------------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/auth/token`            | —                                               | `grant_type=password` → tokens; `grant_type=refresh_token` → rotación |
| POST   | `/auth/register`         | — (requiere **token de invitación** en el body) | Crea el usuario y devuelve tokens                                     |
| POST   | `/auth/revoke`           | Bearer                                          | Revoca un refresh token (logout de un dispositivo)                    |
| POST   | `/auth/logout`           | Bearer                                          | Revoca toda la familia de tokens del usuario                          |
| GET    | `/auth/google`           | —                                               | Redirige a Google (`state` + PKCE)                                    |
| GET    | `/auth/google/callback`  | —                                               | Canjea el código, aplica la regla de invitación, emite tokens         |
| POST   | `/auth/google/id-token`  | —                                               | Un frontend envía el `id_token`; la API lo verifica                   |
| GET    | `/auth/me`               | Bearer                                          | Usuario del token (endpoint sonda)                                    |
| GET    | `/.well-known/jwks.json` | —                                               | Clave pública (solo con RS256)                                        |

### Invitaciones _(Q2)_

| Método | Ruta                            | Auth             | Descripción                              |
| ------ | ------------------------------- | ---------------- | ---------------------------------------- |
| POST   | `/invitaciones`                 | **admin**        | Crea invitación → 201 con la URL         |
| GET    | `/invitaciones`                 | **admin**        | Lista pendientes / aceptadas / caducadas |
| DELETE | `/invitaciones/{id}`            | **admin**        | Revoca una pendiente → 204               |
| GET    | `/invitaciones/{token}/validar` | — (rate-limited) | 200 `{email}` · 404 · 410 si caducada    |

### Temporadas _(Q6)_

| Método | Ruta                           | Auth      | Descripción                                          |
| ------ | ------------------------------ | --------- | ---------------------------------------------------- |
| POST   | `/temporadas`                  | **admin** | Crea temporada (`codigo`, `nombre`, fechas)          |
| GET    | `/temporadas`                  | Bearer    | Lista, con la activa marcada                         |
| GET    | `/temporadas/{codigo}`         | Bearer    | Detalle                                              |
| PUT    | `/temporadas/{codigo}`         | **admin** | Actualiza nombre y fechas (el `codigo` es inmutable) |
| POST   | `/temporadas/{codigo}/activar` | **admin** | Transacción: desactiva la actual y activa esta       |
| DELETE | `/temporadas/{codigo}`         | **admin** | 204; **409** si tiene jornadas                       |

### Jornadas (especificación del prompt + temporada)

| Método | Ruta                        | Auth      | Notas                                                            |
| ------ | --------------------------- | --------- | ---------------------------------------------------------------- |
| POST   | `/jornadas`                 | **admin** | 201 + `Location`. Temporada: la activa, o `temporada` en el body |
| GET    | `/jornadas`                 | Bearer    | Temporada activa por defecto; `?temporada=2026-27` para otra     |
| GET    | `/jornadas/{numeroJornada}` | Bearer    | Idem con `?temporada=`                                           |
| PUT    | `/jornadas/{numeroJornada}` | **admin** | Reemplazo total (fecha + 15 partidos)                            |
| DELETE | `/jornadas/{numeroJornada}` | **admin** | 204; borra los partidos en cascada                               |

### Operación

| Método | Ruta            | Auth                    | Descripción                                                  |
| ------ | --------------- | ----------------------- | ------------------------------------------------------------ |
| GET    | `/health`       | —                       | Liveness: el proceso responde                                |
| GET    | `/health/ready` | —                       | Readiness: `SELECT 1` contra la BD; 503 si falla             |
| GET    | `/docs`         | — (o protegido en prod) | Swagger UI                                                   |
| GET    | `/openapi.json` | —                       | Documento OpenAPI                                            |
| POST   | `/dev/token`    | —                       | **Solo** si `NODE_ENV≠production` y `ENABLE_DEV_TOKENS=true` |

---

## 10. Contrato de errores

Formato exacto del prompt, con un `details` opcional para validación (útil sin romper el contrato):

```json
{
  "error": "VALIDATION_ERROR",
  "message": "El campo 'partidos' debe contener exactamente 15 elementos.",
  "details": [{ "path": "partidos", "code": "too_small" }],
  "requestId": "01JB2..."
}
```

| `error`                    | HTTP | Cuándo                                                                      |
| -------------------------- | ---- | --------------------------------------------------------------------------- |
| `VALIDATION_ERROR`         | 400  | Zod rechaza body/params/query                                               |
| `UNAUTHORIZED`             | 401  | Sin cabecera, token inválido, expirado, firma incorrecta                    |
| `FORBIDDEN`                | 403  | Token válido sin el rol necesario _(Q4: `user` intentando crear jornada)_   |
| `REGISTRATION_NOT_ALLOWED` | 403  | Google sin invitación válida _(Q2)_                                         |
| `NOT_FOUND`                | 404  | Recurso inexistente                                                         |
| `CONFLICT`                 | 409  | `numeroJornada` duplicado en la temporada; temporada con jornadas al borrar |
| `INVITATION_EXPIRED`       | 410  | Invitación caducada o ya usada                                              |
| `UNSUPPORTED_MEDIA_TYPE`   | 415  | Content-Type incorrecto                                                     |
| `PAYLOAD_TOO_LARGE`        | 413  | Body por encima del límite                                                  |
| `RATE_LIMITED`             | 429  | Demasiados intentos                                                         |
| `INTERNAL_ERROR`           | 500  | Todo lo inesperado. **Mensaje genérico**; el detalle solo al log            |

**Implementación**: jerarquía `AppError` en `src/core/errors.ts` con `status` + `code`; los services lanzan `new ConflictError(...)`; **un solo** middleware serializa. Ningún controller construye respuestas de error a mano — así el formato no puede divergir entre endpoints.

`requestId` en la respuesta y en el log: te dan el id y encuentras la traza exacta.

---

## 11. Estrategia de documentación (OpenAPI)

**Regla**: el esquema Zod es la única fuente de verdad. De él salen (a) la validación en runtime, (b) los tipos de TypeScript, (c) el documento OpenAPI. Documentación imposible de desincronizar.

```mermaid
flowchart LR
    Z["Esquemas Zod<br/>*.schemas.ts"] --> V["Validación runtime<br/>middleware/validate"]
    Z --> T["Tipos TS<br/>z.infer"]
    Z --> R["Registry OpenAPI"] --> J["openapi/openapi.json"]
    J --> UI["Swagger UI /docs"]
    J --> INS["Colección Insomnia"]
    J --> CT["Contract tests (ajv)"]
    J --> L["Lint Spectral en CI"]
```

Lo que se exige a cada endpoint (verificado por Spectral en CI, no por buena voluntad):

- `summary`, `description`, `operationId`, `tags`
- esquema de request **y de cada respuesta**, incluidos 400/401/**403**/404/409
- al menos un `example` de request y de respuesta
- `security` declarado explícitamente, y el **rol requerido indicado en la descripción**
- Security schemes: `bearerAuth` (JWT), `oauth2Password` (tokenUrl `/api/v1/auth/token`), `oauth2Google` (authorizationCode + PKCE)

`openapi/openapi.json` se **commitea generado**: el diff del PR muestra cuándo cambia el contrato público. Un cambio accidental salta a la vista en la revisión.

---

## 12. Estrategia de base de datos local (docker vs embebida)

Una única variable manda:

```
DB_MODE=docker    # por defecto: DATABASE_URL apunta al contenedor
DB_MODE=embedded  # arranca PostgreSQL embebida y reescribe DATABASE_URL
```

| Aspecto               | `docker`                                     | `embedded`                                    |
| --------------------- | -------------------------------------------- | --------------------------------------------- |
| Arranque              | `docker compose up -d` (manual, persistente) | Automático al arrancar app/tests              |
| Persistencia          | Volumen Docker (sobrevive)                   | Carpeta `.pgdata/` (opcionalmente efímera)    |
| Requiere Docker       | Sí                                           | No                                            |
| Velocidad de arranque | Instantáneo (ya corriendo)                   | 1–3 s la primera vez                          |
| Uso recomendado       | **Desarrollo diario**                        | **Tests (CI incluido)** y trabajar sin Docker |
| Inspección            | `psql`, Adminer, `drizzle-kit studio`        | `drizzle-kit studio` al puerto asignado       |

**Punto de diseño clave**: la aplicación **no debe saber** cuál usa. `src/db/index.ts` recibe una `DATABASE_URL` ya resuelta; quien decide es un _bootstrap_ previo. Si el pool supiera de Docker o de binarios embebidos, tendrías esa condición esparcida por todo el código.

---

## 13. Estrategia de testing

### Pirámide propuesta

| Nivel           | Qué prueba                                                                         | Herramienta        | BD            | Objetivo                          |
| --------------- | ---------------------------------------------------------------------------------- | ------------------ | ------------- | --------------------------------- |
| **Unit**        | Reglas puras: 15 partidos, orden 1..15, formato de `codigo`, firma de tokens, hash | Vitest             | No            | Rápido, muchos casos borde        |
| **Integración** | Endpoint completo: HTTP → middleware → service → SQL real                          | Vitest + Supertest | **Sí (real)** | Donde aparecen los bugs de verdad |
| **Contrato**    | La respuesta real cumple el esquema del OpenAPI                                    | ajv                | Sí            | La documentación no miente        |
| **Humo (e2e)**  | La colección de Insomnia pasa contra la app arrancada                              | `inso run test`    | Sí            | El camino del cliente real        |

### Cómo se prueban endpoints autenticados (requisito 3 del prompt)

Helpers en `tests/helpers/auth.ts`, por orden de preferencia:

1. **`authHeader(user)`** — firma un JWT con la misma clave que la app. **Rápido** (sin HTTP, sin argon2): el 90 % de los tests de negocio.
2. **`loginAs(email, password)`** — hace `POST /auth/token` de verdad. Para los tests **de auth**.
3. **`createAdmin()` / `createUser()`** — crean el usuario en BD con el rol correspondiente.
4. **`mockGoogle()`** — intercepta el intercambio con Google. Los tests **no** salen a internet: sería lento y frágil. El callback se prueba con un `id_token` firmado por una clave de test.

Batería mínima que todo endpoint autenticado debe pasar (plantilla reutilizable):

| Caso                                              | Esperado            |
| ------------------------------------------------- | ------------------- |
| Sin cabecera `Authorization`                      | 401 `UNAUTHORIZED`  |
| `Bearer basura`                                   | 401                 |
| Token expirado (`exp` pasado)                     | 401                 |
| Token firmado con otra clave                      | 401                 |
| Token con `aud`/`iss` incorrectos                 | 401                 |
| **Token de `user` en endpoint de `admin`** _(Q4)_ | **403 `FORBIDDEN`** |
| Token de `admin` correcto                         | 2xx                 |

### Aislamiento entre tests

- **Una BD por ejecución**, no por test (arrancar Postgres es lo caro).
- Entre tests: `TRUNCATE ... RESTART IDENTITY CASCADE`. Alternativa más elegante: cada test en una transacción con `ROLLBACK` — más rápido, pero incompatible con código que abre sus propias transacciones (y el service de jornadas las abre). Empezamos con `TRUNCATE`: simple y siempre funciona.
- Cobertura sugerida: **80 % global**, **100 % en `auth.service`, `invitations.service` y validación de jornadas**. Los umbrales van en `vitest.config.ts` para que CI los haga cumplir.

---

## 14. Plan de fases con comandos

> **Cómo usar esta sección**: fase a fase. Cada una acaba con un **criterio de aceptación** comprobable con un comando. Si no pasa, no sigas: los errores de la fase 3 son fáciles de encontrar en la fase 3 e imposibles en la 11.
>
> Los ficheros de **configuración e infraestructura** los doy con contenido (los necesitas tal cual). El **código de aplicación** lo doy como _responsabilidad + criterio_, para que lo escribas tú: es el objetivo del ejercicio.

---

### F0 — Prerrequisitos (≈ 30 min)

```bash
cd /Users/jfernandez/Desarrollo/Proyectos/quini-api
node -v && npm -v && docker -v && docker compose version && git --version
```

> **Estado real (2026-08-06): las dos tareas de F0 quedan diferidas por decisión del usuario.**
>
> | Tarea                        | Estado                    | Qué bloquea            | Cuándo hay que resolverla |
> | ---------------------------- | ------------------------- | ---------------------- | ------------------------- |
> | Credenciales OAuth de Google | **Diferida**              | Solo **F6**            | Antes de empezar F6       |
> | VPS + DNS del subdominio     | **No contratado todavía** | Solo **F12** y **F13** | Antes de empezar F12      |
>
> **Esto no bloquea nada del camino crítico.** F1 → F2 → F3 → F4 → F5 → F8 → F10 → F11 no necesita ni Google ni VPS: son ~26–35 h de trabajo con una API que arranca, autentica por contraseña, persiste en Postgres local y se prueba entera. Google y el despliegue se enganchan después sin rehacer nada — es justo la razón por la que F6 y F12 se diseñaron como ramas desacopladas del tronco.
>
> Consecuencia práctica en F4/F5: usa el flujo de invitación + contraseña para todas las pruebas. El campo `password_hash` nullable y la tabla `oauth_accounts` se crean igualmente en las migraciones (no cuesta nada y evita una migración extra después), simplemente no se usan todavía.
>
> **Decisión cerrada (Q10): PostgreSQL 18 en los tres entornos.** `postgres:18-alpine` en Docker (desarrollo y producción) y `embedded-postgres@18.4.0-beta.17` con versión exacta en tests. Claves primarias con `uuidv7()` nativo. Ya aplicado a lo largo de todo el documento.

**Tareas** (cuando toque):

1. Crear el proyecto en Google Cloud Console (se necesita en F6):
   - Consola → _APIs & Services_ → _OAuth consent screen_ → **External**, añádete como _test user_.
   - → _Credentials_ → _Create credentials_ → **OAuth client ID** → _Web application_.
   - **Authorized redirect URIs**: `http://localhost:3000/api/v1/auth/google/callback` y (para más adelante) `https://api.tudominio.com/api/v1/auth/google/callback`.
   - Guarda _Client ID_ y _Client secret_ fuera del repo.
2. Para F12: tener el **VPS** (Ubuntu 24.04 LTS recomendado) y un **subdominio** apuntando por `A`/`AAAA` a su IP. Caddy no puede emitir certificado sin DNS resuelto.

**Aceptación**: credenciales de Google guardadas y `dig +short api.tudominio.com` devolviendo la IP del VPS.

---

### F1 — Bootstrap del repositorio (≈ 1–1,5 h)

**Objetivo**: repo con git, TypeScript, linter, formateo y scripts. Todo compila y el linter pasa, aunque no haya lógica.

```bash
git init -b main
npm init -y

npm pkg set name="quini-api" private=true type="module" license="UNLICENSED"
npm pkg set description="API REST autenticada para la gestión de una peña de quiniela"
npm pkg set engines.node=">=22.6"

npm i -D --save-exact typescript@^5.7.0 @types/node tsx
npm i -D eslint typescript-eslint prettier eslint-config-prettier
```

> ⚠️ **No instales `typescript` a secas (última mayor).** A fecha de este plan la última es **TypeScript 7** (el compilador nativo reescrito en Go), y **ningún** release de `typescript-eslint` lo soporta todavía — su `peerDependencies.typescript` está fijado a `>=4.8.4 <6.1.0`, incluso en las alphas más recientes (verificado con `npm view typescript-eslint@latest peerDependencies`). Instalar TS7 y `typescript-eslint` juntos revienta con `ERESOLVE`. Fijamos **TypeScript 5.7.x** hasta que `typescript-eslint` publique soporte para la línea 7; revisar este punto antes de subir de major.

```bash
mkdir -p src/{config,core,db/schema,middleware,modules,openapi,utils}
mkdir -p src/modules/{auth,invitations,users,temporadas,jornadas}
mkdir -p tests/{unit,integration,helpers,setup,fixtures}
mkdir -p docker/initdb drizzle openapi insomnia scripts docs/adr .github/workflows
```

**`tsconfig.json`**:

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2023"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "types": ["node"],
  },
  "include": ["src", "tests", "scripts", "*.config.ts", "drizzle.config.ts"],
  "exclude": ["node_modules", "dist"],
}
```

> `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` son incómodos al principio y te ahorran clases enteras de bugs. Actívalos ahora: hacerlo con 5.000 líneas escritas es un suplicio.

**`.gitignore`**:

```gitignore
node_modules/
dist/
coverage/
.pgdata/
*.log
.env
.env.*
!.env.example
!.env.test
.DS_Store
.vitest/
backups/
client_secret_*.json
resorces/
resources/
```

> ⚠️ **Sobre el JSON de credenciales de Google Cloud Console**: el botón "Descargar JSON" de un OAuth Client deja un fichero `client_secret_<id>.apps.googleusercontent.com.json` con el secreto en claro. No es un formato pensado para vivir en el repo. Flujo correcto: (1) copia `client_id` y `client_secret` a `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` en `.env` (ya gitignorado), (2) **borra el fichero descargado del disco**, no lo dejes "de momento" en una carpeta. Si el fichero llegó a estar en un commit, un `.gitignore` posterior no lo saca del historial: hay que rotar el secreto en Google Cloud Console.

**`.env.example`** (se commitea; el `.env` real no):

```dotenv
# --- Servidor ---
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
API_BASE_URL=http://localhost:3000
PUBLIC_APP_URL=http://localhost:5173      # base de la URL de invitación
CORS_ORIGINS=http://localhost:5173

# --- Base de datos ---
DB_MODE=docker                            # docker | embedded
DATABASE_URL=postgresql://quiniela:quiniela@localhost:5432/quiniela
EMBEDDED_PG_PORT=54329
EMBEDDED_PG_DIR=./.pgdata

# --- JWT ---
JWT_ISSUER=quini-api
JWT_AUDIENCE=quini-api-clients
JWT_ALG=HS256                             # HS256 en dev, RS256 en produccion
JWT_SECRET=cambia-esto-por-32-bytes-aleatorios
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL=30d

# --- Cookies (solo state de Google; Q5: el refresh va en el body) ---
COOKIE_SECRET=cambia-esto-tambien

# --- Invitaciones (Q2) ---
INVITATION_TTL=7d

# --- Google OAuth ---
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/v1/auth/google/callback

# --- Observabilidad (§16) ---
METRICS_ENABLED=true
METRICS_PATH=/metrics
OTEL_ENABLED=false                        # trazas: activar solo cuando haga falta (D24)
OTEL_SERVICE_NAME=quini-api
OTEL_EXPORTER_OTLP_ENDPOINT=http://tempo:4318

# --- Solo desarrollo ---
ENABLE_DEV_TOKENS=true
```

Genera secretos de verdad:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"   # JWT_SECRET
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"   # COOKIE_SECRET
cp .env.example .env    # y pega los secretos generados
```

Scripts:

```bash
npm pkg set scripts.dev="node --env-file=.env --import tsx --watch src/server.ts"
npm pkg set scripts.build="tsc -p tsconfig.json"
npm pkg set scripts.start="node dist/src/server.js"
npm pkg set scripts.typecheck="tsc --noEmit"
npm pkg set scripts.lint="eslint ."
npm pkg set scripts.format="prettier --write ."
```

Linter y formateo: crea `eslint.config.js` con la config recomendada de `typescript-eslint` y `eslint-config-prettier` **al final**, y `.prettierrc.json` con tus preferencias.

Hooks de git:

```bash
npm i -D husky lint-staged
npx husky init
```

> ⚠️ **No uses `npm pkg set lint-staged.'*.{ts,js}'=...`**: `npm pkg set` trata el `.` como separador de ruta anidada, así que esa clave se parte en `"*"` → `"{ts,js}"` y termina creando un objeto anidado inválido para `lint-staged` (error: _"Function task should contain `title` and `task` fields"_). Edita `package.json` directamente para dejar claves planas:
>
> ```json
> "lint-staged": {
>   "*.{ts,js}": "eslint --fix",
>   "*.{json,md,yml}": "prettier --write"
> }
> ```

```bash
# edita .husky/pre-commit → npx lint-staged && npm run typecheck
git add -A && git commit -m "chore: bootstrap del proyecto (TS, lint, estructura)"
```

**Aceptación**: `npm run typecheck && npm run lint` sin errores y primer commit hecho.

**Qué aprendes**: ESM en Node, `tsconfig` estricto, por qué `.env` nunca se commitea, hooks de git como red de seguridad.

---

### F2 — Servidor Express, config, logs y errores (≈ 2–3 h)

**Objetivo**: `GET /health` responde 200 y **el manejo de errores ya es el definitivo**. Son los cimientos de todas las fases siguientes.

```bash
npm i express@5 zod pino pino-http helmet cors
npm i -D @types/express pino-pretty
```

| Fichero                           | Responsabilidad                                                                                                                                     | Criterio de "bien hecho"                                                                                                 |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/config/env.ts`               | Esquema Zod de todas las variables; parsea `process.env` **una vez** al arrancar y exporta un objeto tipado                                         | Si falta `JWT_SECRET`, el proceso **muere al arrancar** con mensaje claro. No hay `process.env.X` en ningún otro fichero |
| `src/core/errors.ts`              | `AppError` con `status` + `code`; subclases `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `GoneError` | Ningún `throw new Error("...")` en services                                                                              |
| `src/middleware/request-id.ts`    | Lee `X-Request-Id` o lo genera; lo guarda en `AsyncLocalStorage` y lo devuelve                                                                      | El mismo id aparece en log y respuesta                                                                                   |
| `src/middleware/http-logger.ts`   | `pino-http` con `requestId`; **redacta** `authorization`, `password`, `token`, `set-cookie`                                                         | Ningún token ni contraseña en los logs                                                                                   |
| `src/middleware/validate.ts`      | Factoría `validate({ body?, params?, query? })` que parsea con Zod y **reemplaza** el valor por el parseado                                         | Un `orden: "3"` (string) no llega al service                                                                             |
| `src/middleware/error-handler.ts` | Único serializador: `AppError` → su status; `ZodError` → 400; resto → 500 genérico + log del stack                                                  | Un error inesperado nunca filtra stack al cliente                                                                        |
| `src/app.ts`                      | Compone helmet, cors, `express.json({ limit: '100kb' })`, requestId, logger, rutas, 404, errorHandler. **Exporta `app`**                            | No contiene `listen()`                                                                                                   |
| `src/server.ts`                   | `listen()` + apagado ordenado (`SIGTERM`/`SIGINT`: dejar de aceptar, cerrar pool, salir)                                                            | `Ctrl+C` no deja conexiones colgando                                                                                     |
| `src/routes.ts`                   | Monta módulos bajo `/api/v1`                                                                                                                        | Añadir un módulo = una línea                                                                                             |

Orden de middlewares (importa, y es fuente de bugs sutiles): `helmet → cors → requestId → logger → parsers → rutas → 404 → errorHandler`. El manejador de errores **siempre al final** y con **4 parámetros** (`err, req, res, next`), o Express no lo reconoce como tal.

```bash
npm run dev
curl -i http://localhost:3000/health
curl -i http://localhost:3000/no-existe
curl -i -X POST http://localhost:3000/api/v1/echo -H 'Content-Type: application/json' -d '{'
```

**Aceptación**: `/health` devuelve `{"status":"ok",...}`; una ruta inexistente devuelve el JSON del contrato; un JSON malformado da **400, no 500**; logs legibles y sin secretos.

**Qué aprendes**: orden de middlewares, por qué separar `app` de `server`, por qué centralizar errores, configuración _fail-fast_.

---

### F3 — PostgreSQL: Docker, embebida, Drizzle y migraciones (≈ 3–4 h)

**Objetivo**: `users` versionada en migraciones, aplicable en ambos modos de BD.

**`docker/docker-compose.yml`**:

```yaml
services:
  postgres:
    image: postgres:18-alpine
    container_name: quiniela-pg
    restart: unless-stopped
    environment:
      POSTGRES_USER: quiniela
      POSTGRES_PASSWORD: quiniela
      POSTGRES_DB: quiniela
      TZ: UTC
    ports:
      - "5432:5432"
    volumes:
      - quiniela-pgdata:/var/lib/postgresql/data
      - ./initdb:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U quiniela -d quiniela"]
      interval: 5s
      timeout: 5s
      retries: 10

  adminer:
    image: adminer:latest
    restart: unless-stopped
    ports:
      - "8080:8080"
    depends_on:
      postgres:
        condition: service_healthy

volumes:
  quiniela-pgdata:
```

**`docker/initdb/01-extensions.sql`**:

```sql
-- citext: email sin distinguir mayusculas/minusculas (ver seccion 7)
CREATE EXTENSION IF NOT EXISTS citext;
```

> **Por qué NO hace falta `pgcrypto`** _(Q10)_: se incluía solo para `gen_random_uuid()`, pero esa función es parte del núcleo desde PostgreSQL 13, y en la 18 tienes además `uuidv7()`. Una extensión menos que instalar, versionar y explicar. Si alguna vez necesitas `crypt()` o `digest()` en SQL, entonces sí la añades — pero el hash de contraseñas lo hace la aplicación con Argon2 (D11), no la base de datos.

> `initdb/` **solo se ejecuta cuando el volumen está vacío**. Si cambias estos scripts después, hay que borrar el volumen (`down -v`). Fuente habitual de confusión.

```bash
npm pkg set scripts.db:up="docker compose -f docker/docker-compose.yml up -d"
npm pkg set scripts.db:down="docker compose -f docker/docker-compose.yml down"
npm pkg set scripts.db:reset="docker compose -f docker/docker-compose.yml down -v && npm run db:up"
npm pkg set scripts.db:psql="docker compose -f docker/docker-compose.yml exec postgres psql -U quiniela -d quiniela"

npm run db:up
docker compose -f docker/docker-compose.yml ps
npm run db:psql -- -c '\l'
```

Drizzle:

```bash
npm i drizzle-orm pg
npm i -D drizzle-kit @types/pg
```

**`drizzle.config.ts`**:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

**Ciclo de migraciones — apréndete este bucle, lo repetirás en cada cambio de modelo**:

```bash
# 1. editas src/db/schema/*.ts
npx drizzle-kit generate     # crea drizzle/0000_xxx.sql  ← LÉELO antes de aplicar
npx drizzle-kit migrate      # lo aplica a DATABASE_URL
npx drizzle-kit studio       # GUI en https://local.drizzle.studio
```

```bash
npm pkg set scripts.db:generate="node --env-file=.env node_modules/drizzle-kit/bin.cjs generate"
npm pkg set scripts.db:migrate="node --env-file=.env node_modules/drizzle-kit/bin.cjs migrate"
npm pkg set scripts.db:studio="node --env-file=.env node_modules/drizzle-kit/bin.cjs studio"
```

> **Nunca** uses `drizzle-kit push` fuera de un prototipo desechable: sincroniza el esquema sin dejar migración y pierdes el historial reproducible. `generate` + `migrate` siempre.

PostgreSQL embebida:

```bash
npm i -D --save-exact embedded-postgres@18.4.0-beta.17   # Q10: misma major que Docker; version exacta
npm pkg set scripts.db:embedded="node --env-file=.env --import tsx scripts/db-embedded.ts"

# HUMO INMEDIATO: comprobar que arranca en Apple Silicon ANTES de construir sobre ella
npm run db:embedded          # debe imprimir una DATABASE_URL y quedarse escuchando; Ctrl+C para parar
```

`scripts/db-embedded.ts`: instancia `EmbeddedPostgres` con `databaseDir`, `user`, `password`, `port` de `env`; `initialise()` la primera vez, `start()`, crea la base si no existe, imprime la `DATABASE_URL` resultante y captura `SIGINT` para pararla limpiamente.

| Fichero                  | Responsabilidad                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `src/db/index.ts`        | `Pool` de `pg` (con `max`, `idleTimeoutMillis`) + instancia de Drizzle. Expone `closeDb()` para el apagado ordenado |
| `src/db/schema/users.ts` | Tabla `users` según §7 (con `role` y su `CHECK`)                                                                    |
| `src/db/schema/index.ts` | Re-exporta todas las tablas (es lo que lee `drizzle-kit`)                                                           |
| `src/db/migrate.ts`      | Aplica migraciones programáticamente (para tests y dev)                                                             |
| `src/routes.ts`          | Añade `GET /health/ready`: `SELECT 1` y 503 si la BD no responde                                                    |

**Aceptación**:

```bash
npm run db:up && npm run db:generate && npm run db:migrate
npm run db:psql -- -c '\d users'
curl -i http://localhost:3000/health/ready              # 200
npm run db:down && curl -i http://localhost:3000/health/ready   # 503
npm run db:up
```

**Qué aprendes**: _liveness_ vs _readiness_, migraciones versionadas vs sincronización automática, pool de conexiones, aislar la app del origen de la BD.

---

### F4 — Autenticación con contraseña y roles (≈ 4–6 h)

**Objetivo**: obtener un token con credenciales, usarlo, renovarlo, revocarlo, y que el rol se compruebe.

```bash
npm i jose @node-rs/argon2 express-rate-limit
```

Esquema: añade `refresh_tokens` y `oauth_accounts` (§7); genera y aplica migración.

| Fichero                               | Responsabilidad                                                                                 | Detalle crítico                                                                                       |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/modules/auth/password.ts`        | `hash(plain)` / `verify(hash, plain)` con Argon2id                                              | Parámetros OWASP: `memoryCost` ~19 MiB, `timeCost` 2, `parallelism` 1                                 |
| `src/modules/auth/tokens.ts`          | `signAccessToken(user)` (incluye `role`), `verifyAccessToken`, `newRefreshToken`, `hashRefresh` | El verify comprueba **firma, `exp`, `iss` y `aud`**. Omitir `aud`/`iss` es un agujero real            |
| `src/modules/auth/auth.repository.ts` | Usuarios por email normalizado; CRUD de refresh tokens                                          | Búsqueda por `citext` o `lower(email)`                                                                |
| `src/modules/auth/auth.service.ts`    | `loginWithPassword`, `refresh` (rotación + detección de reuso), `revoke`, `logoutAll`           | Tiempo constante: si el usuario no existe, **verifica igualmente contra un hash dummy** antes del 401 |
| `src/modules/auth/auth.schemas.ts`    | Zod de `TokenRequest` (`z.discriminatedUnion('grant_type', …)`) y `TokenResponse`               | Acepta `application/x-www-form-urlencoded`                                                            |
| `src/modules/auth/auth.controller.ts` | Traduce a HTTP; `Cache-Control: no-store` en respuestas con token                               | Obligatorio por RFC 6749                                                                              |
| `src/middleware/require-auth.ts`      | Extrae `Bearer`, verifica, rellena `req.auth = { userId, email, role }`                         | Un token válido de otro `aud` debe fallar                                                             |
| `src/middleware/require-role.ts`      | `requireRole('admin')` → 403 si no cumple _(Q3, Q4)_                                            | 401 ≠ 403: "no sé quién eres" vs "sé quién eres y no puedes"                                          |
| `scripts/create-admin.ts`             | **Bootstrap del primer admin** _(Q2)_; contraseña por stdin                                     | Se niega si ya existe un admin, salvo `--force`                                                       |
| `scripts/mint-token.ts`               | Token de dev por CLI, con `--role`                                                              | Se niega con `NODE_ENV=production`                                                                    |

```bash
npm pkg set scripts.admin:create="node --env-file=.env --import tsx scripts/create-admin.ts"
npm pkg set scripts.token="node --env-file=.env --import tsx scripts/mint-token.ts"
npm pkg set scripts.seed="node --env-file=.env --import tsx scripts/seed.ts"
```

**Aceptación** (guarda estos comandos, los usarás a diario):

```bash
npm run admin:create -- --email=admin@quiniela.local --nombre="Admin"

# 1) token
curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password&username=admin@quiniela.local&password=TuPass123!' | tee /tmp/tok.json

export TOKEN=$(jq -r .access_token /tmp/tok.json)
export RT=$(jq -r .refresh_token /tmp/tok.json)

# 2) endpoint protegido
curl -s http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN" | jq

# 3) sin token → 401
curl -i http://localhost:3000/api/v1/auth/me

# 4) contraseña incorrecta → 401 (mismo mensaje que usuario inexistente)
curl -i -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=password&username=admin@quiniela.local&password=mal'

# 5) refresh con rotación
curl -s -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=refresh_token&refresh_token=$RT" | jq

# 6) reusar el refresh viejo → 401 y familia revocada
curl -i -X POST http://localhost:3000/api/v1/auth/token \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d "grant_type=refresh_token&refresh_token=$RT"

# 7) inspecciona el payload del JWT (comprueba que lleva "role")
echo $TOKEN | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

**Qué aprendes**: por qué el access token es corto y el refresh revocable; rotación y detección de reuso; por qué 401 debe ser genérico; **autenticación vs autorización**.

---

### F5 — Invitaciones y registro cerrado _(Q2)_ (≈ 3–4 h)

**Objetivo**: un admin invita, el invitado se registra con esa invitación, y sin invitación **no hay alta posible**.

Esquema: tabla `invitations` (§7) con el índice único parcial de "una pendiente por email". Genera y aplica migración.

| Fichero                        | Responsabilidad                                                                                                                                                         | Detalle crítico                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `invitations.service.ts`       | `create(email, role, invitedBy)`: genera token 32B, guarda `sha256`, `expires_at = now + INVITATION_TTL`; `validate(token)`; `consume(token, tx)`                       | El token **en claro se devuelve una sola vez** en el 201; después es irrecuperable (como en GitHub) |
| `invitations.repository.ts`    | `findUsableByHash` filtra `accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()`                                                                           | Un solo `WHERE` decide usabilidad: no repartas esa lógica                                           |
| `invitations.controller.ts`    | 201 con `{ id, email, expiresAt, url }` construida con `PUBLIC_APP_URL`                                                                                                 | 410 si caducada, 404 si no existe; **no distingas "caducada" de "ya usada"**: ambas 410             |
| `invitations.routes.ts`        | `requireAuth + requireRole('admin')` salvo `/validar`, público y **rate-limited**                                                                                       | Sin rate limit, `/validar` es un oráculo para adivinar tokens                                       |
| `auth.service.ts` (ampliación) | `registerWithInvitation({ token, password, nombre })` **en una transacción**: valida → crea usuario con el `role` de la invitación → marca `accepted_at` → emite tokens | Sin transacción puedes crear el usuario sin consumir la invitación (queda reutilizable) o al revés  |

**Aceptación**:

```bash
# 1) el admin invita
export INV=$(curl -s -X POST http://localhost:3000/api/v1/invitaciones \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"pepe@example.com","role":"user"}')
echo $INV | jq
export ITOKEN=$(echo $INV | jq -r .token)

# 2) un user normal NO puede invitar → 403
curl -i -X POST http://localhost:3000/api/v1/invitaciones \
  -H "Authorization: Bearer $USER_TOKEN" -H 'Content-Type: application/json' \
  -d '{"email":"otro@example.com","role":"user"}'

# 3) validar la invitación (público)
curl -s "http://localhost:3000/api/v1/invitaciones/$ITOKEN/validar" | jq

# 4) registro
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$ITOKEN\",\"password\":\"OtraPass123!\",\"nombre\":\"Pepe\"}" | jq

# 5) reusar la misma invitación → 410
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d "{\"token\":\"$ITOKEN\",\"password\":\"X\",\"nombre\":\"Y\"}"

# 6) token inventado → 404/410, nunca 500
curl -i -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' -d '{"token":"aaa","password":"OtraPass123!","nombre":"Z"}'
```

**Qué aprendes**: tokens de un solo uso con hash en BD, índices únicos parciales, transacciones que abarcan dos tablas, por qué no se distinguen los motivos de rechazo en un endpoint público.

---

### F6 — Autenticación con Google, cerrada por invitación (≈ 3–4 h)

**Objetivo**: entrar con Gmail y recibir tokens propios, **solo** si ya eres usuario o tienes invitación válida.

```bash
npm i google-auth-library cookie-parser
npm i -D @types/cookie-parser
```

| Fichero                        | Responsabilidad                                                                                                                                                                          | Detalle crítico                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `auth/google.ts`               | URL de autorización (`state` + `code_challenge` S256), canje del `code`, verificación del `id_token`                                                                                     | Verificar `aud === GOOGLE_CLIENT_ID`, `iss` de Google, `exp` y **`email_verified === true`** |
| `auth.service.ts` (ampliación) | `loginWithGoogle(profile)`: `(provider, sub)` → si no existe, busca usuario por email verificado → si no existe, **exige invitación** → si no hay, `403 REGISTRATION_NOT_ALLOWED` _(Q2)_ | Vincular por email **no verificado** permite secuestrar cuentas                              |
| `auth.controller.ts`           | `GET /auth/google` (302) y `GET /auth/google/callback`                                                                                                                                   | El `state` va en cookie firmada de corta vida y se **compara y borra**; sin eso hay CSRF     |
| Ruta extra                     | `POST /auth/google/id-token` para un frontend que ya tiene el ID token                                                                                                                   | Mismo camino de verificación, sin redirecciones                                              |

**Aceptación**:

```bash
open "http://localhost:3000/api/v1/auth/google"     # con tu cuenta ya invitada → tokens
npm run db:psql -- -c 'select provider, email from oauth_accounts;'
npm run db:psql -- -c "select email, role, password_hash is null as solo_google from users;"
```

Casos negativos obligatorios: `state` manipulado → 400; `code` inválido → 401; **cuenta de Google sin invitación → 403**; misma cuenta dos veces → **no duplica usuario**.

**Qué aprendes**: Authorization Code + PKCE, para qué sirve `state`, ID token vs access token, vinculación de cuentas y por qué el registro social hay que cerrarlo explícitamente.

---

### F7 — OpenAPI y Swagger UI (≈ 2–3 h)

**Objetivo**: `/docs` navegable, con auth e invitaciones ya documentadas y probables desde la UI.

```bash
npm i zod-openapi swagger-ui-express
npm i -D @types/swagger-ui-express @stoplight/spectral-cli
```

| Fichero                           | Responsabilidad                                                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `src/openapi/registry.ts`         | Registro central: componentes + operaciones. Cada módulo se registra a sí mismo                                          |
| `src/openapi/security-schemes.ts` | `bearerAuth`, `oauth2Password` (tokenUrl `/api/v1/auth/token`), `oauth2Google`                                           |
| `src/openapi/generate.ts`         | Ensambla y escribe `openapi/openapi.json`                                                                                |
| `src/app.ts` (ampliación)         | Sirve `GET /openapi.json` y `GET /docs` (Swagger UI, `persistAuthorization: true`)                                       |
| `.spectral.yaml`                  | Exige `operationId`, `summary`, `description`, `examples`, y respuestas **401 y 403** declaradas en rutas con `security` |

```bash
npm pkg set scripts.openapi:generate="node --env-file=.env --import tsx src/openapi/generate.ts"
npm pkg set scripts.openapi:lint="spectral lint openapi/openapi.json"
npm run openapi:generate && npm run openapi:lint
open http://localhost:3000/docs
```

**Aceptación**: `openapi.json` pasa Spectral, `/docs` permite autorizar con Bearer y llamar a `/auth/me`, y **cada** operación declara sus errores y el rol que exige.

**Qué aprendes**: OpenAPI 3.1 y JSON Schema, security schemes, documentación como artefacto verificable en CI.

---

### F8 — Testing autenticado y por rol (≈ 4–5 h)

**Objetivo**: `npm test` arranca su propia BD, migra, corre unit + integración y reporta cobertura. Reproducible y sin depender de tu `.env`.

```bash
npm i -D vitest supertest @types/supertest @vitest/coverage-v8 ajv ajv-formats
```

**`vitest.config.ts`**: entorno `node`, `globalSetup: tests/setup/global-setup.ts`, `pool: 'forks'`, `fileParallelism: false` para integración, umbrales de cobertura, `setupFiles` para truncar tablas.

**`.env.test`** (se commitea, sin secretos reales): `NODE_ENV=test`, `DB_MODE=embedded`, `LOG_LEVEL=silent`, `JWT_SECRET=test-secret-...`, `ENABLE_DEV_TOKENS=false`.

| Fichero                       | Responsabilidad                                                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `tests/setup/global-setup.ts` | Arranca la Postgres embebida en puerto libre, exporta `DATABASE_URL`, migra, y la para en el teardown                              |
| `tests/setup/truncate.ts`     | `TRUNCATE ... RESTART IDENTITY CASCADE` antes de cada test                                                                         |
| `tests/helpers/auth.ts`       | `createUser()`, `createAdmin()`, `authHeader(user)`, `loginAs()`, `expiredToken()`, `tokenSignedWithOtherKey()`                    |
| `tests/helpers/factories.ts`  | `buildTemporada()`, `buildJornada(overrides)` con 15 partidos válidos, y variantes inválidas (14 partidos, orden duplicado, hueco) |
| `tests/helpers/openapi.ts`    | Valida un body de respuesta contra el esquema del OpenAPI (ajv)                                                                    |

```bash
npm pkg set scripts.test="node --env-file=.env.test node_modules/vitest/vitest.mjs run"
npm pkg set scripts.test:watch="node --env-file=.env.test node_modules/vitest/vitest.mjs"
npm pkg set scripts.test:cov="node --env-file=.env.test node_modules/vitest/vitest.mjs run --coverage"
```

**Aceptación**: `npm test` pasa **con Docker parado** (usa la embebida); la batería de 7 casos de §13 (incluido el **403 de `user` en endpoint de admin**) está cubierta para auth e invitaciones; cobertura por encima de los umbrales.

**Qué aprendes**: tests de integración con BD real frente a mocks, aislamiento de datos, firmar tokens en tests, contract testing.

---

### F9 — Insomnia (≈ 1–2 h)

**Objetivo**: colección funcional, versionada y ejecutable desde CI.

Pasos en Insomnia:

1. _Create_ → _Import_ → _File_ → `openapi/openapi.json`.
2. _Environments_ → **Local**: `base_url = http://localhost:3000/api/v1`, `access_token`, `refresh_token`.
3. Carpeta raíz → _Auth_ → **OAuth 2.0** → _Grant type_: **Password Credentials**
   - Access Token URL: `{{ base_url }}/auth/token`
   - Username / Password: los del admin
   - _Advanced_: **Send credentials in body**
   - Con esto Insomnia renueva el token solo y los hijos heredan la auth.
4. Duplica la carpeta con **Authorization Code** para Google: Authorization URL `https://accounts.google.com/o/oauth2/v2/auth`, Token URL `https://oauth2.googleapis.com/token`, PKCE activado.
5. Crea **dos entornos de rol** (`Local-admin`, `Local-user`) para comprobar los 403 a mano sin editar peticiones.
6. _Export_ → `insomnia/quini-api.insomnia.yaml` → commitea.

```bash
npm i -D insomnia-inso
npx inso --version
npm pkg set scripts.insomnia:test="inso run test --src insomnia/quini-api.insomnia.yaml --env Local"
```

**Aceptación**: desde Insomnia obtienes token con el helper OAuth2 y llamas a `/auth/me` y `/jornadas` sin pegar el token a mano; con el entorno `Local-user`, `POST /jornadas` devuelve 403. La colección está en el repo.

**Qué aprendes**: helper OAuth2 de un cliente REST, variables de entorno y herencia de auth, por qué versionar la colección.

---

### F10 — Módulo Temporadas _(Q6)_ (≈ 2–3 h)

**Objetivo**: la entidad que da contexto a las jornadas, con una sola activa garantizada por la BD.

Esquema: tabla `temporadas` (§7) con el **índice único parcial** `WHERE activa`, el `CHECK` del formato de `codigo` y el `CHECK` de fechas.

| Fichero                    | Responsabilidad                                                                                   | Detalle crítico                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `temporadas.schemas.ts`    | `codigo` con regex `^\d{4}-\d{2}$`; fechas ISO; `fechaFin > fechaInicio` con `refine`             | El `codigo` es inmutable tras crearse: no aparece en el esquema de update                                                                                                |
| `temporadas.repository.ts` | CRUD + `findActiva()` + `activar(codigo, tx)`                                                     | `activar` en **una transacción**: primero `UPDATE ... SET activa = false WHERE activa`, después activar la nueva. Al revés, el índice único parcial rechaza la operación |
| `temporadas.service.ts`    | `resolveTemporada(codigo?)`: devuelve la del código o la activa; **404 si no hay ninguna activa** | Esta función la usará **todo** el módulo de jornadas: un solo sitio donde vive la regla                                                                                  |
| `temporadas.controller.ts` | CRUD + `POST /{codigo}/activar`                                                                   | `DELETE` con jornadas → **409** (por el `RESTRICT`)                                                                                                                      |
| `temporadas.routes.ts`     | Lectura: cualquier autenticado. Escritura: `requireRole('admin')`                                 |                                                                                                                                                                          |

**Matriz de aceptación**:

| #   | Caso                                   | Esperado                               |
| --- | -------------------------------------- | -------------------------------------- |
| 1   | POST temporada válida (admin)          | 201                                    |
| 2   | POST con `codigo` duplicado            | 409                                    |
| 3   | POST con `codigo: "2026/27"`           | 400                                    |
| 4   | POST con `fechaFin < fechaInicio`      | 400                                    |
| 5   | POST como `user`                       | 403                                    |
| 6   | Activar otra temporada                 | 200 y **solo una** con `activa = true` |
| 7   | GET lista (user)                       | 200                                    |
| 8   | DELETE temporada con jornadas          | 409                                    |
| 9   | DELETE temporada vacía (admin)         | 204                                    |
| 10  | Sin temporada activa + `GET /jornadas` | 404 con mensaje claro                  |

**Aceptación**:

```bash
curl -s -X POST http://localhost:3000/api/v1/temporadas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"codigo":"2026-27","nombre":"Temporada 2026/27","fechaInicio":"2026-08-15","fechaFin":"2027-05-30"}' | jq
curl -s -X POST http://localhost:3000/api/v1/temporadas/2026-27/activar -H "Authorization: Bearer $TOKEN" | jq
npm run db:psql -- -c 'select codigo, activa from temporadas;'
```

**Qué aprendes**: índices únicos parciales como regla de negocio en la BD, `RESTRICT` vs `CASCADE`, y centralizar la resolución de contexto en una sola función.

---

### F11 — Módulo Jornadas de punta a punta (≈ 4–6 h)

**Objetivo**: implementar la especificación del prompt (con temporada) y dejarla como **plantilla** para los módulos siguientes.

Esquema: `jornadas` y `partidos` con las restricciones de §7. Genera la migración y **lee el `.sql`**: comprueba que están `UNIQUE (temporada_id, numero_jornada)`, los `CHECK` y el `ON DELETE CASCADE`.

| Fichero                  | Responsabilidad                                                                                                                                        | Detalle crítico                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `jornadas.schemas.ts`    | `PartidoSchema`, `JornadaSchema` (con `temporada`), `CreateJornadaSchema`, `UpdateJornadaSchema` + `refine` de reglas 3 y 4                            | El `refine` de `orden` compara el conjunto con `[1..15]`: detecta duplicados y huecos de una vez |
| `jornadas.repository.ts` | `create` (jornada + 15 partidos **en una transacción**), `findAll(temporadaId)` (orden asc), `findByNumero(temporadaId, n)`, `replace`, `delete`       | Los partidos se devuelven **siempre ordenados por `orden`**                                      |
| `jornadas.service.ts`    | Llama a `resolveTemporada`; traduce violación de `UNIQUE` a `ConflictError`; `replace` = borrar partidos + insertar los 15 **en la misma transacción** | Captura el código `23505` de Postgres y lo convierte en 409                                      |
| `jornadas.controller.ts` | 201 + `Location`; 200; 204 sin cuerpo                                                                                                                  | `Location: /api/v1/jornadas/{numeroJornada}` (con `?temporada=` si no es la activa)              |
| `jornadas.routes.ts`     | `requireAuth` en lectura; `requireRole('admin')` en escritura _(Q4)_; `validate`; registro OpenAPI                                                     | `numeroJornada` de la ruta validado como entero positivo (`"abc"` → 400, no 500)                 |

**Matriz de aceptación** (cada fila = un test de integración):

| #   | Caso                                                    | Esperado                                                 |
| --- | ------------------------------------------------------- | -------------------------------------------------------- |
| 1   | POST jornada válida (admin)                             | 201 + `Location` + `id` UUID + `temporada` + 15 partidos |
| 2   | POST mismo `numeroJornada` en la misma temporada        | 409 `CONFLICT`                                           |
| 3   | **POST mismo `numeroJornada` en otra temporada** _(Q6)_ | **201** (no colisiona)                                   |
| 4   | POST con 14 partidos                                    | 400                                                      |
| 5   | POST con 16 partidos                                    | 400                                                      |
| 6   | POST con `orden` duplicado (1,1,3…)                     | 400                                                      |
| 7   | POST con hueco en `orden` (1,2,4…)                      | 400                                                      |
| 8   | POST con `equipoLocal: "  "`                            | 400                                                      |
| 9   | POST con `fecha: "06-09-2026"`                          | 400                                                      |
| 10  | POST con `numeroJornada: 0` o negativo                  | 400                                                      |
| 11  | POST sin token                                          | 401                                                      |
| 12  | **POST con token de `user`** _(Q4)_                     | **403 `FORBIDDEN`**                                      |
| 13  | POST sin temporada activa y sin `temporada` en el body  | 404                                                      |
| 14  | GET lista (user)                                        | 200, solo la temporada activa, ordenada asc              |
| 15  | GET lista `?temporada=2025-26`                          | 200, solo esa temporada                                  |
| 16  | GET existente                                           | 200, partidos ordenados 1..15                            |
| 17  | GET inexistente                                         | 404                                                      |
| 18  | GET con `numeroJornada` no numérico                     | 400                                                      |
| 19  | PUT válido (admin)                                      | 200 con el recurso actualizado                           |
| 20  | PUT como `user`                                         | 403                                                      |
| 21  | PUT inexistente                                         | 404                                                      |
| 22  | PUT con partidos inválidos                              | 400 **y la jornada original intacta** (rollback)         |
| 23  | DELETE existente (admin)                                | 204 sin cuerpo, partidos borrados                        |
| 24  | DELETE como `user`                                      | 403                                                      |
| 25  | DELETE inexistente                                      | 404                                                      |
| 26  | Cualquiera con token expirado                           | 401                                                      |
| 27  | Respuestas cumplen el esquema OpenAPI                   | contract test verde                                      |

El caso **22** separa un CRUD correcto de uno que corrompe datos: si el `PUT` borra los partidos y luego falla al insertar, sin transacción te quedas con una jornada sin partidos.

**Aceptación**:

```bash
curl -i -X POST http://localhost:3000/api/v1/jornadas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d @tests/fixtures/jornada-valida.json
curl -s http://localhost:3000/api/v1/jornadas -H "Authorization: Bearer $TOKEN" | jq
npm test
```

**Qué aprendes**: transacciones, validación en dos capas, mapear errores de BD a códigos HTTP, semántica REST (201+`Location`, 204 sin cuerpo, PUT como reemplazo total), y autorización por rol aplicada a un recurso real.

---

### F12 — Hardening, CI y despliegue en VPS _(Q7)_ (≈ 4–6 h)

Detalle operativo en **§15**. Resumen de la fase:

- **Seguridad de la app**: `helmet` afinado, CORS por lista blanca, `express.json({ limit: '100kb' })`, `express-rate-limit` global y agresivo en `/auth/*` e `/invitaciones/*`, `app.disable('x-powered-by')`, `app.set('trust proxy', 1)` — imprescindible detrás de Caddy, o el rate limit verá siempre la IP del proxy.
- **Robustez**: apagado ordenado, `headersTimeout`/`requestTimeout`, `unhandledRejection` → log + salida controlada.
- **Observabilidad**: log por petición con `requestId`, `userId`, duración y status. Vigila el ratio de 401/403: sus picos delatan problemas de auth o ataques.
- **CI** (`.github/workflows/ci.yml`): `typecheck` → `lint` → `test` → `openapi:generate` → `openapi:lint` → **fallar si `openapi.json` quedó desactualizado** (`git diff --exit-code openapi/openapi.json`). Ese último paso es el que garantiza de verdad que la documentación no se queda atrás.
- **Dockerfile** multi-stage, usuario no root, `HEALTHCHECK`.
- **Deploy** (`.github/workflows/deploy.yml`): build → GHCR → SSH al VPS → migrar → `up -d`.
- **Docs**: `README.md` (arrancar en 5 comandos) y `docs/01`–`docs/07`.

**Aceptación**: CI verde en un PR de prueba; `https://api.tudominio.com/health` responde con certificado válido; un despliegue completo ejecutado y **una restauración de backup probada**.

---

### F13 — Stack de observabilidad (≈ 3–4 h)

**Objetivo**: dashboards y **alertas que te escriben** cuando algo va mal, sin suscripciones. Fundamento y decisiones en **§16**; aquí van los comandos.

> Requisito previo: la instrumentación de la app (`prom-client`, `/metrics`, contadores de auth y de pool) ya está hecha en F2–F11 según la tabla de §16. Esta fase monta **solo el observador**.

Ajusta lo que instalas al VPS que tengas (§16, "Regla por RAM"). Lo que sigue es el escenario de **4 GB**.

**`docker/docker-compose.obs.yml`** — fichero aparte, para poder levantar y tirar la observabilidad sin tocar la app:

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    restart: unless-stopped
    mem_limit: 400m # Q9: ver §15 "Presupuesto de memoria"
    memswap_limit: 400m
    command:
      - --config.file=/etc/prometheus/prometheus.yml
      - --storage.tsdb.retention.time=30d
      - --storage.tsdb.retention.size=2GB
      - --web.enable-lifecycle
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - promdata:/prometheus
    # SIN ports: solo red interna

  grafana:
    image: grafana/grafana-oss:latest
    restart: unless-stopped
    mem_limit: 256m
    memswap_limit: 256m
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_SERVER_ROOT_URL: https://grafana.tudominio.com
      GF_ANALYTICS_REPORTING_ENABLED: "false"
    volumes:
      - grafanadata:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning:ro
    depends_on: [prometheus]
    # SIN ports: lo publica Caddy

  postgres_exporter:
    image: quay.io/prometheuscommunity/postgres-exporter:latest
    restart: unless-stopped
    mem_limit: 64m
    environment:
      DATA_SOURCE_NAME: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?sslmode=disable
    depends_on: [postgres]

  node_exporter:
    image: prom/node-exporter:latest
    restart: unless-stopped
    mem_limit: 64m
    command:
      - --path.rootfs=/host
    pid: host
    volumes:
      - /:/host:ro,rslave

volumes:
  promdata:
  grafanadata:
```

**`docker/prometheus.yml`**:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: quini-api
    metrics_path: /metrics
    static_configs:
      - targets: ["api:3000"]

  - job_name: postgres
    static_configs:
      - targets: ["postgres_exporter:9187"]

  - job_name: node
    static_configs:
      - targets: ["node_exporter:9100"]

  - job_name: prometheus
    static_configs:
      - targets: ["localhost:9090"]
```

**Añade Grafana al `Caddyfile`** (subdominio aparte, con su propio DNS):

```
grafana.tudominio.com {
    reverse_proxy grafana:3000
}
```

Grafana ya trae su propio login; no le pongas basic auth de Caddy encima o la API interna del navegador se pelea con el diálogo del navegador.

**Arranque**:

```bash
# en el VPS
cd ~/quini-api
# añade GRAFANA_ADMIN_PASSWORD al .env.prod (32 bytes aleatorios)

docker compose -f docker-compose.prod.yml -f docker-compose.obs.yml up -d

# ¿Prometheus ve los tres objetivos como "up"?
docker compose -f docker-compose.prod.yml -f docker-compose.obs.yml \
  exec prometheus wget -qO- 'http://localhost:9090/api/v1/targets?state=active' | head -c 2000

# ¿la API expone métricas y NO están publicadas al exterior?
docker compose -f docker-compose.prod.yml exec api wget -qO- http://localhost:3000/metrics | head -30
curl -i https://api.tudominio.com/metrics    # DEBE dar 404
```

**Configuración en Grafana** (interfaz web, `https://grafana.tudominio.com`):

1. _Connections_ → _Data sources_ → Prometheus → URL `http://prometheus:9090` → _Save & test_.
2. _Dashboards_ → _Import_ → por ID desde grafana.com: **Node Exporter Full** (`1860`) y un dashboard de **PostgreSQL** para `postgres_exporter` (`9628` es el habitual). Verifica el ID en grafana.com/dashboards antes de importar; cambian con el tiempo.
3. Dashboard propio de la API con 6 paneles: peticiones/s por status, p95 de latencia por ruta, tasa de 5xx, 401 vs 403, intentos de login por resultado, y `db_pool_waiting`.
4. _Alerting_ → _Contact points_ → Telegram (crea un bot con @BotFather, es gratis) o email SMTP → _Notification policies_.
5. Crea las alertas de la tabla de §16. Empieza por **tres**: API caída, tasa de 5xx y reuso de refresh token. Añadir veinte alertas el primer día garantiza que las silencies todas la primera semana.

**Uptime Kuma, FUERA del VPS** (en una Raspberry, otro VPS o tu NAS):

```bash
docker run -d --restart=always -p 3001:3001 \
  -v uptime-kuma:/app/data --name uptime-kuma louislam/uptime-kuma:1
```

Monitores a crear: `https://api.tudominio.com/health/ready` cada 60 s, `https://api.tudominio.com` con **aviso de caducidad de certificado** a 15 días, y `https://grafana.tudominio.com`. Notificaciones a Telegram.

**Guarda como código** lo que configures a mano: exporta el dashboard a `docker/grafana/provisioning/dashboards/quini-api.json` y commitéalo. Si el VPS muere, tus dashboards no se van con él.

**Aceptación**:

- Los tres objetivos de Prometheus en `up == 1`.
- `curl https://api.tudominio.com/metrics` → **404** (no expuesto).
- Un dashboard con latencia p95 real de la API.
- **Prueba de fuego de la alerta**: para el contenedor de la API (`docker compose stop api`), comprueba que te llega el aviso a Telegram, y vuelve a arrancarlo. Una alerta que nunca se ha disparado en una prueba es una alerta que no sabes si funciona.
- Uptime Kuma **en otra máquina** avisando.

**Qué aprendes**: los tres pilares (métricas, trazas, logs) y qué pregunta responde cada uno; el modelo de datos de Prometheus (series, labels, cardinalidad); PromQL básico (`rate`, `histogram_quantile`, `increase`); por qué un histograma no es un promedio; y la diferencia entre monitorizar _desde dentro_ y _desde fuera_.

---

### F14 — Automatización: skill `/quini-api-new` (≈ 2–3 h) _(D26)_

**Objetivo**: convertir el trabajo mecánico de "añadir un recurso a la API" en un comando, sin delegar las decisiones de diseño.

#### Requisito duro: esta fase va después de F11

Una skill que genera código "siguiendo los patrones del proyecto" necesita que los patrones **existan y estén probados**. Si la escribes ahora, codifica la propuesta de este documento, que es una hipótesis: en cuanto tu código real difiera (y lo hará, en detalles de Drizzle, de Zod y de los helpers de test), cada divergencia se convierte en código generado que corriges a mano **en cada uso**. Una skill desalineada con el repo es peor que no tenerla, porque parece que funciona.

El plan ya dice que `jornadas` es la plantilla de referencia (F11). F14 es, literalmente, "convertir esa plantilla en ejecutable".

#### La tensión con tu objetivo de aprender, dicha en voz alta

Pediste construir esto a mano porque quieres entender y controlar la aplicación. Una skill que genera módulos completos desde una especificación va justo en la dirección contraria… **si la escribes antes de haber hecho uno a mano**. Escrita después, es lo contrario: te obliga a explicitar lo que aprendiste (por qué hay transacción, por qué el 403 va en el router, por qué las migraciones se leen antes de aplicar) y lo deja escrito para tu yo de dentro de seis meses.

Por eso la skill genera **andamiaje + tests + checklist**, no reglas de negocio. La lógica de dominio la sigues escribiendo tú.

#### Qué debe hacer, y qué NO

| Paso            | La skill hace                                                                                                                             | Cuidado                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Plan         | Lee la spec y escribe `docs/specs/NN-<recurso>.plan.md`: ficheros a crear, orden, decisiones detectadas                                   | Revisable en dos minutos antes de que toque código                                                                                                           |
| 2. Esquema      | `src/db/schema/<recurso>.ts` con `UNIQUE`, `CHECK` y `CASCADE`/`RESTRICT`                                                                 | **No escribe SQL a mano**: ejecuta `drizzle-kit generate` y te obliga a **leer** el `.sql` antes de aplicar                                                  |
| 3. Zod          | `<recurso>.schemas.ts` con las anotaciones OpenAPI                                                                                        | **No escribe documentación aparte.** La doc se genera desde Zod (D4); si la skill produjera un `.md` de endpoints tendrías dos fuentes de verdad divergiendo |
| 4. Capas        | `routes` / `controller` / `service` / `repository` con el patrón de `jornadas`                                                            | Si la spec no define el comportamiento transaccional, deja un `TODO` explícito en lugar de inventarlo                                                        |
| 5. Registro     | La línea en `routes.ts` y el registro en el registry de OpenAPI                                                                           | **Es el olvido nº 1** al copiar un módulo a mano: el código existe y la ruta no responde                                                                     |
| 6. Tests        | Instancia las matrices reutilizables: los 7 casos de auth (§13), los de validación de la spec, el **403 por rol** (Q4) y el contract test | **Aquí está el 80 % del valor.** Son mecánicos, repetitivos, y siempre se olvida alguno                                                                      |
| 7. Verificación | `typecheck` → `lint` → `test` → `openapi:generate` → `openapi:lint`                                                                       | Si algo falla, **para y lo reporta**. Nunca relaja un test para que pase                                                                                     |
| 8. Métricas     | Contador de negocio del recurso (§16)                                                                                                     |                                                                                                                                                              |
| 9. Insomnia     | Te recuerda regenerar la colección                                                                                                        | Manual: la importación de Insomnia no es idempotente de forma fiable                                                                                         |

**Prohibiciones explícitas** (van en la propia skill): no inventar reglas de negocio ausentes en la spec — pregunta; no modificar módulos existentes; no tocar migraciones ya aplicadas; no relajar aserciones para que los tests pasen.

#### La plantilla de especificación vale más que la skill

Esto es lo importante: la calidad del resultado la determina la especificación, no el generador. **Una spec ambigua produce un módulo ambiguo, con skill o sin ella.** Y la buena noticia es que la spec de jornadas del prompt ya tiene casi la forma correcta; le faltan tres cosas que salieron de las decisiones de §0.

**Ya está creada**: [`docs/specs/_plantilla.md`](specs/_plantilla.md). Se usa así:

```bash
cp docs/specs/_plantilla.md docs/specs/02-apuestas.md
```

Trae _frontmatter_ YAML (para que la skill de F14 pueda leerla como dato), bloques `<!-- guía -->` que se borran al rellenar, un **checklist de 13 puntos** para saber si está completa, y una tabla final de trazabilidad _apartado → artefacto generado_: si alguna fila de esa tabla no se puede derivar de la spec, falta información y no se escribe código todavía.

Sus 10 apartados:

1. **Alcance** — qué cubre este recurso
2. **Ubicación en el dominio** — ¿cuelga de `temporada`? ¿de `jornada`? ¿es independiente? _(nuevo, por Q6)_
3. **Modelo de datos** — campos, tipos, obligatoriedad, unicidad, borrado en cascada o restringido
4. **Reglas de validación numeradas** — numeradas porque cada número se convierte en un test
5. **Autorización endpoint por endpoint** — qué rol hace falta _(nuevo, por Q4)_
6. **Endpoints** — método, ruta, request y **todas** las respuestas con su código
7. **Errores propios** del recurso, más allá del catálogo de §10
8. **Métricas de negocio** a emitir _(nuevo, por §16)_
9. **Casos límite** conocidos y qué se decidió en cada uno
10. **Fuera de alcance**

Regla de oro: **si la spec no dice qué código HTTP devuelve un caso, la skill pregunta; no adivina.**

#### Aceptación de F14

La única prueba honesta: **la skill regenera el módulo `jornadas` desde la spec del prompt y el resultado pasa los 27 casos de la matriz de F11**. Si no es capaz de reproducir el módulo que le sirvió de patrón, no está lista para escribir el siguiente.

#### Por qué una skill y no tres

`update` y `delete` no son variantes de `new`; son problemas distintos:

- **`/quini-api-update`**: lo difícil no es el andamiaje, es la **compatibilidad**. Migración aditiva (columna nueva nullable antes de dejar de usar la vieja), `deprecated: true` en OpenAPI, y decidir si el cambio rompe el contrato y exige `/api/v2`. Es un problema de gestión de versiones.
- **`/quini-api-delete`**: nunca es "borrar". Es **deprecar → avisar → esperar N releases → eliminar código → y solo entonces** la migración destructiva que borra columnas, con backup verificado inmediatamente antes. Esa última parte **no debe automatizarse**: debe ser un checklist con confirmación humana explícita, porque un `DROP COLUMN` no tiene vuelta atrás.

Escríbelas cuando hayas usado `new` dos o tres veces y sepas qué se repite de verdad. Tres skills escritas antes de usar ninguna es abstracción prematura.

#### Antes de escribirla, mira lo que ya tienes

Tu entorno ya trae un flujo SDD completo (`/sdd-new`, `/sdd-spec`, `/sdd-design`, `/sdd-tasks`, `/sdd-apply`, `/sdd-verify`) y OpenSpec, que cubren la parte genérica de "de idea a tareas verificadas". Lo que **no** saben es lo específico de este proyecto: los cinco ficheros por módulo, el ciclo Zod→OpenAPI, el bucle `generate`/`migrate` de Drizzle y las matrices de test.

Dos caminos, y conviene elegir uno a conciencia para no mantener dos cosas que hacen lo mismo:

- **Skill autónoma**: `/quini-api-new` hace todo el ciclo. Más simple de usar, y tú mantienes una sola pieza.
- **Skill delgada + SDD**: el flujo SDD lleva spec/design/tasks, y `/quini-api-new` se ocupa solo del andamiaje y los tests. Menos duplicación, más piezas que coordinar.

Mi recomendación: **skill autónoma**, porque el ciclo aquí es muy estructurado y repetitivo y el flujo SDD brilla más cuando hay ambigüedad de diseño que resolver.

---

## 15. Despliegue en VPS _(Q7)_

### Topología

```mermaid
flowchart LR
    I[Internet] -->|443 TLS| CA["Caddy<br/>HTTPS automático"]
    CA -->|red interna| API["quini-api<br/>Node 26 (Docker)"]
    API -->|red interna| PG[("PostgreSQL 18<br/>SIN puerto publicado")]
    B["cron: pg_dump"] --> PG
    B --> S["backups/ + copia fuera del VPS"]
```

**Regla crítica**: en producción, el servicio de Postgres **no lleva sección `ports`**. Solo la red interna de Docker. Publicar el 5432 en un VPS con contraseña débil es la forma más rápida de que te cifren la base de datos.

### Preparación del servidor (Ubuntu 24.04, una sola vez)

```bash
ssh root@TU_IP

adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# SSH: solo clave, sin root
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/;s/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# Firewall: solo SSH y HTTP/S
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable

apt update && apt upgrade -y
apt install -y ca-certificates curl gnupg fail2ban unattended-upgrades
systemctl enable --now fail2ban
dpkg-reconfigure -plow unattended-upgrades

# Docker (repositorio oficial)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  > /etc/apt/sources.list.d/docker.list
apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker deploy
```

Comprobación:

```bash
ssh deploy@TU_IP 'docker run --rm hello-world && ufw status verbose'
```

### Presupuesto de memoria en un VPS de 4 GB _(Q9)_

Con el stack completo son **siete contenedores** compartiendo 4 GB. Repartir la memoria a mano no es opcional: por defecto, cada contenedor puede consumir toda la RAM de la máquina, y el que la pide (Prometheus, indexando series) no es el que te importa (Postgres, con tus datos). Sin límites, el OOM killer del kernel elige por ti, y elige mal.

| Servicio                  | Uso típico       | `mem_limit` propuesto   | Nota                                                        |
| ------------------------- | ---------------- | ----------------------- | ----------------------------------------------------------- |
| `postgres`                | 250–400 MB       | **1,2 GB**              | Holgado a propósito: es lo último que quieres que muera     |
| `api` (Node)              | 120–200 MB       | **512 MB**              | Si lo supera de forma sostenida, hay una fuga               |
| `caddy`                   | 20–40 MB         | **128 MB**              |                                                             |
| `prometheus`              | 150–300 MB       | **400 MB**              | Crece con el número de series (cardinalidad)                |
| `grafana`                 | 100–180 MB       | **256 MB**              | Usa SQLite internamente: **no** necesita su propia Postgres |
| `postgres_exporter`       | ~20 MB           | **64 MB**               |                                                             |
| `node_exporter`           | ~20 MB           | **64 MB**               |                                                             |
| Sistema (Ubuntu + Docker) | 300–400 MB       | —                       |                                                             |
| **Uso real esperado**     | **≈ 1,3–1,6 GB** | (límites suman ~2,6 GB) |                                                             |

**Los límites son techos, no reservas.** Sumar 2,6 GB de límites en una máquina de 4 GB es correcto: nadie los alcanza a la vez. Lo que queda libre (~2,4 GB) no se desperdicia — el kernel lo usa como **caché de disco**, y eso es precisamente lo que hace rápido a Postgres. Un VPS con toda la RAM "asignada" y nada para caché rinde peor que uno holgado.

Añade a cada servicio de `docker-compose.prod.yml` y `docker-compose.obs.yml`:

```yaml
mem_limit: 400m # el valor de la tabla
memswap_limit: 400m # igual que mem_limit: prohíbe que el contenedor use swap
```

**Red de seguridad: swap en el host** (no para que los contenedores lo usen, sino para que el kernel tenga margen antes de matar procesos):

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf && sudo sysctl --system
free -h
```

`swappiness=10` significa "usa swap solo si de verdad hace falta". El valor por defecto (60) haría que Postgres acabe en disco teniendo RAM libre, y eso se nota muchísimo.

**Ajuste de Postgres para 4 GB compartidos.** Los valores por defecto de Postgres son conservadores (`shared_buffers` = 128 MB), y la receta habitual de "25 % de la RAM" asume un servidor **dedicado**. Aquí no lo es, así que se queda en 512 MB. Añade al servicio `postgres` del compose de producción:

```yaml
command: >
  postgres
  -c shared_buffers=512MB
  -c effective_cache_size=1536MB
  -c maintenance_work_mem=128MB
  -c work_mem=8MB
  -c max_connections=50
  -c random_page_cost=1.1
  -c effective_io_concurrency=200
  -c checkpoint_completion_target=0.9
  -c max_wal_size=1GB
  -c wal_compression=on
  -c log_min_duration_statement=500ms
```

Qué hace cada cosa que importa:

- **`effective_cache_size`** no reserva nada: le dice al planificador cuánta caché de disco _cree_ que hay disponible, y con ello decide entre índice y escaneo secuencial. Dejarlo por defecto provoca planes malos aunque tengas RAM de sobra.
- **`random_page_cost=1.1`** y **`effective_io_concurrency=200`** son para SSD/NVMe (el valor por defecto asume disco mecánico y desincentiva los índices).
- **`max_connections=50`** con `work_mem=8MB` acota el peor caso de memoria por consulta. El **pool de Node debe ser `max: 10`**, no 100: un solo proceso Node no aprovecha más, y el error clásico es poner un pool enorme que agota las conexiones del servidor sin ganar nada.
- **`log_min_duration_statement=500ms`** te regala un registro de consultas lentas gratis, que complementa las métricas de §16.

Los `-c` del `command` solo se aplican a partir del siguiente reinicio del contenedor:

```bash
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U quiniela -d quiniela -c 'show shared_buffers; show effective_cache_size;'
```

**Consumo de disco de Prometheus** (para que no te sorprenda): con ~1.000 series y un _scrape_ cada 15 s son ~5.760 muestras por serie y día; a ~2 bytes comprimidos por muestra salen **unos 10 MB/día**, es decir ~350 MB en los 30 días de retención. Los topes `--storage.tsdb.retention.time=30d` y `--storage.tsdb.retention.size=2GB` que ya están en F13 hacen de doble freno: si la cardinalidad se te descontrola, el tope por tamaño evita que llene el disco (y la alerta de disco > 80 % te avisa antes).

### `docker/docker-compose.prod.yml`

```yaml
services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    mem_limit: 1200m # Q9: ver "Presupuesto de memoria"
    memswap_limit: 1200m
    command: > # ajuste para 4 GB compartidos
      postgres
      -c shared_buffers=512MB
      -c effective_cache_size=1536MB
      -c maintenance_work_mem=128MB
      -c work_mem=8MB
      -c max_connections=50
      -c random_page_cost=1.1
      -c effective_io_concurrency=200
      -c checkpoint_completion_target=0.9
      -c max_wal_size=1GB
      -c wal_compression=on
      -c log_min_duration_statement=500ms
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
      TZ: UTC
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      retries: 5
    # SIN ports: solo accesible desde la red interna

  api:
    image: ghcr.io/TU_USUARIO/quini-api:${TAG:-latest}
    restart: unless-stopped
    mem_limit: 512m
    memswap_limit: 512m
    env_file: .env.prod
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test:
        [
          "CMD",
          "node",
          "-e",
          "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))",
        ]
      interval: 30s
      timeout: 5s
      retries: 3
    # SIN ports: Caddy es el único que le habla

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    mem_limit: 128m
    memswap_limit: 128m
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - api

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

### `docker/Caddyfile`

```
api.tudominio.com {
    encode zstd gzip
    log {
        output file /data/access.log
    }

    # Documentación solo desde tu IP (opcional pero recomendable)
    @docs path /docs* /openapi.json
    handle @docs {
        @noAutorizado not remote_ip TU_IP_FIJA
        respond @noAutorizado 404
        reverse_proxy api:3000
    }

    reverse_proxy api:3000 {
        health_uri /health
    }
}
```

Caddy pide y renueva el certificado de Let's Encrypt solo, siempre que el DNS apunte al VPS y los puertos 80/443 estén abiertos. Sin certbot ni cron.

### `Dockerfile` (multi-stage)

Etapas: `deps` (`npm ci`) → `build` (`npm run build`) → `runtime` (`npm ci --omit=dev`, copia `dist/` y `drizzle/`, usuario no root `node`, `CMD ["node","dist/src/server.js"]`). El **directorio `drizzle/` debe ir en la imagen**: es lo que aplica las migraciones en el VPS.

### Variables de producción (`.env.prod` en el VPS, permisos 600)

Diferencias respecto a desarrollo, todas importantes:

```dotenv
NODE_ENV=production
DB_MODE=docker
DATABASE_URL=postgresql://quiniela:PASS_LARGA@postgres:5432/quiniela   # host = nombre del servicio
API_BASE_URL=https://api.tudominio.com
PUBLIC_APP_URL=https://app.tudominio.com
CORS_ORIGINS=https://app.tudominio.com
GOOGLE_REDIRECT_URI=https://api.tudominio.com/api/v1/auth/google/callback
JWT_ALG=RS256                    # D9
LOG_LEVEL=info
ENABLE_DEV_TOKENS=false          # crítico
```

Checklist antes del primer arranque:

- [ ] `ENABLE_DEV_TOKENS=false` (y comprobar que `POST /dev/token` da 404)
- [ ] Secretos **distintos** a los de desarrollo, generados con `randomBytes(32)`
- [ ] `GOOGLE_REDIRECT_URI` de producción **añadido en Google Cloud Console** (si no, el login falla con `redirect_uri_mismatch`)
- [ ] `chmod 600 .env.prod`

### Primer despliegue

```bash
ssh deploy@TU_IP
mkdir -p ~/quini-api && cd ~/quini-api
# sube docker-compose.prod.yml, Caddyfile y .env.prod (scp o git clone)

echo $GHCR_TOKEN | docker login ghcr.io -u TU_USUARIO --password-stdin
docker compose -f docker-compose.prod.yml pull

# 1) migrar ANTES de arrancar la app (D22)
docker compose -f docker-compose.prod.yml up -d postgres
docker compose -f docker-compose.prod.yml run --rm api node_modules/drizzle-kit/bin.cjs migrate

# 2) arrancar
docker compose -f docker-compose.prod.yml up -d

# 3) primer admin (Q2: no hay registro abierto)
docker compose -f docker-compose.prod.yml exec api node dist/scripts/create-admin.js --email=tu@email.com

# 4) verificar
curl -i https://api.tudominio.com/health
curl -i https://api.tudominio.com/health/ready
docker compose -f docker-compose.prod.yml logs -f api
```

### Despliegues sucesivos (`.github/workflows/deploy.yml`)

Disparado por tag `v*` o manualmente:

1. `docker build` + push a `ghcr.io/TU_USUARIO/quini-api:${{ github.sha }}` y `:latest`.
2. SSH al VPS (clave en `secrets.SSH_PRIVATE_KEY`) y ejecutar:
   ```bash
   cd ~/quini-api
   export TAG=${{ github.sha }}
   docker compose -f docker-compose.prod.yml pull api
   docker compose -f docker-compose.prod.yml run --rm api node_modules/drizzle-kit/bin.cjs migrate
   docker compose -f docker-compose.prod.yml up -d api
   docker image prune -f
   ```
3. Comprobación post-deploy: `curl -fsS https://api.tudominio.com/health/ready` y **fallar el workflow si no responde**.

**Usa el SHA como tag, no solo `latest`**: con `latest` no puedes volver atrás. Rollback = `TAG=<sha_anterior> docker compose up -d api`, siempre que la migración sea compatible hacia atrás — motivo para preferir migraciones aditivas (añadir columna nullable antes de dejar de usar la vieja).

### Backups (`scripts/backup.sh` + cron)

```bash
# en el VPS, cron diario a las 03:15
15 3 * * * cd /home/deploy/quini-api && ./backup.sh >> backup.log 2>&1
```

El script hace `docker compose exec -T postgres pg_dump -U ... -Fc` a `backups/quiniela-$(date +%F).dump`, borra los de más de 14 días y **copia el último fuera del VPS** (S3/B2/rsync). Un backup que vive solo en la máquina que puede morir no es un backup.

**Prueba de restauración** (hazla el día 1, no el día del desastre):

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore -U quiniela -d quiniela_restore_test --clean --if-exists < backups/quiniela-2026-08-06.dump
```

### Operación diaria

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f --tail=100 api
docker compose -f docker-compose.prod.yml exec postgres psql -U quiniela -d quiniela
docker compose -f docker-compose.prod.yml restart api
docker stats --no-stream
```

Monitorización mínima: un chequeo externo (UptimeRobot, Healthchecks.io o similar) contra `/health/ready` que avise si cae. Sin esto te enteras cuando alguien de la peña te escriba.

---

## 16. Observabilidad

### Por qué pino no basta

El log estructurado responde muy bien a **una** pregunta: _"¿qué pasó exactamente en esta petición?"_. No responde a estas otras, que son las que te van a doler:

- ¿La API va más lenta que la semana pasada? ¿Desde qué despliegue?
- ¿Cuántos 401 por minuto hay ahora mismo? ¿Es un usuario despistado o alguien probando contraseñas?
- ¿Se está agotando el pool de conexiones a Postgres?
- ¿Se ha llenado el disco del VPS? (Causa nº1 de caída en VPS pequeños: Postgres y los logs crecen hasta que no cabe nada.)
- ¿Está caída la API **ahora**, un domingo a las 19:00, cuando la peña rellena la quiniela?

Los tres tipos de señal, y qué pregunta responde cada uno:

| Señal        | Responde                                                     | Coste                               | En este proyecto             |
| ------------ | ------------------------------------------------------------ | ----------------------------------- | ---------------------------- |
| **Métricas** | _¿cuánto, cuándo, va a peor?_ Números agregados en el tiempo | Muy bajo                            | **Sí, desde F2**             |
| **Logs**     | _¿por qué falló esta petición concreta?_                     | Bajo (ya lo tienes con pino)        | Ya en el plan                |
| **Trazas**   | _¿dónde se va el tiempo dentro de una petición?_             | Alto (CPU, memoria, un backend más) | **Preparado, apagado** (D24) |

Las alertas no son un cuarto pilar: son lo que convierte cualquiera de los tres en algo útil. **Un dashboard que nadie mira no es observabilidad, es decoración.**

### Escala: lo que NO vamos a montar

Con ~10–30 usuarios y un VPS, la respuesta correcta no es un stack de 10 contenedores. Sentry autoalojado pide del orden de 8 GB de RAM y una docena de servicios; SigNoz arrastra ClickHouse. Montar eso aquí significa que la observabilidad tira la máquina que vigila — que es una forma bastante irónica de caerse.

| Herramienta                   | Señal                                   | Licencia              | RAM aprox.              | Veredicto                                    |
| ----------------------------- | --------------------------------------- | --------------------- | ----------------------- | -------------------------------------------- |
| **`prom-client`** (en la API) | métricas                                | Apache-2.0            | ~0 (en proceso)         | **Sí, desde F2**                             |
| **Prometheus**                | almacén de métricas                     | Apache-2.0            | 150–300 MB              | **Sí, F13**                                  |
| **Grafana OSS**               | dashboards + **alertas**                | AGPL-3.0              | 100–200 MB              | **Sí, F13**                                  |
| **Uptime Kuma**               | disponibilidad desde fuera              | MIT                   | 80–150 MB               | **Sí, pero fuera del VPS**                   |
| `postgres_exporter`           | métricas de Postgres                    | Apache-2.0            | ~30 MB                  | Sí, es barato                                |
| `node_exporter`               | CPU, RAM, **disco** del host            | Apache-2.0            | ~30 MB                  | Sí, es barato                                |
| cAdvisor                      | métricas por contenedor                 | Apache-2.0            | 80–150 MB               | Opcional                                     |
| Netdata                       | host + contenedores, cero configuración | GPL-3.0               | 100–200 MB              | Alternativa si no quieres tocar Prometheus   |
| OpenTelemetry SDK             | trazas                                  | Apache-2.0            | +30–80 MB en el proceso | Cuando haga falta (D24)                      |
| Grafana Tempo / Jaeger        | almacén de trazas                       | AGPL-3.0 / Apache-2.0 | 150–250 MB              | Con las trazas                               |
| Loki + Alloy                  | logs agregados y buscables              | AGPL-3.0              | 150–300 MB              | Cuando `docker logs` moleste                 |
| GlitchTip                     | errores agrupados (SDK de Sentry)       | verificar licencia    | 400–800 MB + su BD      | Solo si quieres stack traces agrupados (D25) |
| Sentry / SigNoz autoalojados  | todo en uno                             | Apache / BSL          | **4–8 GB**              | **No** en este VPS                           |

Todas las elegidas son open source y **sin cuenta ni suscripción**: se ejecutan en tu máquina y los datos no salen de ahí.

**Regla por RAM del VPS** (la API en Node ronda 120–200 MB y Postgres 150–300 MB, así que parte de ~500 MB ya ocupados):

| RAM del VPS              | Qué montar                                                                                                                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **2 GB**                 | Solo `prom-client` + `/metrics` + **Uptime Kuma externo**. Si quieres ver el host, Netdata (un contenedor). Nada de Prometheus + Grafana: te quedas sin memoria y el OOM killer se lleva Postgres |
| **← 4 GB (tu caso, Q9)** | El escenario de F13: `prom-client` + Prometheus + Grafana + `postgres_exporter` + `node_exporter`. **Punto dulce**. Reparto de memoria en §15                                                     |
| **8 GB o más**           | Añade Tempo (trazas) y Loki (logs). Stack completo                                                                                                                                                |

**Lo que NO cabe en 4 GB, y qué hacer en su lugar**: Loki (~200 MB) y Tempo (~200 MB) juntos se comen el margen que Postgres necesita como caché de disco. Alternativas:

- **Logs**: `docker compose logs --tail=200 api | grep` aguanta mucho más de lo que parece con 30 usuarios. Loki se justifica cuando tengas varios servicios, no uno.
- **Trazas a demanda**: cuando necesites investigar algo lento, levanta un Jaeger todo-en-uno **temporal** con almacenamiento en memoria, pon `OTEL_ENABLED=true`, reproduce el problema, saca la conclusión y apaga las dos cosas. Observabilidad de usar y tirar: te da la respuesta sin pagar 200 MB permanentes.
  ```bash
  docker run -d --rm --name jaeger --network quini-api_default \
    -e COLLECTOR_OTLP_ENABLED=true -p 16686:16686 jaegertracing/all-in-one:latest
  # OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318 · UI por túnel SSH, no la publiques
  ```

### Qué medir (más importante que con qué)

Las cuatro _golden signals_ aplicadas a esta API, más las métricas de negocio y **de seguridad**, que son las que de verdad justifican el esfuerzo aquí:

| Métrica                                      | Tipo            | Para qué sirve                                                                                             |
| -------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------- |
| `http_requests_total{method,route,status}`   | counter         | Tasa de tráfico y de error. `route` = **plantilla**, no URL                                                |
| `http_request_duration_seconds{route}`       | histogram       | p50 / p95 / p99 por endpoint                                                                               |
| `http_requests_in_flight`                    | gauge           | Saturación: peticiones simultáneas                                                                         |
| `auth_login_attempts_total{result}`          | counter         | Un pico de `result="fail"` es ataque o bug, y quieres saber cuál                                           |
| `auth_refresh_reuse_detected_total`          | counter         | **La métrica de seguridad del proyecto**: >0 significa posible robo de token (§8). Merece alerta inmediata |
| `auth_tokens_issued_total{grant}`            | counter         | Reparto entre `password`, `refresh_token` y `google`                                                       |
| `invitations_validated_total{result}`        | counter         | Fuerza bruta contra tokens de invitación en el endpoint público                                            |
| `db_pool_connections{state}`                 | gauge           | `state="waiting"` sostenido > 0 = pool pequeño o consultas lentas                                          |
| `db_query_duration_seconds`                  | histogram       | La consulta lenta antes de que se note                                                                     |
| `jornadas_created_total`, `usuarios_activos` | counter / gauge | Uso real del producto                                                                                      |
| `collectDefaultMetrics()` de `prom-client`   | varias          | Retraso del event loop, heap, GC, descriptores de fichero                                                  |

El **retraso del event loop** (`nodejs_eventloop_lag_seconds`) merece mención aparte: es _la_ métrica de un proceso Node. Si sube, algo está bloqueando el hilo único y **todas** las peticiones se degradan a la vez. Argon2 en cada login es precisamente el tipo de trabajo que lo mueve — y por eso interesa medirlo desde F4.

#### Trampa nº1: cardinalidad

Nunca uses la URL cruda como _label_:

```
❌ http_requests_total{path="/api/v1/jornadas/7"}   → una serie temporal nueva por cada jornada
✅ http_requests_total{route="/jornadas/:numeroJornada"}
```

Cada combinación distinta de labels es una serie que Prometheus guarda en memoria. Con `userId`, `email` o el token como label, la memoria crece sin techo hasta que Prometheus muere. **Regla: un label solo si su número de valores posibles es pequeño y acotado.** En Express, usa la plantilla de la ruta (`req.route?.path`), y ten cuidado con el 404: sin ruta que casar no hay plantilla, así que etiqueta esas peticiones como `route="unmatched"` en lugar de dejar la URL cruda — si no, cualquier escaneo automático te llena Prometheus de series basura.

#### Trampa nº2: `/metrics` es información sensible

Revela tus rutas, tu volumen de tráfico, versiones y comportamiento interno. **No lo publiques**: en el compose no lleva `ports`, Prometheus lo alcanza por la red interna de Docker, y Caddy no lo enruta. Igual que `/docs` (§15). En el checklist hay un `curl` que lo verifica.

### Alertas mínimas

Grafana OSS incluye _unified alerting_ con puntos de contacto a **Telegram, email o webhook**, gratis y sin servicios externos. Un bot de Telegram se crea en dos minutos con @BotFather y va al móvil, que es donde te tiene que llegar.

| Alerta                     | Condición                                                | Por qué importa                                   |
| -------------------------- | -------------------------------------------------------- | ------------------------------------------------- |
| API caída                  | `up == 0` durante 1 min                                  | Lo básico                                         |
| Readiness fallando         | `/health/ready` ≠ 200                                    | El proceso vive pero la BD no responde            |
| Tasa de 5xx                | > 1 % durante 5 min                                      | Regresión recién desplegada                       |
| Latencia p95               | > 1 s durante 10 min                                     | Degradación antes de que se queje la peña         |
| **Reuso de refresh token** | `increase(auth_refresh_reuse_detected_total[5m]) > 0`    | Posible robo de credenciales                      |
| Fallos de login            | > 20/min                                                 | Fuerza bruta                                      |
| Pool esperando             | `db_pool_connections{state="waiting"} > 0` durante 5 min | Agotamiento de conexiones                         |
| **Disco**                  | > 80 % usado                                             | La causa nº1 de caída en VPS pequeños             |
| Memoria                    | > 85 % durante 10 min                                    | Preludio del OOM killer                           |
| Certificado TLS            | caduca en < 15 días                                      | Caddy renueva solo, pero quieres saberlo si falla |
| **Backup**                 | sin `.dump` nuevo en 26 h                                | Un backup roto en silencio es peor que no tenerlo |

Empieza con **tres** (API caída, tasa de 5xx, reuso de refresh) y añade el resto cuando cada una te haya avisado de algo real. Veinte alertas el primer día terminan silenciadas la primera semana, y entonces no tienes ninguna.

### Trazas: cuándo sí (D24)

`@opentelemetry/auto-instrumentations-node` instrumenta HTTP, Express y `pg` **sin tocar tu código** (se carga con `--import`). Para una petición lenta te dice: cuánto tiempo en middleware, cuánto en cada consulta SQL, cuánto en la llamada a Google.

Cuándo vale la pena: cuando tengas un _"esto va lento"_ que las métricas localizan (`p95` alto en `PUT /jornadas`) pero no explican. Con 30 usuarios, probablemente no el primer mes.

Lo que **sí** hacemos desde el principio, porque cuesta dos líneas y luego es un dolor: **meter `trace_id` en cada log de pino**. Los tres pilares solo sirven juntos si comparten identificador — de una alerta saltas al log, y del log a la traza. Nuestro `requestId` (§10) cumple ese papel mientras OTel esté apagado; cuando lo enciendas, conviven.

### El monitor tiene que vivir fuera

Un Uptime Kuma en el mismo VPS **no puede avisarte de que el VPS está caído**. Es el error conceptual más común al autoalojar monitorización: el vigilante se muere con el vigilado.

Opciones sin suscripción: una Raspberry Pi en casa, un NAS, otro VPS mínimo, o el plan gratuito de un comprobador externo. **Es la única pieza que obligatoriamente va fuera.** Todo lo demás (Prometheus, Grafana) puede vivir junto a la app.

### Qué se hace en cada fase

Principio: **instrumentar temprano, observar tarde**. La instrumentación es barata y se escribe sola mientras construyes; el stack de observación solo tiene sentido cuando hay producción que observar.

| Fase    | Qué se añade                                                                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F2**  | `prom-client` + `collectDefaultMetrics()` + histograma HTTP + `GET /metrics` (~30 líneas, cero infraestructura). Y `trace_id`/`requestId` en los logs |
| **F3**  | Gauges del pool de `pg` y duración de consultas                                                                                                       |
| **F4**  | `auth_login_attempts_total`, `auth_tokens_issued_total`, **`auth_refresh_reuse_detected_total`**                                                      |
| **F5**  | `invitations_validated_total`                                                                                                                         |
| **F11** | Contadores de negocio (`jornadas_created_total`)                                                                                                      |
| **F12** | Verificar que `/metrics` **no** queda expuesto por Caddy                                                                                              |
| **F13** | Prometheus + Grafana + exporters + dashboards + alertas + Uptime Kuma externo                                                                         |

---

## 17. Roadmap y estimación

| Fase | Contenido                           | Estimación    | Depende de            | Entregable verificable                           |
| ---- | ----------------------------------- | ------------- | --------------------- | ------------------------------------------------ |
| F0   | Prerrequisitos, Google, DNS del VPS | 0,5 h         | —                     | Credenciales y DNS listos                        |
| F1   | Bootstrap repo                      | 1–1,5 h       | F0                    | `typecheck` + `lint` verdes                      |
| F2   | Express + config + errores          | 2–3 h         | F1                    | `/health` y contrato de errores                  |
| F3   | PostgreSQL + Drizzle                | 3–4 h         | F1                    | Migración de `users` aplicada                    |
| F4   | Auth contraseña + roles             | 4–6 h         | F2, F3                | Token → `/auth/me`, primer admin                 |
| F5   | Invitaciones + registro cerrado     | 3–4 h         | F4                    | Invitar → registrar → 410 al reusar              |
| F6   | Google (cerrado por invitación)     | 3–4 h         | F5                    | Login con Gmail; sin invitación → 403            |
| F7   | OpenAPI + `/docs`                   | 2–3 h         | F5                    | `openapi.json` + UI + Spectral                   |
| F8   | Testing                             | 4–5 h         | F6, F7                | `npm test` sin Docker                            |
| F9   | Insomnia                            | 1–2 h         | F7                    | Colección versionada, 403 comprobado             |
| F10  | Temporadas                          | 2–3 h         | F8                    | Una sola activa garantizada                      |
| F11  | Jornadas                            | 4–6 h         | F10                   | 27 casos verdes                                  |
| F12  | Hardening + CI + VPS                | 4–6 h         | F11                   | HTTPS en producción + backup restaurado          |
| F13  | Observabilidad (§16)                | 3–4 h         | F12                   | Dashboards + alerta probada + monitor externo    |
| F14  | Skill `/quini-api-new` (D26)        | 2–3 h         | **F11** (obligatorio) | La skill regenera `jornadas` y pasa sus 27 casos |
|      | **Total**                           | **≈ 39–55 h** |                       |                                                  |

La instrumentación de métricas **no** aparece como fase propia: son ~30 líneas en F2 y unos contadores repartidos por F3–F11 (§16, última tabla). Ese reparto ya está dentro de las estimaciones de cada fase.

**Camino crítico**: F1 → F2 → F3 → F4 → F5 → F8 → F10 → F11 → F12.
F6 (Google), F7 (OpenAPI) y F9 (Insomnia) admiten reordenación. F13 va necesariamente al final: no puedes observar lo que aún no está desplegado. F14 exige F11 terminado: no puedes automatizar un patrón que todavía no existe.

**Si quieres ver algo funcionando cuanto antes** (medio día): F1 → F2 → F3 → F4 mínimo (solo password grant, sin refresh) → F10 → F11. Luego añades invitaciones, Google, OpenAPI e Insomnia. Riesgo: la validación con Zod es tan central que posponerla obliga a reescribir controllers; **no** la dejes para el final.

**Orden que recomiendo**: el secuencial (F0→F12). Cada fase se apoya en la anterior y ninguna obliga a volver atrás.

---

## 18. Checklist maestro

**Base técnica**

- [ ] Repo git inicializado, `.env` ignorado desde el primer commit
- [ ] TypeScript estricto, ESLint + Prettier, hooks de pre-commit
- [ ] `app` separado de `server` (testeable con Supertest)
- [ ] Config validada con Zod, _fail-fast_ al arrancar
- [ ] Contrato de errores único y centralizado
- [ ] Logs estructurados con `requestId`, sin secretos
- [ ] `/health` (liveness) y `/health/ready` (readiness con `SELECT 1`)

**Base de datos**

- [ ] `docker compose` de desarrollo con healthcheck y volumen
- [ ] PostgreSQL embebida funcionando (`DB_MODE=embedded`)
- [ ] Migraciones `.sql` versionadas y commiteadas (nunca `push`)
- [ ] Restricciones en BD: `UNIQUE (temporada_id, numero_jornada)`, `CHECK`, `CASCADE` en partidos, `RESTRICT` en temporadas
- [ ] Índice único parcial de **una sola temporada activa**
- [ ] Índice único parcial de **una invitación pendiente por email**
- [ ] `timestamptz` en todas las fechas-hora

**Autenticación y autorización**

- [ ] `POST /auth/token` con `grant_type=password`
- [ ] `grant_type=refresh_token` con rotación y detección de reuso
- [ ] Refresh token en el **body** (Q5)
- [ ] Argon2id con parámetros OWASP
- [ ] Verificación de `iss` y `aud` además de firma y `exp`
- [ ] Claim `role` y middleware `requireRole('admin')` (Q3, Q4)
- [ ] Invitaciones de un solo uso con TTL y `sha256` en BD (Q2)
- [ ] **Google también exige invitación** → 403 `REGISTRATION_NOT_ALLOWED`
- [ ] Vinculación por email solo con `email_verified`
- [ ] Script `admin:create` con guardas; sin endpoint equivalente
- [ ] Rate limiting en `/auth/*` e `/invitaciones/{token}/validar`
- [ ] 401 genérico y de tiempo constante
- [ ] Generador de tokens de dev imposible en producción

**Documentación**

- [ ] `openapi.json` generado desde Zod y commiteado
- [ ] Swagger UI en `/docs` con auth funcional
- [ ] Spectral en CI exigiendo descripciones, ejemplos, 401 y 403
- [ ] CI falla si el OpenAPI está desactualizado

**Testing**

- [ ] `npm test` autónomo (BD propia, sin Docker)
- [ ] Batería de 7 casos de auth (con el 403 de rol) en cada endpoint protegido
- [ ] 10 casos de temporadas y 27 de jornadas verdes, incluido el rollback del PUT
- [ ] Contract tests contra el OpenAPI
- [ ] Umbrales de cobertura en CI

**Producción (VPS)**

- [ ] SSH solo con clave, root deshabilitado, `ufw` con 22/80/443
- [ ] `fail2ban` y `unattended-upgrades` activos
- [ ] **Postgres sin puerto publicado**
- [ ] Caddy con HTTPS automático y `trust proxy` configurado en Express
- [ ] Secretos de producción distintos y `.env.prod` con permisos 600
- [ ] `ENABLE_DEV_TOKENS=false` verificado con un `curl`
- [ ] Redirect URI de producción registrado en Google
- [ ] Migraciones como paso explícito previo al arranque (D22)
- [ ] **`mem_limit` en los 7 contenedores** según la tabla de §15 (Q9: 4 GB)
- [ ] Swapfile de 2 GB con `vm.swappiness=10`
- [ ] Postgres ajustado (`shared_buffers=512MB`, `effective_cache_size=1536MB`, `max_connections=50`) y verificado con `show`
- [ ] Pool de Node en `max: 10` (no 100)
- [ ] `free -h` con al menos ~1,5 GB disponibles para caché de disco en reposo
- [ ] Imágenes etiquetadas con SHA (rollback posible)
- [ ] Backup diario con retención **y una restauración probada**

**Observabilidad (§16)**

- [ ] `prom-client` + `collectDefaultMetrics()` + histograma HTTP desde F2
- [ ] Labels con **plantilla de ruta**, nunca URL cruda ni `userId` (cardinalidad)
- [ ] 404 etiquetados como `route="unmatched"`
- [ ] Métricas de auth: intentos de login, tokens emitidos, **reuso de refresh**, invitaciones validadas
- [ ] Gauges del pool de `pg` y `nodejs_eventloop_lag_seconds` visibles
- [ ] `curl https://api.tudominio.com/metrics` → **404** (no expuesto)
- [ ] Prometheus con retención acotada (`30d` / `2GB`) para no llenar el disco
- [ ] Grafana OSS detrás de Caddy, con su propia contraseña y registro deshabilitado
- [ ] Dashboard exportado a JSON y **commiteado** (sobrevive al VPS)
- [ ] Tres alertas activas como mínimo: API caída, tasa de 5xx, reuso de refresh
- [ ] **Una alerta disparada a propósito** y recibida en el móvil
- [ ] Alerta de **disco > 80 %** y de backup ausente en 26 h
- [ ] **Uptime Kuma en otra máquina**, con aviso de caducidad del certificado
- [ ] Chequeo externo contra `/health/ready`
- [ ] OpenTelemetry instalado y **desactivado** (`OTEL_ENABLED=false`), con `trace_id` ya en los logs

**Automatización (F14, D26)**

- [x] `docs/specs/_plantilla.md` con los 10 apartados (incluidos rol, temporada y métricas) — **hecha**
- [ ] `docs/specs/01-jornadas.md`: la spec del prompt pasada a la plantilla (antes de F11)
- [ ] Skill escrita **después** de F11, a partir del código real, no del plan
- [ ] La skill **no** escribe SQL de migración ni documentación aparte de los esquemas Zod
- [ ] La skill registra el módulo en `routes.ts` y en el registry de OpenAPI
- [ ] La skill instancia las matrices de test (7 de auth + validación + 403 por rol + contrato)
- [ ] La skill **para y reporta** si falla la verificación; nunca relaja un test
- [ ] Prueba de aceptación: regenera `jornadas` y pasa sus 27 casos
- [ ] `update` y `delete` **no** escritas todavía (esperar a usar `new` 2–3 veces)

---

## 19. Riesgos y decisiones que quedan abiertas

### Riesgos técnicos

| Riesgo                                                       | Impacto                                                                     | Mitigación                                                                                                                     |
| ------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ~~Incompatibilidad `zod` v4 ↔ `zod-openapi`~~                | ~~Bloquea F7~~                                                              | **Descartado el 2026-08-06**: `zod-openapi@6` declara `zod: ^4.0.0`. Ver tabla de versiones en §4                              |
| `embedded-postgres` en Mac ARM                               | Bloquea tests locales                                                       | Verificar en F3 con `npm run db:embedded` **antes** de construir sobre ella. Plan B: Testcontainers, o servicio Postgres en CI |
| `embedded-postgres` solo publica prereleases                 | Una actualización involuntaria cambia la versión de Postgres bajo los tests | `--save-exact` en la instalación (§4) y misma major que la imagen de Docker (Q10)                                              |
| **Descuadre de versión de Postgres entre entornos**          | Bugs que solo aparecen en producción                                        | Q10: **18 en desarrollo, tests y producción**. Verificable con `select version();` en los tres                                 |
| Configuración OAuth de Google (redirect URI, consent screen) | Bloquea F6 y el login en producción                                         | Hacerlo en F0 y **registrar el URI de producción antes de F12**                                                                |
| Deriva entre OpenAPI y código                                | Documentación falsa                                                         | Generación automática + `git diff --exit-code` en CI                                                                           |
| Rate limit contando la IP del proxy                          | El límite se aplica a todos a la vez                                        | `app.set('trust proxy', 1)` detrás de Caddy y un test que compruebe la IP registrada                                           |
| Migración incompatible en producción                         | Downtime o pérdida de datos                                                 | Migraciones aditivas, backup antes de migrar, restauración probada                                                             |
| Sobreingeniería temprana                                     | Retraso                                                                     | Nada de DDD, CQRS, event sourcing ni monorepo. Capas simples hasta que duela                                                   |
| **Explosión de cardinalidad en Prometheus**                  | Prometheus consume toda la RAM y se lleva la máquina                        | Labels solo con valores acotados; plantilla de ruta; `route="unmatched"` en los 404. Vigilar `prometheus_tsdb_head_series`     |
| **La observabilidad tira el VPS**                            | Caída provocada por lo que debía vigilarla                                  | Elegir el escenario por RAM (§16); retención acotada en Prometheus; `mem_limit` en los contenedores del stack                  |
| **`/metrics` expuesto públicamente**                         | Fuga de rutas, versiones y volumen de tráfico                               | Sin `ports` en compose, sin ruta en Caddy, y el `curl` de verificación en el checklist                                         |
| **Alertas ruidosas**                                         | Se silencian todas y no queda ninguna útil                                  | Empezar con tres; subir umbrales tras cada falso positivo; ninguna alerta sin acción asociada                                  |
| **El monitor vive en la máquina vigilada**                   | No te enteras de la caída que más importa                                   | Uptime Kuma obligatoriamente fuera del VPS (§16)                                                                               |

### Decisiones que aún no hace falta tomar (y cuándo tocarán)

| Tema                                         | Cuándo                                                                              | Nota                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Envío de emails de invitación** (D20)      | Cuando repartir URLs a mano moleste                                                 | El punto de extensión está en `invitations.service.create`: donde hoy se devuelve la URL, mañana se llama a un `mailer`. Candidatos: Resend, SES, SMTP propio |
| **Trazas con OpenTelemetry** (D24)           | Cuando haya un problema de rendimiento que las métricas localicen pero no expliquen | Ya instalado y apagado en F13. Encenderlo = `OTEL_ENABLED=true` + un contenedor de Tempo o Jaeger                                                             |
| **Logs agregados (Loki)**                    | Cuando `docker compose logs \| grep` deje de ser suficiente                         | Loki + Alloy, ~2 contenedores. Con 30 usuarios, `docker logs` aguanta mucho más de lo que parece                                                              |
| **Seguimiento de errores (GlitchTip)** (D25) | Cuando quieras stack traces agrupados y desduplicados                               | Necesita su propia Postgres y Redis. **Verifica su licencia** antes de adoptarlo                                                                              |
| ~~Cuántos GB tiene el VPS~~                  | **Resuelto (Q9): 4 GB**                                                             | Escenario de F13 confirmado. Reparto de memoria, `mem_limit` por servicio, swap y ajuste de Postgres en §15                                                   |
| **Migrar a 8 GB**                            | Si quieres Loki y Tempo permanentes, o si la peña crece mucho                       | Hasta entonces: logs con `docker logs` y trazas a demanda con Jaeger temporal (§16)                                                                           |
| **Skill `/quini-api-update`**                | Tras usar `/quini-api-new` dos o tres veces                                         | El problema real es la compatibilidad: migración aditiva, `deprecated: true` en OpenAPI, y decidir si el cambio obliga a `/api/v2`                            |
| **Skill `/quini-api-delete`**                | Cuando haya que retirar un endpoint                                                 | Deprecar → avisar → esperar → eliminar código → migración destructiva **con confirmación humana**. Un `DROP COLUMN` no se automatiza                          |
| **Skill autónoma o apoyada en el flujo SDD** | Al empezar F14                                                                      | Ambas válidas; elegir una para no mantener dos caminos que hacen lo mismo (F14, último apartado)                                                              |
| **RS256 + JWKS** (D9)                        | Antes de que un segundo servicio valide tokens                                      | Requiere par de claves, `/.well-known/jwks.json` y rotación con `kid`                                                                                         |
| **Recuperación de contraseña**               | Cuando alguien la pierda                                                            | Reutiliza casi por completo el mecanismo de invitaciones (token de un solo uso con TTL)                                                                       |
| **Revocación inmediata de rol**              | Si 15 min de ventana resulta inaceptable                                            | Columna `token_version` en `users` comprobada en `requireAuth`                                                                                                |
| **Multi-peña**                               | Cuando haya una segunda peña                                                        | Sería el cambio grande: `peñas` y pertenencia de usuarios, con las jornadas probablemente compartidas                                                         |
| **Apuestas y resultados**                    | Siguiente iteración funcional                                                       | Modelo previsto: `apuestas(user_id, jornada_id)` + `pronosticos(apuesta_id, orden, signo)` y `resultados(jornada_id, orden, signo)`                           |
| **Paginación en `GET /jornadas`**            | Cuando pasen de ~100                                                                | El prompt pide array plano; añadir paginación **rompe el contrato**, así que si se prevé, mejor decidirlo pronto                                              |

---

## 20. Convenciones del proyecto

| Ámbito                | Convención                                                                                                                                                                     | Ejemplo                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Nombres de ficheros   | `kebab-case`, sufijo por rol                                                                                                                                                   | `jornadas.service.ts`                       |
| Tipos e interfaces    | `PascalCase`, sin prefijo `I`                                                                                                                                                  | `Jornada`, `CreateJornadaInput`             |
| Variables y funciones | `camelCase`                                                                                                                                                                    | `findByNumeroJornada`                       |
| Columnas de BD        | `snake_case`                                                                                                                                                                   | `numero_jornada`, `created_at`              |
| Campos de la API      | `camelCase` **en español** (lo fija el prompt)                                                                                                                                 | `numeroJornada`, `equipoLocal`              |
| Rutas de dominio      | **en español** (coherente con el prompt)                                                                                                                                       | `/jornadas`, `/temporadas`, `/invitaciones` |
| Rutas técnicas        | **en inglés**                                                                                                                                                                  | `/auth/token`, `/auth/register`, `/health`  |
| Idioma del código     | Dominio en español (jornada, partido); técnico en inglés (`service`, `repository`, `middleware`); comentarios y descripciones OpenAPI en inglés, salvo los campos del contrato | `jornadas.repository.ts`                    |
| Tablas                | plural, `snake_case`                                                                                                                                                           | `jornadas`, `refresh_tokens`, `temporadas`  |
| Commits               | Conventional Commits                                                                                                                                                           | `feat(auth): password grant endpoint`       |
| Ramas                 | `feat/`, `fix/`, `chore/`                                                                                                                                                      | `feat/invitations`                          |
| Migraciones           | generadas, **nunca** editadas a mano tras aplicarse                                                                                                                            | `drizzle/0004_add_temporadas.sql`           |
| Tags de release       | `vMAJOR.MINOR.PATCH`, disparan el deploy                                                                                                                                       | `v0.3.0`                                    |

> **Nota sobre el idioma**: lo que hay que evitar es mezclar idiomas dentro de un mismo identificador (`getJornadaByNumber`). La regla anterior es explícita para que no dudes cada vez.

---

## 21. Glosario para aprender

| Término                             | Qué es                                                                      | Por qué te importa aquí                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **JWT**                             | Token firmado en 3 partes (header.payload.signature) en Base64URL           | Firmado ≠ cifrado: **cualquiera lee su contenido**. Nunca metas datos sensibles          |
| **Claim**                           | Campo del payload de un JWT (`sub`, `exp`, `aud`, `role`…)                  | Verificar solo la firma y olvidar `aud`/`iss` es un agujero clásico                      |
| **Access token**                    | Credencial de vida corta para llamar a la API                               | Corto porque no se puede revocar antes de su `exp`                                       |
| **Refresh token**                   | Credencial larga para obtener nuevos access tokens                          | Opaco y en BD para poder revocarlo                                                       |
| **Rotación / reuso**                | Cada refresh emite uno nuevo; usar uno viejo indica robo                    | Al detectarlo se revoca toda la familia                                                  |
| **ROPC**                            | _Resource Owner Password Credentials_: el "OAuth2 con usuario y contraseña" | Desaconsejado en general; aceptable como login de primera parte (§3)                     |
| **PKCE**                            | Prueba de posesión (`code_verifier`/`code_challenge`)                       | Impide que un código interceptado sea canjeable                                          |
| **`state`**                         | Valor aleatorio de ida y vuelta en OAuth                                    | Anti-CSRF: sin él, alguien puede vincular su cuenta a la tuya                            |
| **ID token**                        | JWT de Google que **identifica** al usuario                                 | No sirve para llamar a APIs de Google; sirve para saber quién es                         |
| **401 vs 403**                      | "No sé quién eres" vs "sé quién eres y no puedes"                           | Con roles (Q4) esta distinción se usa a diario                                           |
| **Argon2id**                        | Hash de contraseñas resistente a GPU/ASIC                                   | Recomendación OWASP; su coste es deliberado                                              |
| **Índice único parcial**            | `UNIQUE ... WHERE condición`                                                | Es lo que hace **imposible** tener dos temporadas activas                                |
| **Migración**                       | Script versionado que evoluciona el esquema                                 | Hace tu BD reproducible                                                                  |
| **Pool de conexiones**              | Conjunto reutilizable de conexiones                                         | Abrir una conexión por petición mata el rendimiento                                      |
| **Transacción**                     | Todo o nada                                                                 | Las 15 filas de partidos entran juntas o no entran                                       |
| **Idempotencia**                    | Repetir la operación da el mismo resultado                                  | `PUT` y `DELETE` lo son; `POST` no                                                       |
| **Liveness / Readiness**            | "Estoy vivo" / "puedo atender tráfico"                                      | Caddy y el monitor externo necesitan distinguirlos                                       |
| **Reverse proxy**                   | Servidor que recibe el tráfico y lo reenvía a tu app                        | Caddy termina TLS y tu app solo habla HTTP en la red interna                             |
| **`trust proxy`**                   | Ajuste de Express para creer la cabecera `X-Forwarded-For`                  | Sin él, el rate limit ve una sola IP: la del proxy                                       |
| **OpenAPI**                         | Descripción estándar y legible por máquinas de la API                       | De aquí salen `/docs`, la colección de Insomnia y los contract tests                     |
| **Contract test**                   | Test que valida que la respuesta cumple el esquema publicado                | Impide que la documentación mienta                                                       |
| **Supertest**                       | Cliente HTTP que llama a la app sin abrir puerto                            | Tests de endpoint rápidos y paralelizables                                               |
| **Los tres pilares**                | Métricas (¿cuánto?), logs (¿por qué?), trazas (¿dónde?)                     | Cada uno responde a una pregunta distinta; ninguno sustituye a otro                      |
| **Counter / gauge / histogram**     | Solo sube / sube y baja / distribución en cubos                             | Un contador de errores es _counter_; conexiones abiertas, _gauge_; latencia, _histogram_ |
| **Percentil p95**                   | El valor que supera el 95 % de las peticiones                               | La media miente: oculta justo las peticiones lentas que la gente nota                    |
| **Label / cardinalidad**            | Dimensión de una métrica / número de combinaciones distintas                | Cardinalidad alta es _la_ forma de reventar Prometheus (§16)                             |
| **Scrape**                          | Prometheus va a buscar las métricas a `/metrics` cada X segundos            | Modelo _pull_: tu app no envía nada, solo publica                                        |
| **PromQL**                          | Lenguaje de consulta de Prometheus                                          | `rate(...[5m])` para tasas, `histogram_quantile` para percentiles                        |
| **Event loop lag**                  | Retraso del bucle de eventos de Node                                        | _La_ métrica de salud de un proceso Node: si sube, todo se degrada a la vez              |
| **SLI / SLO**                       | Indicador medido / objetivo que te fijas                                    | "p95 < 500 ms el 99 % del mes" convierte una sensación en un número                      |
| **OTLP**                            | Protocolo estándar de OpenTelemetry para exportar señales                   | Te permite cambiar de backend (Tempo, Jaeger) sin tocar el código                        |
| **Cuota de error (_error budget_)** | Cuánto puedes fallar sin incumplir tu SLO                                   | Da permiso para desplegar: si te sobra, arriesga; si no, estabiliza                      |
| **OOM killer**                      | El kernel mata procesos cuando se agota la RAM                              | Sin `mem_limit`, elige él; y suele elegir el proceso grande, que es Postgres             |
| **`mem_limit`**                     | Techo de memoria de un contenedor, **no** una reserva                       | Por eso la suma de límites puede superar la RAM física sin problema                      |
| **Caché de disco (_page cache_)**   | RAM libre que el kernel usa para cachear ficheros                           | Postgres depende de ella: RAM "sin asignar" no es RAM desperdiciada                      |
| **`swappiness`**                    | Cuánta prisa tiene el kernel por usar swap                                  | A 60 (por defecto) manda Postgres a disco teniendo RAM libre; a 10, solo en emergencia   |
| **`shared_buffers`**                | Caché propia de Postgres, dentro de su proceso                              | 25 % de la RAM solo si el servidor es dedicado; aquí es compartido                       |
| **`effective_cache_size`**          | Pista al planificador sobre la caché disponible                             | No reserva memoria: cambia los planes de consulta (índice vs escaneo)                    |

---

## Próximo paso

Decisiones cerradas (§0). Empezamos por **F1** comando a comando, y no pasamos a F2 hasta que `npm run typecheck && npm run lint` esté verde.

Antes de arrancar, dos cosas de F0 que conviene tener listas porque bloquean fases posteriores:

1. Credenciales OAuth de Google (bloquea F6).
2. Subdominio del VPS resolviendo por DNS (bloquea F12).
