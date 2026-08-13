# Servicios de negocio — cómo se construye un módulo tipo

> **Ámbito de este documento**: la plantilla arquitectónica que sigue (y seguirá) todo módulo de negocio del proyecto — `invitations` como primer caso real ya construido (F4), `temporadas`/`equipos`/`jornadas` como próximos casos (F10, F10.5, F11) que la aplican tal cual.
> **Para quién**: documento de estudio y chuleta de referencia. Antes de escribir el primer fichero de un módulo nuevo, repásalo — evita reinventar convenciones que ya están decididas y probadas.

---

## Índice

- [Servicios de negocio — cómo se construye un módulo tipo](#servicios-de-negocio--cómo-se-construye-un-módulo-tipo)
  - [Índice](#índice)
  - [1. Objetivo de este documento](#1-objetivo-de-este-documento)
  - [2. Anatomía de un módulo: los 5 ficheros](#2-anatomía-de-un-módulo-los-5-ficheros)
  - [3. `schemas.ts` — validación de entrada y forma de salida](#3-schemasts--validación-de-entrada-y-forma-de-salida)
  - [4. `repository.ts` — acceso a datos con Drizzle](#4-repositoryts--acceso-a-datos-con-drizzle)
  - [5. `service.ts` — reglas de negocio y traducción de errores](#5-servicets--reglas-de-negocio-y-traducción-de-errores)
  - [6. `controller.ts` — traducción HTTP ↔ dominio](#6-controllerts--traducción-http--dominio)
  - [7. `routes.ts` — middlewares y montaje](#7-routests--middlewares-y-montaje)
  - [8. Catálogo de errores de dominio](#8-catálogo-de-errores-de-dominio)
  - [9. Caso guiado: `temporadas` con esta plantilla](#9-caso-guiado-temporadas-con-esta-plantilla)
  - [10. Checklist para crear un módulo nuevo](#10-checklist-para-crear-un-módulo-nuevo)
  - [11. Diagrama de flujo de una petición](#11-diagrama-de-flujo-de-una-petición)
  - [12. Lo que falta / decisiones pendientes](#12-lo-que-falta--decisiones-pendientes)
  - [13. Glosario](#13-glosario)

---

## 1. Objetivo de este documento

Cada entidad de negocio (`temporadas`, `equipos`, `jornadas`, y lo que venga después: apuestas, resultados, peñas) se implementa como un **módulo autocontenido en capas**, siguiendo siempre la misma forma. `invitations` (F4) fue el primer módulo completo y es, en la práctica, la plantilla viva: este documento extrae sus convenciones para que no haya que releer su código cada vez que se empieza uno nuevo.

La regla de oro no cambia respecto a `01-Arquitectura.md`/`00-Plan-inicial.md` §5: **las flechas de dependencia nunca van hacia arriba**. `routes` conoce a `controller`, `controller` conoce a `service`, `service` conoce a `repository`. Nunca al revés, y nunca se salta una capa.

## 2. Anatomía de un módulo: los 5 ficheros

Un módulo vive en `src/modules/<nombre>/` y son siempre estos 5 ficheros (más algún extra opcional, como `<nombre>.openapi.ts` para las anotaciones de documentación — ver `03-OpenAPI.md`):

| Fichero                  | Responsabilidad                                                                        | Nunca hace                                |
| ------------------------ | -------------------------------------------------------------------------------------- | ----------------------------------------- |
| `<nombre>.schemas.ts`    | Esquemas Zod de entrada (`body`/`params`/`query`) y de salida; tipos derivados         | Tocar la BD ni `req`/`res`                |
| `<nombre>.repository.ts` | Consultas Drizzle: `select`/`insert`/`update`/`delete`                                 | Decidir códigos HTTP ni reglas de negocio |
| `<nombre>.service.ts`    | Reglas de negocio, orquesta transacciones, traduce errores de BD en errores de dominio | Tocar `req`/`res`                         |
| `<nombre>.controller.ts` | Lee `req`, llama al `service`, decide el código HTTP y la forma exacta de la respuesta | Consultas SQL                             |
| `<nombre>.routes.ts`     | Declara rutas, middlewares (`requireAuth`, `requireRole`, `validate`) y las monta      | Lógica de negocio                         |

Por qué importa cada límite: si el `service` nunca ve `req`/`res`, se puede testear sin HTTP (ver `04-Testing.md`). Si el `repository` nunca decide códigos de estado, se puede cambiar de motor de BD sin tocar la API. Y cuando algo falle en producción, el tipo de error dice en qué capa mirar.

## 3. `schemas.ts` — validación de entrada y forma de salida

Convenciones observadas en `invitations.schemas.ts`:

- **Nombres**: esquemas de entrada como `Create<Entidad>Schema`, `Update<Entidad>Schema`; esquemas de salida como `<Entidad>ResponseSchema`. Entrada y salida **siempre separadas** — nunca se reutiliza el esquema de tabla como esquema de respuesta directamente, aunque coincidan en la mayoría de campos.
- **Tipos derivados**: `export type CreateXInput = z.infer<typeof CreateXSchema>` junto al esquema, para que el `controller` tipe `req.body` sin duplicar la forma a mano.
- **Validadores Zod v4** ya en uso en el proyecto: `z.email()`, `z.uuid()`, `z.iso.datetime()`, `z.url()`, `z.enum([...])` para uniones literales.
- **`.refine()` vs `CHECK` de BD**: `invitations` no necesitó ningún `refine()` porque sus invariantes son de un solo campo. En cuanto una regla cruza dos campos (`fechaFin > fechaInicio` en `temporadas`, `equipoLocal !== equipoVisitante` en `partidos`), **se defiende en las dos capas**: `refine()` en Zod da un `400` legible antes de tocar la BD, y el `CHECK` en Postgres es la garantía real contra condiciones de carrera o accesos que no pasen por la API. Ninguna de las dos sustituye a la otra — ver `00-Plan-inicial.md` §7, "Restricciones que impone la base de datos (no solo el código)".

## 4. `repository.ts` — acceso a datos con Drizzle

Convenciones observadas en `invitations.repository.ts`:

- **Toda función acepta una transacción opcional**: `async function crear(input: CreateXInput, tx: DbOrTx = db)`. `DbOrTx` viene de `src/db/index.ts`. Esto permite que un módulo (p. ej. `auth`, al registrar un usuario) abra una transacción y se la pase a `invitations.consume(tx, ...)` para que ambas escrituras vivan o mueran juntas — sin que el repository de `invitations` sepa nada sobre quién lo llama.
- **Inserciones**: `const [row] = await tx.insert(table).values(input).returning();` seguido de una comprobación defensiva (`if (!row) throw new Error(...)`) — Drizzle no garantiza el array no vacío a nivel de tipos.
- **Lecturas**: `tx.select().from(table).where(eq(table.columna, valor))`, combinando condiciones con `and(...)` cuando hace falta (`eq`, `and`, `gt`, `isNull` son los operadores ya en uso).
- **Actualizaciones**: `tx.update(table).set({...}).where(eq(...))`.
- **Nunca se abre una transacción dentro del propio repository** — quien decide el límite transaccional es siempre el `service` (o un `service` de otro módulo que orquesta varios).
- **Nombrar las funciones y el choque con `service.ts`**: `invitations.repository.ts` usa nombres compuestos (`createInvitation`, `findInvitationByHash`, `markInvitationAccepted`) precisamente para poder importarlos por nombre directo en el `service` sin chocar con las funciones que el propio `service` exporta. Si en cambio se usan verbos genéricos (`create`, `update`, `findAll`...) — como en `temporadas` —, el `service` que los consume **debe** importarlos como namespace: `import * as temporadasRepository from "./temporadas.repository.js"` y llamarlos como `temporadasRepository.create(...)`. Las dos convenciones de nombrado son válidas; lo que no vale es mezclar verbos genéricos en el repository con un `import { create, update } from "./x.repository.js"` sin namespace en el service — eso choca con el `create`/`update` que el propio service también exporta.

## 5. `service.ts` — reglas de negocio y traducción de errores

Convenciones observadas en `invitations.service.ts`:

- **Traduce errores de bajo nivel en errores de dominio**. El caso canónico: capturar una violación de unicidad de Postgres (`err.cause.code === "23505"`, expuesto normalmente detrás de un helper tipo `isUniqueViolation(err)`) y relanzarla como `ConflictError` con un mensaje de negocio, en vez de dejar escapar el error crudo de `pg`.
- **Lookup vacío → `NotFoundError`**. Si el `repository` devuelve `undefined`/`[]`, el `service` decide que eso es un 404, no el `controller`.
- **Estados inválidos → error específico**: `invitations` usa un helper `assertUsable(invitation)` que lanza `GoneError` si ya fue aceptada/revocada/caducada — el patrón general es: una función `assert*` de una línea que centraliza una comprobación de estado que se repetiría en varios sitios.
- **El patrón `resolve*`**: funciones como `resolveTemporada(codigo?, tx?)` o `resolveEquipo(nombre, tx?)` son el **punto único** donde vive una regla que necesitan varios módulos (p. ej. "si no me dan código, dame la temporada activa o 404"). Un módulo que depende de otro (`jornadas` depende de `temporadas` y `equipos`) importa y llama a su función `resolve*`, nunca reimplementa la búsqueda.

## 6. `controller.ts` — traducción HTTP ↔ dominio

Convenciones observadas en `invitations.controller.ts`:

- **Sin `try/catch`**. Express 5 propaga automáticamente los rechazos de un handler `async` al error handler global (`src/middleware/error-handler.ts`) — es la razón D1 del plan para elegir Express 5. Un error lanzado por el `service` sube solo.
- **Cast del body/params ya validado** al tipo inferido por Zod (`req.body as CreateXInput`) — la validación real ya la hizo el middleware `validate()` en la capa de `routes`, aquí solo se tipa.
- **Contexto de usuario autenticado**: un helper (`requireAuthContext(req)`) extrae `req.auth` y lanza `UnauthorizedError` si falta, en vez de repetir la comprobación en cada handler.
- **La forma de la respuesta se construye explícitamente** — no se hace `res.json(row)` a secas cuando la fila de BD y el contrato público difieren (p. ej. añadir un campo `url` calculado a partir de `env.PUBLIC_APP_URL` en invitaciones). El `controller` es la última capa que puede dar forma a lo que ve el cliente.
- **Códigos de estado por operación**: `201` en creación, `200` en lectura/acciones, `204` en borrado sin cuerpo (ver `equipos`/`temporadas` en el plan).
- **Mismo choque de nombres, un nivel más arriba**: si `service.ts` expone verbos genéricos (`create`, `update`, `remove`...), `controller.ts` los importa igual que el `service` importa al `repository` — como namespace: `import * as temporadasService from "./temporadas.service.js"`, porque el propio `controller` también exporta `create`/`update`/`remove`. `routes.ts`, un nivel más arriba, normalmente **no** tiene este problema: ahí se importan las funciones del `controller` por nombre directo, porque no hay otro `create` en ese fichero con el que choquen.

## 7. `routes.ts` — middlewares y montaje

Convenciones observadas en `invitations.routes.ts` y `src/routes.ts`:

- Cada endpoint se declara con su **array de middlewares en línea**: `router.post("/", requireAuth, requireRole("admin"), validate({ body: CreateXSchema }), controller.crear)`.
- **Lectura vs escritura**: por convención de todo el proyecto (`Q3`/`Q4` del plan), lectura es `requireAuth` a secas (cualquier autenticado) y escritura añade `requireRole("admin")`.
- Endpoints públicos o semi-públicos (como `GET /invitaciones/:token/validar`) sustituyen `requireAuth` por el middleware que corresponda al caso (allí, `invitationRateLimit`, porque no hay usuario todavía).
- El router se exporta con nombre: `export const xRouter = Router()`.
- **Montaje**: en `src/routes.ts` se importa el router del módulo y se cuelga bajo su segmento en español: `router.use("/temporadas", temporadasRouter)`. Esto es todo lo que hace falta tocar fuera de la carpeta del propio módulo.

## 8. Catálogo de errores de dominio

Definidos en `src/core/errors.ts`, todos subclase de `AppError` (nunca se lanza `AppError` directamente):

| Clase                         | HTTP | Código                     | Cuándo                                                                              |
| ----------------------------- | ---- | -------------------------- | ----------------------------------------------------------------------------------- |
| `ValidationError`             | 400  | `VALIDATION_ERROR`         | Entrada inválida que se escapó de Zod (raro; normalmente ya la corta `validate()`)  |
| `UnauthorizedError`           | 401  | `UNAUTHORIZED`             | Falta autenticación o el token no es válido                                         |
| `ForbiddenError`              | 403  | `FORBIDDEN`                | Autenticado pero sin permiso (rol insuficiente)                                     |
| `NotFoundError`               | 404  | `NOT_FOUND`                | El recurso buscado no existe                                                        |
| `ConflictError`               | 409  | `CONFLICT`                 | Choque de estado o unicidad (código duplicado, regla de negocio violada en carrera) |
| `GoneError`                   | 410  | `GONE`                     | El recurso existió pero ya no es utilizable (invitación caducada/usada)             |
| `RegistrationNotAllowedError` | 403  | `REGISTRATION_NOT_ALLOWED` | Específico del flujo de registro por invitación                                     |

Para un módulo nuevo, la pregunta a hacerse por cada regla de negocio es: **¿qué clase de esta tabla la representa?** Si ninguna encaja, es señal de que hace falta una subclase nueva — no de forzar una existente.

## 9. Caso guiado: `temporadas` con esta plantilla

Mapeo concreto de F10 sobre las 5 capas, usando el esquema ya existente en `src/db/schema/temporadas.ts`:

```ts
// src/db/schema/temporadas.ts (ya existe, no se toca en F10)
export const temporadas = pgTable(
  "temporadas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    codigo: text("codigo").notNull(),
    nombre: text("nombre").notNull(),
    fechaInicio: date("fecha_inicio").notNull(),
    fechaFin: date("fecha_fin").notNull(),
    activa: boolean("activa").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("temporadas_codigo_key").on(t.codigo),
    uniqueIndex("temporadas_una_activa")
      .on(t.activa)
      .where(sql`${t.activa}`),
    check("temporadas_codigo_check", sql`${t.codigo} ~ '^\d{4}-\d{2}$'`),
    check("temporadas_fechas_check", sql`${t.fechaFin} > ${t.fechaInicio}`),
  ],
);
```

| Capa            | Qué hace en `temporadas`                                                                                                                                                                                                                                                                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemas.ts`    | `CreateTemporadaSchema` con `codigo: z.string().regex(/^\d{4}-\d{2}$/)`, `fechaInicio`/`fechaFin` ISO, y un `.refine()` para `fechaFin > fechaInicio` (400 antes de la BD). `codigo` **no** aparece en el esquema de update: es inmutable tras crear.                                                                                                      |
| `repository.ts` | CRUD estándar + `findActiva(tx?)` + `activar(codigo, tx)`                                                                                                                                                                                                                                                                                                  |
| `service.ts`    | `resolveTemporada(codigo?, tx?)`: si hay `codigo`, la busca; si no, devuelve la activa; `NotFoundError` si no hay ninguna. `activar(codigo)` en **una transacción**: primero `UPDATE ... SET activa = false WHERE activa`, después activa la nueva — en ese orden, porque al revés el índice único parcial `temporadas_una_activa` rechazaría la operación |
| `controller.ts` | CRUD + `POST /{codigo}/activar` → `200` con la temporada activada                                                                                                                                                                                                                                                                                          |
| `routes.ts`     | Lectura: `requireAuth`. Escritura y `/activar`: `requireAuth, requireRole("admin")`                                                                                                                                                                                                                                                                        |

`resolveTemporada` es exactamente el tipo de función que `jornadas.service.ts` (F11) importará después — mismo patrón que `resolveEquipo` (F10.5) — así que su firma (`codigo` opcional, `tx` opcional) debe pensarse para ese consumidor, no solo para el CRUD propio de `temporadas`.

## 10. Checklist para crear un módulo nuevo

1. ¿Existe ya la tabla en `src/db/schema/<nombre>.ts` y está exportada desde `src/db/schema/index.ts`? Si no, ese es un paso de F3/diseño de datos, no de este documento.
2. `<nombre>.schemas.ts` — esquemas de entrada/salida, `.refine()` solo para invariantes multi-campo que ya tengan su `CHECK` gemelo en BD.
3. `<nombre>.repository.ts` — funciones con `tx: DbOrTx = db`, sin decidir nunca un código HTTP.
4. `<nombre>.service.ts` — reglas de negocio, función `resolve*` si otro módulo va a necesitar resolver esta entidad, traducción de errores de BD a la tabla del §8.
5. `<nombre>.controller.ts` — sin `try/catch`, forma de respuesta explícita, código HTTP correcto por operación.
6. `<nombre>.routes.ts` — middlewares en el orden `requireAuth → requireRole → validate → controller`, exportado como `<nombre>Router`.
7. Montar en `src/routes.ts`: import + `router.use("/<segmento-en-español>", xRouter)`.
8. Generar y **leer** la migración si la tabla es nueva (`npm run db:generate`, luego revisar el `.sql` a mano — no confiar a ciegas).
9. Matriz de aceptación (como las de `00-Plan-inicial.md` §14) antes de dar la fase por cerrada: al menos un caso por rol, un caso de conflicto (409) y un caso de no encontrado (404).
10. Tests de integración en `tests/integration/<nombre>.test.ts` siguiendo `04-Testing.md`.

## 11. Diagrama de flujo de una petición

```mermaid
flowchart TD
    Req["Petición HTTP"] --> RA["requireAuth<br/>¿token válido?"]
    RA -->|401| ErrH["error-handler"]
    RA --> RR["requireRole('admin')<br/>solo si escribe"]
    RR -->|403| ErrH
    RR --> Val["validate({ body: Schema })<br/>Zod"]
    Val -->|400| ErrH
    Val --> Ctrl["controller<br/>req → llamada a service"]
    Ctrl --> Svc["service<br/>reglas de negocio"]
    Svc --> Rep["repository<br/>Drizzle"]
    Rep --> DB[(PostgreSQL)]
    Rep -->|fila / vacío| Svc
    Svc -->|NotFoundError / ConflictError / ...| ErrH
    Svc -->|resultado| Ctrl
    Ctrl -->|res.status().json()| Res["Respuesta HTTP"]
```

## 12. Lo que falta / decisiones pendientes

- Este documento describe el patrón **tal como lo fijó `invitations`** (F4). Si `temporadas` (F10) o `jornadas` (F11) descubren un caso que no encaja limpiamente (p. ej. una operación que toca dos entidades a la vez, como `activar` temporada + notificar), este documento debe actualizarse — no crear una excepción silenciosa en el código.
- No cubre todavía **paginación ni filtrado por query params** en listados (`GET /temporadas`, `GET /jornadas`) — ningún módulo actual lo necesita aún con este volumen de datos; cuando aparezca, este documento debe ganar una sección propia.
- No cubre el patrón para **operaciones que abarcan varios módulos en una sola transacción** (el caso `auth` + `invitations` al registrar) más allá de mencionar que `tx` se pasa hacia abajo — merece un ejemplo propio cuando `jornadas` empiece a tocar `equipos` en F11.
- Pendiente decidir si `<nombre>.openapi.ts` (visto en `invitations`) es parte fija de la plantilla de 5+1 ficheros o un añadido específico — revisar tras F10.5/F11 con más de un caso.
- Extraer `isUniqueViolation`/`isForeignKeyViolation` (códigos `23505`/`23503` de Postgres) a un helper compartido, p. ej. `src/core/pg-errors.ts`, en cuanto un segundo módulo (`equipos` o `jornadas`) las necesite tal cual. Con un solo caso repetido (`invitations` + `temporadas`) todavía no está claro cuál es la forma correcta de la abstracción — no adivinarla antes de tiempo.

## 13. Glosario

- **Módulo**: carpeta autocontenida en `src/modules/<nombre>/` con los 5 ficheros de este documento.
- **`DbOrTx`**: tipo que representa indistintamente la conexión `db` normal o una transacción Drizzle en curso (`tx`), usado como parámetro opcional en los repositories.
- **`resolve*`**: función de `service` que centraliza "dame la entidad X a partir de un identificador opcional, o el 404 correspondiente" para que otros módulos la reutilicen.
- **`assert*`**: función de `service` que centraliza una comprobación de estado (p. ej. "¿sigue siendo utilizable?") y lanza el error de dominio adecuado si falla.
- **Error de dominio**: subclase de `AppError` (§8) que el `error-handler` global sabe serializar con el código HTTP correcto.
- **Violación de unicidad (`23505`)**: código de error de Postgres para un `UNIQUE`/índice único violado; se traduce siempre a `ConflictError` en la capa de `service`, nunca se deja escapar tal cual.
