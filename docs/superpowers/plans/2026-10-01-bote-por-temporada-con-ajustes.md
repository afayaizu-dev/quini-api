# Bote por temporada con ajustes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el bote se calcule por temporada (ajustes de la temporada + `resultados_miembro.bote` de sus jornadas), que GET /dashboard/jornada exponga el bote acumulado hasta esa jornada (`boteJornadaAjustado`), y que al activar una temporada nueva se cree, en la misma transacción, un ajuste "Bote heredado de <código anterior>" con el bote final de la temporada que estaba activa.

**Architecture:** `ajustes_bote` gana `temporada_id` (NOT NULL, backfill a la temporada activa) y `origen_temporada_id` (NULL = ajuste manual; no NULL = bote heredado, único por temporada mediante índice único parcial). El cálculo del bote de una temporada vive en un único sitio (`dashboardRepository.boteTemporada`), que usan tanto `boteTotal` como la creación del heredado en `temporadasService.activate`. La API de ajustes resuelve la temporada por código (`?temporada=` / `body.temporada`, por defecto la activa) siguiendo el patrón de `resolveTemporada` y solo permite crear/borrar ajustes de la temporada activa.

**Tech Stack:** Node 22 + TypeScript (ESM, `exactOptionalPropertyTypes`), Express 5, Zod 4 + zod-openapi, Drizzle ORM 0.45 / drizzle-kit 0.31 sobre PostgreSQL 18, Vitest 4 + Supertest con Postgres embebido (`npm test` usa `.env.test`).

**Spec:** (no hay spec separada; las decisiones están en la sección "Decisiones" de este plan)

## Global Constraints

- **Commits quirúrgicos.** El árbol de trabajo tiene cambios sin commitear ajenos a esta tarea: `package.json`, `.atl/`, `docker/pull-prod.sh`, `.agents/`, `.claude/`, `comandos/`. Cada commit añade SOLO los archivos de su tarea con `git add <rutas explícitas>`. Prohibido `git add -A`, `git add .`, `git commit -a`. Antes de cada commit, `git diff --cached --stat` debe listar únicamente las rutas de la tarea.
- **package.json tiene cambios ajenos.** Ninguna tarea de este plan los modifica. Si alguna lo necesitase, NO hacer `git add package.json`: usar `git add -p package.json` y añadir solo los hunks propios.
- **Pre-commit** (`.husky/pre-commit`): `npx lint-staged && npm run typecheck`. lint-staged ejecuta `eslint --fix` sobre `*.ts` y `prettier --write` sobre `*.{json,md,yml}` en staged; el typecheck es de todo el proyecto (incluye los cambios ajenos del árbol, que ya compilan).
- **OpenAPI**: cuando cambie un schema Zod o un `*.openapi.ts`, regenerar ANTES de ejecutar los tests (los tests validan respuestas contra `openapi/openapi.json`): `npm run openapi:generate && npx prettier --write openapi/openapi.json`. CI (`.github/workflows/ci.yml`) hace lo mismo y falla con `git diff --exit-code openapi/openapi.json`.
- **Cobertura**: `vitest.config.ts` exige 100 % en `temporadas.service.ts`, `dashboard.service.ts` y `calculos.service.ts`. Toda rama nueva en esos archivos necesita test.
- **Convenciones**: identificadores y mensajes de error en español; 4 espacios; comillas dobles; imports con sufijo `.js`; `/* v8 ignore next -- @preserve */` solo en ramas defensivas imposibles; errores HTTP con las clases de `src/core/errors.ts` (`NotFoundError` 404, `ConflictError` 409 con `error: "CONFLICT"`).
- **Migraciones**: drizzle-kit no genera "down" ni backfills; la SQL generada se edita a mano y el snapshot se deja tal cual lo genera drizzle-kit (representa el estado final). Tras editar, `npm run db:generate` debe responder que no hay cambios.
- **Producción**: ningún paso de este plan ejecuta nada contra producción automáticamente. La Task 10 es una checklist para que la ejecute el usuario.
- Comando de test por archivo: `npm test -- tests/integration/<archivo>.test.ts` (el script es `node --env-file=.env.test node_modules/vitest/vitest.mjs run`, los argumentos tras `--` llegan a vitest).

## Review Focus

Las cinco condiciones límite con más probabilidad de quedarse sin cubrir, y el test que las fija:

1. **Activar la temporada que ya está activa** → no duplica ni recalcula el heredado. Test "activar otra vez la temporada ya activa no duplica ni recalcula el heredado" (Task 5).
2. **Reactivar una temporada antigua y volver a la nueva** → la antigua no recibe heredado (evita el ciclo A→B→A) y al volver a la nueva su heredado se recalcula sobre la misma fila. Tests "reactivar una temporada más antigua no le crea heredado y la nueva conserva el suyo" y "volver a activar la nueva tras corregir la antigua recalcula su heredado sin duplicarlo" (Task 5).
3. **Temporada nueva sin anterior activa** → no se crea heredado. Test "sin temporada activa previa -> no se crea bote heredado" (Task 5).
4. **Fechas de ajuste frente a la jornada**: ajuste anterior al inicio de temporada (cuenta en todas las jornadas), ajuste con la misma fecha que J (cuenta, `<=`), ajuste posterior a la última jornada (cuenta en `boteTotal` pero no en `boteJornadaAjustado`), y heredado con fecha posterior a la jornada (cuenta siempre). Tests "ajustes antes del inicio, el mismo día y después de la jornada" (Task 4) y "el heredado cuenta en boteJornadaAjustado aunque la jornada sea anterior a fechaInicio" (Task 5). Jornada no calculada → 404 queda fijado por el test existente "de jornada sin calcular -> 404" de `tests/integration/dashboard.test.ts`, que se ejecuta en la Task 4 sin cambios.
5. **Importes con decimales y redondeo**: `boteTotal` hoy suma en JS sin redondear (`ajustesBote + agg.sumaBote`, `dashboard.service.ts:112`). Tests "ajuste con decimales -> boteTotal redondeado a céntimos" (Task 3), valores 8.35 / 9.9 / 13.9 (Task 4) y 12.3 / 17.3 (Task 5).

---

## Decisiones

### Tomadas por el usuario

- **D1.** `ajustes_bote.temporada_id uuid NOT NULL` con FK a `temporadas`. Backfill: todos los ajustes existentes pasan a la temporada con `activa = true`. Si hay ajustes y no hay temporada activa, la migración falla con un error explícito (no deja NULL).
- **D2.** Bote de una temporada = suma de sus ajustes + suma de `resultados_miembro.bote` de sus jornadas. `boteTotal` de GET /dashboard/temporada filtra los ajustes por temporada (hoy `dashboardRepository.sumaAjustesBote()` suma toda la tabla).
- **D3.** Nuevo campo `boteJornadaAjustado` (tipo `importeConSigno`) en GET /dashboard/jornada; `boteJornada` no cambia. Valor: ajustes de la temporada de J con `fecha <= fecha(J)` + resultados de las jornadas de esa temporada con `numeroJornada <= numeroJornada(J)`. Coincide con `boteTotal` en la última jornada si no hay ajustes posteriores (fijado con test).
- **D4.** Al activar una temporada nueva, dentro de la misma transacción, se calcula el bote final de la que estaba activa y se crea en la nueva un ajuste "Bote heredado de <código anterior>" con `fecha = fechaInicio` de la nueva. Un único heredado por temporada. Sin temporada activa previa, no se crea.
- **D5.** El recálculo (POST /calculos) de jornadas de temporadas no activas queda bloqueado con error explícito.
- **D6.** Las respuestas de ajustes incluyen `temporadaId`; en la creación, si no se indica temporada, se usa la activa (404 claro si no hay). El listado se filtra por temporada (por defecto la activa).
- **D7.** OpenAPI regenerado y tests de integración (vitest + supertest).

### Propuestas (las tomo yo; el usuario debe validarlas)

- **P1 — Marcar el heredado con `origen_temporada_id uuid NULL` (FK a temporadas), no con una columna `tipo`.** `NULL` = ajuste manual; no nulo = heredado de esa temporada. Índice único parcial `ajustes_bote_un_heredado_por_temporada ON (temporada_id) WHERE origen_temporada_id IS NOT NULL` y `CHECK (origen_temporada_id <> temporada_id)`. Justificación: una sola columna da a la vez el tipo y la trazabilidad (de qué temporada viene el importe), permite saber si hay que recalcular, y la FK `restrict` impide borrar la temporada origen dejando un heredado huérfano. Con `tipo` haría falta además guardar el origen en el texto del motivo.
- **P2 — Política de activación.** Sea `anterior` la temporada activa justo antes y `nueva` la que se activa:
  - sin `anterior`, o `anterior` = `nueva` (re-activar la ya activa): no se toca ningún heredado;
  - `anterior.fechaInicio >= nueva.fechaInicio` (se reactiva una temporada más antigua o con la misma fecha de inicio): no se toca ningún heredado. Evita el ciclo A→B→A en el que A heredaría un bote que ya contiene el suyo;
  - en otro caso: si `nueva` no tiene heredado se inserta; si ya lo tiene, se **recalcula y reemplaza** sobre la misma fila (importe, motivo, fecha, origen y `registradoPor`). Así, si se reabre la temporada antigua para corregir algo y se vuelve a activar la nueva, el heredado queda al día. Refinamiento: si el heredado existente tiene un origen distinto de `anterior` (p. ej. A→B→C→A→C, donde C ya hereda de B), no se toca, para no perder el bote de su origen.
- **P3 — El heredado cuenta siempre en `boteJornadaAjustado`, sea cual sea su fecha.** Las jornadas no están obligadas a caer dentro de `[fechaInicio, fechaFin]` y `PUT /temporadas/:codigo` puede mover `fechaInicio` después de crear el heredado; sin esta regla una jornada temprana perdería el bote arrastrado. Regla SQL: `fecha <= fecha(J) OR origen_temporada_id IS NOT NULL`.
- **P4 — Solo se crean y borran ajustes de la temporada activa (409 `CONFLICT` en otro caso).** Si se pudieran tocar ajustes de una temporada cerrada, el heredado de la siguiente quedaría desfasado sin aviso. Alternativa descartada: permitirlo y recalcular en cascada los heredados posteriores. Para corregir una temporada cerrada: reactivarla, corregir y volver a activar la nueva (P2 recalcula el heredado).
- **P5 — El heredado no se puede borrar desde la API (409).** No existe PUT de ajustes, así que tampoco se puede editar. Solo lo gestiona `activate`.
- **P6 — Borrar una temporada borra su propio heredado** (en la misma transacción). Siguen bloqueando con 409 las jornadas, los ajustes manuales y el ser origen del heredado de otra temporada. Sin esto, una temporada activada por error no se podría borrar nunca (P4/P5 impiden quitar el heredado).
- **P7 — Forma de la API de ajustes**: `GET /ajustes-bote?temporada=AAAA-AA` y `POST /ajustes-bote` con `temporada` (código) opcional en el body, igual que `POST /calculos` y `GET /dashboard/*` (no se acepta `temporadaId` en la entrada). Las respuestas incluyen `temporadaId` y `origenTemporadaId` (null en los manuales).
- **P8 — Un único cálculo del bote**: `dashboardRepository.boteTemporada(temporadaId, tx)` (ajustes + resultados, redondeado a céntimos) lo usan `boteTotal` y el heredado. Así el heredado coincide por construcción con el `boteTotal` final de la temporada anterior (fijado con test). Se elimina la copia muerta de `sumaAjustesBote` en `ajustes-bote.repository.ts:37`.
- **P9 — D5 ya está implementado** (`calculos.service.ts:76-78` lanza `ConflictError` si la temporada no está activa, con test en `tests/integration/calculos.test.ts:159`). Solo se hace explícito el mensaje y se fija con un test que comprueba que la liquidación guardada no cambia. No se bloquean `PUT /jornadas/:n/resultados` ni las apuestas de temporadas cerradas: no alteran `resultados_miembro` mientras el recálculo esté bloqueado, y `DELETE /jornadas/:n` y `DELETE /resultados` ya están bloqueados para jornadas con resultados/calculadas. Queda como riesgo documentado.
- **P10 — No se valida que la fecha de un ajuste caiga dentro de la temporada.** Producción ya tiene ajustes manuales (p. ej. un "bote heredado" manual, commit e3af0cf) que pueden estar fechados antes de `fechaInicio`. El comportamiento queda fijado con tests (Task 4).
- **P11 — `scripts/carga/temporadas.ts` sigue activando con `temporadasRepository.activate`** (sin heredado). Es una carga masiva inicial y no debe inventar ajustes.

## Mapa de archivos

| Archivo                                                         | Acción                        | Responsabilidad                                                                                                      |
| --------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/db/schema/ajustes_bote.ts`                                 | Modificar                     | Columnas `temporada_id`, `origen_temporada_id`, índice único parcial y check                                         |
| `drizzle/0010_bote_por_temporada.sql`                           | Crear (generado + editado)    | Migración con backfill y fallo explícito                                                                             |
| `drizzle/meta/0010_snapshot.json`, `drizzle/meta/_journal.json` | Crear / modificar (generados) | Estado de drizzle-kit                                                                                                |
| `src/modules/ajustes-bote/ajustes-bote.repository.ts`           | Modificar                     | Tipos con temporada; `findByTemporada`, `findHeredado`, `updateHeredado`, `removeHeredado`; quitar `sumaAjustesBote` |
| `src/modules/ajustes-bote/ajustes-bote.service.ts`              | Modificar                     | Resolución de temporada, 409 en temporadas no activas y en heredado                                                  |
| `src/modules/ajustes-bote/ajustes-bote.schemas.ts`              | Modificar                     | `temporada` en el body, query `?temporada`, respuesta con `temporadaId`/`origenTemporadaId`                          |
| `src/modules/ajustes-bote/ajustes-bote.controller.ts`           | Modificar                     | Pasar `?temporada` a `findAll`                                                                                       |
| `src/modules/ajustes-bote/ajustes-bote.routes.ts`               | Modificar                     | Validar query del GET                                                                                                |
| `src/modules/ajustes-bote/ajustes-bote.openapi.ts`              | Modificar                     | Contrato                                                                                                             |
| `src/modules/dashboard/dashboard.repository.ts`                 | Modificar                     | `sumaAjustesBote(filtros)`, `boteTemporada`, filtro `hastaNumeroJornada`                                             |
| `src/modules/dashboard/dashboard.service.ts`                    | Modificar                     | `boteTotal` por temporada; `boteJornadaAjustado`                                                                     |
| `src/modules/dashboard/dashboard.schemas.ts`                    | Modificar                     | Campo `boteJornadaAjustado`                                                                                          |
| `src/modules/dashboard/dashboard.openapi.ts`                    | Modificar                     | Ejemplos y descripciones                                                                                             |
| `src/modules/temporadas/temporadas.service.ts`                  | Modificar                     | Heredado en `activate`; `remove` borra el heredado propio                                                            |
| `src/modules/temporadas/temporadas.controller.ts`               | Modificar                     | `activate` pasa `userId` (el heredado necesita `registrado_por`)                                                     |
| `src/modules/temporadas/temporadas.openapi.ts`                  | Modificar                     | Descripciones de activar y borrar                                                                                    |
| `src/modules/calculos/calculos.service.ts`                      | Modificar (línea 77)          | Mensaje explícito                                                                                                    |
| `src/modules/calculos/calculos.openapi.ts`                      | Modificar                     | Descripción del 409                                                                                                  |
| `openapi/openapi.json`                                          | Regenerar                     | Contrato publicado                                                                                                   |
| `tests/integration/ajustes-bote.test.ts`                        | Modificar                     | Tests de API por temporada y heredado                                                                                |
| `tests/integration/dashboard.test.ts`                           | Modificar                     | `boteTotal` por temporada, `boteJornadaAjustado`                                                                     |
| `tests/integration/temporadas.test.ts`                          | Modificar                     | Heredado al activar y borrado de temporadas                                                                          |
| `tests/integration/calculos.test.ts`                            | Modificar                     | Recálculo bloqueado                                                                                                  |

---

### Task 1: Los ajustes de bote pertenecen a una temporada (schema + migración con backfill)

**Files:**

- Modify: `src/db/schema/ajustes_bote.ts` (archivo completo)
- Create: `drizzle/0010_bote_por_temporada.sql` (generado y luego reescrito), `drizzle/meta/0010_snapshot.json` (generado)
- Modify: `drizzle/meta/_journal.json` (generado)
- Modify: `src/modules/ajustes-bote/ajustes-bote.repository.ts:5-15` (tipos)
- Modify: `src/modules/ajustes-bote/ajustes-bote.service.ts` (`toResponse`, `create`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.schemas.ts:21-28` (`AjusteBoteResponseSchema`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.openapi.ts:18-23,30-31` (ejemplo y descripción)
- Modify: `tests/integration/ajustes-bote.test.ts` (archivo completo)
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: `temporadasService.resolveTemporada(codigo?: string, tx?: DbOrTx): Promise<TemporadaFila>` (lanza `NotFoundError("No hay ninguna temporada activa.")`).
- Produces:

  ```ts
  export interface AjusteBoteInput {
    importe: number;
    motivo: string;
    fecha: string;
    temporadaId: string;
    origenTemporadaId?: string | null;
    registradoPor: string;
  }
  export interface AjusteBoteFila {
    id: string;
    importe: number;
    motivo: string;
    fecha: string;
    temporadaId: string;
    origenTemporadaId: string | null;
    registradoPor: string;
    createdAt: Date;
  }
  // Respuesta HTTP: { id, temporadaId, origenTemporadaId, importe, motivo, fecha, registradoPor, createdAt }
  ```

- [ ] **Step 1: Escribir los tests que fallan.** Reemplazar `tests/integration/ajustes-bote.test.ts` completo por:

```ts
import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

function ajusteBoteBody(overrides: { importe?: number; motivo?: string; fecha?: string } = {}) {
  return {
    importe: overrides.importe ?? -25,
    motivo: overrides.motivo ?? "Corrección por error en el cálculo de la jornada 3",
    fecha: overrides.fecha ?? "2026-09-01",
  };
}

interface OpcionesTemporada {
  fechaInicio?: string;
  fechaFin?: string;
  activar?: boolean;
}

async function crearTemporada(
  header: Record<string, string>,
  codigo = "2026-27",
  opciones: OpcionesTemporada = {},
): Promise<string> {
  const creada = await request(app)
    .post("/api/v1/temporadas")
    .set(header)
    .send({
      codigo,
      nombre: `Temporada ${codigo}`,
      fechaInicio: opciones.fechaInicio ?? "2026-08-15",
      fechaFin: opciones.fechaFin ?? "2027-05-30",
    });
  if (opciones.activar ?? true) {
    await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
  }
  return creada.body.id as string;
}

describe("POST /api/v1/ajustes-bote", () => {
  test("válido (admin), importe negativo -> 201 en la temporada activa", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    const temporadaId = await crearTemporada(header);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe(`/api/v1/ajustes-bote/${response.body.id}`);
    expect(response.body.importe).toBe(-25);
    expect(response.body.registradoPor).toBe(admin.id);
    expect(response.body.temporadaId).toBe(temporadaId);
    expect(response.body.origenTemporadaId).toBeNull();
    expectMatchesOpenApiSchema({
      path: "/ajustes-bote",
      method: "post",
      status: 201,
      body: response.body,
    });
  });

  test("válido (admin), importe positivo -> 201", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: 30 }));

    expect(response.status).toBe(201);
    expect(response.body.importe).toBe(30);
  });

  test("sin temporada activa -> 404", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header, "2026-27", { activar: false });

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody());

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("NOT_FOUND");
  });

  test("como user -> 403", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(await authHeader(user))
      .send(ajusteBoteBody());

    expect(response.status).toBe(403);
  });

  test("sin token -> 401", async () => {
    const response = await request(app).post("/api/v1/ajustes-bote").send(ajusteBoteBody());
    expect(response.status).toBe(401);
  });

  test("importe con más de 2 decimales -> 400", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: 10.999 }));

    expect(response.status).toBe(400);
  });

  test("motivo vacío -> 400", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ motivo: "" }));

    expect(response.status).toBe(400);
  });

  test("fecha con formato inválido -> 400", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ fecha: "01-09-2026" }));

    expect(response.status).toBe(400);
  });
});

describe("GET /api/v1/ajustes-bote", () => {
  test("como user -> 200, transparencia total", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header);
    await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: 15 }));

    const user = await createUser();
    const response = await request(app)
      .get("/api/v1/ajustes-bote")
      .set(await authHeader(user));

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
    expectMatchesOpenApiSchema({
      path: "/ajustes-bote",
      method: "get",
      status: 200,
      body: response.body,
    });
  });

  test("sin token -> 401", async () => {
    const response = await request(app).get("/api/v1/ajustes-bote");
    expect(response.status).toBe(401);
  });
});

describe("DELETE /api/v1/ajustes-bote/:id", () => {
  test("(admin) -> 204", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header);
    const creado = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody());

    const response = await request(app)
      .delete(`/api/v1/ajustes-bote/${creado.body.id}`)
      .set(header);
    expect(response.status).toBe(204);

    const lista = await request(app).get("/api/v1/ajustes-bote").set(header);
    expect(lista.body).toHaveLength(0);
  });

  test("como user -> 403", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header);
    const creado = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody());

    const user = await createUser();
    const response = await request(app)
      .delete(`/api/v1/ajustes-bote/${creado.body.id}`)
      .set(await authHeader(user));

    expect(response.status).toBe(403);
  });

  test("inexistente -> 404", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app)
      .delete("/api/v1/ajustes-bote/019ffc0e-0000-7c46-b05d-000000000000")
      .set(header);

    expect(response.status).toBe(404);
  });
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/ajustes-bote.test.ts`
Expected: FAIL en "válido (admin), importe negativo -> 201 en la temporada activa" (`temporadaId` es `undefined`) y en "sin temporada activa -> 404" (recibe 201).

- [ ] **Step 3: Schema Drizzle.** Reemplazar `src/db/schema/ajustes_bote.ts` completo por:

```ts
import { sql } from "drizzle-orm";
import {
  check,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { temporadas } from "./temporadas.js";
import { users } from "./users.js";

export const ajustesBote = pgTable(
  "ajustes_bote",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    temporadaId: uuid("temporada_id")
      .notNull()
      .references(() => temporadas.id, { onDelete: "restrict" }),
    // NULL = ajuste manual; no NULL = bote heredado de esa temporada (lo crea POST /temporadas/:codigo/activar).
    origenTemporadaId: uuid("origen_temporada_id").references(() => temporadas.id, {
      onDelete: "restrict",
    }),
    importe: numeric("importe", { precision: 12, scale: 2, mode: "number" }).notNull(),
    motivo: text("motivo").notNull(),
    fecha: date("fecha").notNull(),
    registradoPor: uuid("registrado_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ajustes_bote_un_heredado_por_temporada")
      .on(t.temporadaId)
      .where(sql`${t.origenTemporadaId} is not null`),
    check("ajustes_bote_origen_distinto_check", sql`${t.origenTemporadaId} <> ${t.temporadaId}`),
  ],
);
```

- [ ] **Step 4: Generar la migración.** `drizzle-kit generate` solo compara snapshots, no se conecta a la BD.

Run: `npm run db:generate -- --name=bote_por_temporada`
Expected: crea `drizzle/0010_bote_por_temporada.sql`, `drizzle/meta/0010_snapshot.json` y añade la entrada `"tag": "0010_bote_por_temporada"` a `drizzle/meta/_journal.json`. La SQL generada contiene `ADD COLUMN "temporada_id" uuid NOT NULL`, que fallaría con filas existentes.

- [ ] **Step 5: Reescribir la SQL con el backfill.** Abrir `drizzle/0010_bote_por_temporada.sql`, comprobar que los nombres de las FKs, del índice y del check generados coinciden con los de abajo (si drizzle-kit hubiera generado otro nombre, usar el generado en la línea correspondiente para que el snapshot siga siendo fiel) y reemplazar el contenido completo por:

```sql
ALTER TABLE "ajustes_bote" ADD COLUMN "temporada_id" uuid;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD COLUMN "origen_temporada_id" uuid;--> statement-breakpoint
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "ajustes_bote")
       AND NOT EXISTS (SELECT 1 FROM "temporadas" WHERE "activa") THEN
        RAISE EXCEPTION 'Migración 0010: hay ajustes de bote pero ninguna temporada activa a la que asignarlos. Activa una temporada y vuelve a migrar.';
    END IF;
END $$;--> statement-breakpoint
UPDATE "ajustes_bote" SET "temporada_id" = (SELECT "id" FROM "temporadas" WHERE "activa") WHERE "temporada_id" IS NULL;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ALTER COLUMN "temporada_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_temporada_id_temporadas_id_fk" FOREIGN KEY ("temporada_id") REFERENCES "public"."temporadas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_origen_temporada_id_temporadas_id_fk" FOREIGN KEY ("origen_temporada_id") REFERENCES "public"."temporadas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ajustes_bote_un_heredado_por_temporada" ON "ajustes_bote" USING btree ("temporada_id") WHERE "ajustes_bote"."origen_temporada_id" is not null;--> statement-breakpoint
ALTER TABLE "ajustes_bote" ADD CONSTRAINT "ajustes_bote_origen_distinto_check" CHECK ("ajustes_bote"."origen_temporada_id" <> "ajustes_bote"."temporada_id");
```

Notas: el índice único parcial `temporadas_una_activa` garantiza que la subconsulta devuelve como mucho una fila. El migrador de drizzle aplica todas las migraciones pendientes en una sola transacción, así que el `RAISE EXCEPTION` deja la BD intacta.

- [ ] **Step 6: Comprobar que el snapshot sigue siendo coherente.**

Run: `npm run db:generate -- --name=comprobacion`
Expected: `No schema changes, nothing to migrate 😴` y ningún archivo nuevo en `drizzle/`. Si se crease un `0011_comprobacion.sql`, borrarlo junto con su snapshot y su entrada del journal: significa que el schema y la SQL no coinciden, y hay que revisar el Step 5.

- [ ] **Step 7: Repositorio.** En `src/modules/ajustes-bote/ajustes-bote.repository.ts`, sustituir las interfaces (líneas 5-15) por:

```ts
export interface AjusteBoteInput {
  importe: number;
  motivo: string;
  fecha: string;
  temporadaId: string;
  origenTemporadaId?: string | null;
  registradoPor: string;
}

export interface AjusteBoteFila {
  id: string;
  importe: number;
  motivo: string;
  fecha: string;
  temporadaId: string;
  origenTemporadaId: string | null;
  registradoPor: string;
  createdAt: Date;
}
```

El resto del archivo no cambia en esta tarea.

- [ ] **Step 8: Servicio.** Reemplazar `src/modules/ajustes-bote/ajustes-bote.service.ts` completo por:

```ts
import { NotFoundError } from "../../core/errors.js";
import * as ajustesBoteRepository from "./ajustes-bote.repository.js";
import type { AjusteBoteFila } from "./ajustes-bote.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import type { CreateAjusteBoteInput } from "./ajustes-bote.schemas.js";

function toResponse(fila: AjusteBoteFila) {
  return {
    id: fila.id,
    temporadaId: fila.temporadaId,
    origenTemporadaId: fila.origenTemporadaId,
    importe: fila.importe,
    motivo: fila.motivo,
    fecha: fila.fecha,
    registradoPor: fila.registradoPor,
    createdAt: fila.createdAt,
  };
}

export async function create(input: CreateAjusteBoteInput, registradoPor: string) {
  const temporada = await temporadasService.resolveTemporada();
  const fila = await ajustesBoteRepository.create({
    importe: input.importe,
    motivo: input.motivo,
    fecha: input.fecha,
    temporadaId: temporada.id,
    registradoPor,
  });
  return toResponse(fila);
}

export async function findAll() {
  const filas = await ajustesBoteRepository.findAll();
  return filas.map(toResponse);
}

export async function remove(id: string) {
  const existente = await ajustesBoteRepository.findById(id);
  if (!existente) {
    throw new NotFoundError(`No existe el ajuste de bote ${id}.`);
  }
  await ajustesBoteRepository.remove(id);
}
```

- [ ] **Step 9: Schema de respuesta.** En `src/modules/ajustes-bote/ajustes-bote.schemas.ts`, reemplazar `AjusteBoteResponseSchema` por:

```ts
export const AjusteBoteResponseSchema = z.object({
  id: z.uuid(),
  temporadaId: z.uuid(),
  origenTemporadaId: z.uuid().nullable(),
  importe: importeConSigno,
  motivo: z.string(),
  fecha: z.iso.date(),
  registradoPor: z.uuid(),
  createdAt: z.iso.datetime(),
});
```

- [ ] **Step 10: Ejemplo y descripción OpenAPI.** En `src/modules/ajustes-bote/ajustes-bote.openapi.ts`, reemplazar `ajusteBoteEjemplo` por:

```ts
const ajusteBoteEjemplo = {
  id: "019ffc0e-bbbb-7c46-b05d-46bf7829c803",
  temporadaId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
  origenTemporadaId: null,
  ...createAjusteBoteEjemplo,
  registradoPor: "019ff7eb-9999-7b8c-a948-6ca9a14625e6",
  createdAt: "2026-09-01T10:00:00.000Z",
};
```

y la `description` del `post` por:

```ts
        description:
            "Ajuste manual que suma o resta al bote de la temporada activa. El importe admite valores negativos.",
```

y añadir a sus `responses`:

```ts
            "404": { description: "No hay ninguna temporada activa." },
```

- [ ] **Step 11: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/ajustes-bote.test.ts tests/integration/dashboard.test.ts tests/integration/temporadas.test.ts`
Expected: PASS (el test existente de dashboard con ajuste sigue en verde porque su temporada está activa).

- [ ] **Step 12: Commit.**

```bash
git add src/db/schema/ajustes_bote.ts drizzle/0010_bote_por_temporada.sql drizzle/meta/0010_snapshot.json drizzle/meta/_journal.json src/modules/ajustes-bote/ajustes-bote.repository.ts src/modules/ajustes-bote/ajustes-bote.service.ts src/modules/ajustes-bote/ajustes-bote.schemas.ts src/modules/ajustes-bote/ajustes-bote.openapi.ts openapi/openapi.json tests/integration/ajustes-bote.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat: los ajustes de bote pertenecen a una temporada (migración con backfill a la activa)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: API de ajustes por temporada (listado filtrable, temporada explícita, solo la activa es editable)

**Files:**

- Modify: `src/modules/ajustes-bote/ajustes-bote.schemas.ts` (body y query)
- Modify: `src/modules/ajustes-bote/ajustes-bote.repository.ts` (`findAll` → `findByTemporada`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.service.ts` (`create`, `findAll`, `remove`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.controller.ts:22-25` (`findAll`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.routes.ts:19` (GET)
- Modify: `src/modules/ajustes-bote/ajustes-bote.openapi.ts` (archivo completo)
- Modify: `tests/integration/ajustes-bote.test.ts` (añadir un `describe` al final)
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: `temporadasService.resolveTemporada(codigo?: string)`, `temporadasRepository.findActiva(tx?: DbOrTx)`.
- Produces:

  ```ts
  export const AjustesBoteQuerySchema: z.ZodObject<{
    temporada: z.ZodOptional<typeof codigoTemporada>;
  }>;
  export type AjustesBoteQuery = { temporada?: string | undefined };
  // CreateAjusteBoteInput gana `temporada?: string | undefined`
  export async function findByTemporada(
    temporadaId: string,
    tx?: DbOrTx,
  ): Promise<AjusteBoteFila[]>; // repo, orden fecha ASC, createdAt ASC
  export async function create(
    input: CreateAjusteBoteInput,
    registradoPor: string,
  ): Promise<AjusteBoteResponse>; // 404 / 409
  export async function findAll(temporadaCodigo?: string): Promise<AjusteBoteResponse[]>; // 404
  export async function remove(id: string): Promise<void>; // 404 / 409
  ```

- [ ] **Step 1: Escribir los tests que fallan.** Añadir al final de `tests/integration/ajustes-bote.test.ts`:

```ts
describe("Ajustes de bote por temporada", () => {
  // 2025-26 empieza antes que 2026-27: activarla después NO genera bote heredado,
  // así estos tests no dependen de la lógica de herencia (Task 5).
  async function dosTemporadasConAjustes(header: Record<string, string>) {
    await crearTemporada(header, "2026-27");
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: 15, fecha: "2026-09-01" }));
    await crearTemporada(header, "2025-26", { fechaInicio: "2025-08-15", fechaFin: "2026-05-30" });
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: -25, fecha: "2025-09-01" }));
  }

  test("GET sin ?temporada -> solo los ajustes de la temporada activa", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await dosTemporadasConAjustes(header);

    const response = await request(app).get("/api/v1/ajustes-bote").set(header);

    expect(response.status).toBe(200);
    expect(response.body.map((a: { importe: number }) => a.importe)).toEqual([-25]);
  });

  test("GET ?temporada=2026-27 -> los de esa temporada aunque no esté activa", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await dosTemporadasConAjustes(header);

    const response = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);

    expect(response.status).toBe(200);
    expect(response.body.map((a: { importe: number }) => a.importe)).toEqual([15]);
    expectMatchesOpenApiSchema({
      path: "/ajustes-bote",
      method: "get",
      status: 200,
      body: response.body,
    });
  });

  test("GET ?temporada con formato inválido -> 400", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app).get("/api/v1/ajustes-bote?temporada=2026").set(header);

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("VALIDATION_ERROR");
  });

  test("GET ?temporada inexistente -> 404", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);

    const response = await request(app).get("/api/v1/ajustes-bote?temporada=2030-31").set(header);

    expect(response.status).toBe(404);
  });

  test("GET sin temporada activa -> 404", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header, "2026-27", { activar: false });

    const response = await request(app).get("/api/v1/ajustes-bote").set(header);

    expect(response.status).toBe(404);
  });

  test("POST con la temporada activa explícita -> 201 en esa temporada", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    const temporadaId = await crearTemporada(header, "2026-27");

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send({ ...ajusteBoteBody(), temporada: "2026-27" });

    expect(response.status).toBe(201);
    expect(response.body.temporadaId).toBe(temporadaId);
  });

  test("POST con una temporada no activa -> 409", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await dosTemporadasConAjustes(header);

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send({ ...ajusteBoteBody(), temporada: "2026-27" });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe("CONFLICT");
    expect(response.body.message).toBe(
      "La temporada '2026-27' no está activa: solo se registran ajustes de bote en la temporada activa.",
    );
  });

  test("POST con una temporada inexistente -> 404", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header, "2026-27");

    const response = await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send({ ...ajusteBoteBody(), temporada: "2030-31" });

    expect(response.status).toBe(404);
  });

  test("DELETE de un ajuste de una temporada no activa -> 409 y el ajuste sigue", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await dosTemporadasConAjustes(header);
    const lista = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);
    const id = lista.body[0].id as string;

    const response = await request(app).delete(`/api/v1/ajustes-bote/${id}`).set(header);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "Solo se pueden borrar ajustes de bote de la temporada activa.",
    );
    const despues = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);
    expect(despues.body).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/ajustes-bote.test.ts`
Expected: FAIL en los 9 tests nuevos (el GET devuelve los dos ajustes, el body con `temporada` da 400 por `.strict()`, el DELETE devuelve 204).

- [ ] **Step 3: Schemas.** En `src/modules/ajustes-bote/ajustes-bote.schemas.ts`, añadir el import y sustituir `CreateAjusteBoteSchema`; añadir el schema de query debajo de `AjusteBoteIdParam`:

```ts
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";
```

```ts
export const CreateAjusteBoteSchema = z
  .object({
    importe: importeConSigno,
    motivo: z.string().min(1, "El motivo no puede estar vacío."),
    fecha: z.iso.date(),
    temporada: codigoTemporada.optional(),
  })
  .strict();
```

```ts
export const AjustesBoteQuerySchema = z.object({
  temporada: codigoTemporada.optional(),
});

export type AjustesBoteQuery = z.infer<typeof AjustesBoteQuerySchema>;
```

- [ ] **Step 4: Repositorio.** En `src/modules/ajustes-bote/ajustes-bote.repository.ts`, cambiar el import de `drizzle-orm` a `import { asc, eq, sql } from "drizzle-orm";` y sustituir `findAll` por:

```ts
export async function findByTemporada(
  temporadaId: string,
  tx: DbOrTx = db,
): Promise<AjusteBoteFila[]> {
  return tx
    .select()
    .from(ajustesBote)
    .where(eq(ajustesBote.temporadaId, temporadaId))
    .orderBy(asc(ajustesBote.fecha), asc(ajustesBote.createdAt));
}
```

- [ ] **Step 5: Servicio.** En `src/modules/ajustes-bote/ajustes-bote.service.ts`, cambiar los imports de cabecera a:

```ts
import { ConflictError, NotFoundError } from "../../core/errors.js";
import * as ajustesBoteRepository from "./ajustes-bote.repository.js";
import type { AjusteBoteFila } from "./ajustes-bote.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as temporadasRepository from "../temporadas/temporadas.repository.js";
import type { CreateAjusteBoteInput } from "./ajustes-bote.schemas.js";
```

y sustituir `create`, `findAll` y `remove` por:

```ts
export async function create(input: CreateAjusteBoteInput, registradoPor: string) {
  const temporada = await temporadasService.resolveTemporada(input.temporada);
  if (!temporada.activa) {
    throw new ConflictError(
      `La temporada '${temporada.codigo}' no está activa: solo se registran ajustes de bote en la temporada activa.`,
    );
  }
  const fila = await ajustesBoteRepository.create({
    importe: input.importe,
    motivo: input.motivo,
    fecha: input.fecha,
    temporadaId: temporada.id,
    registradoPor,
  });
  return toResponse(fila);
}

export async function findAll(temporadaCodigo?: string) {
  const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
  const filas = await ajustesBoteRepository.findByTemporada(temporada.id);
  return filas.map(toResponse);
}

export async function remove(id: string) {
  const existente = await ajustesBoteRepository.findById(id);
  if (!existente) {
    throw new NotFoundError(`No existe el ajuste de bote ${id}.`);
  }
  const activa = await temporadasRepository.findActiva();
  if (activa?.id !== existente.temporadaId) {
    throw new ConflictError("Solo se pueden borrar ajustes de bote de la temporada activa.");
  }
  await ajustesBoteRepository.remove(id);
}
```

- [ ] **Step 6: Controller y ruta.** En `src/modules/ajustes-bote/ajustes-bote.controller.ts`, cambiar el import de tipos a `import type { CreateAjusteBoteInput, AjusteBoteIdParam, AjustesBoteQuery } from "./ajustes-bote.schemas.js";` y sustituir `findAll` por:

```ts
export async function findAll(req: Request, res: Response): Promise<void> {
  const { temporada } = req.query as unknown as AjustesBoteQuery;
  const lista = await ajustesBoteService.findAll(temporada);
  res.status(200).json(lista);
}
```

En `src/modules/ajustes-bote/ajustes-bote.routes.ts`, cambiar el import de schemas a `import { CreateAjusteBoteSchema, AjusteBoteIdParamSchema, AjustesBoteQuerySchema } from "./ajustes-bote.schemas.js";` y la línea del GET a:

```ts
ajustesBoteRouter.get("/", requireAuth, validate({ query: AjustesBoteQuerySchema }), findAll);
```

- [ ] **Step 7: OpenAPI.** Reemplazar `src/modules/ajustes-bote/ajustes-bote.openapi.ts` completo por:

```ts
import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import { CreateAjusteBoteSchema, AjusteBoteResponseSchema } from "./ajustes-bote.schemas.js";

const idParam = {
  name: "id",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const, format: "uuid" },
};

const temporadaQueryParam = {
  name: "temporada",
  in: "query" as const,
  required: false,
  schema: { type: "string" as const, pattern: "^\\d{4}-\\d{2}$" },
  example: "2026-27",
};

const createAjusteBoteEjemplo = {
  importe: -25.0,
  motivo: "Corrección por error en el cálculo de la jornada 3",
  fecha: "2026-09-01",
};

const ajusteBoteEjemplo = {
  id: "019ffc0e-bbbb-7c46-b05d-46bf7829c803",
  temporadaId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
  origenTemporadaId: null,
  ...createAjusteBoteEjemplo,
  registradoPor: "019ff7eb-9999-7b8c-a948-6ca9a14625e6",
  createdAt: "2026-09-01T10:00:00.000Z",
};

const boteHeredadoEjemplo = {
  id: "019ffc0e-cccc-7c46-b05d-46bf7829c804",
  temporadaId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
  origenTemporadaId: "019ff7eb-1111-7b8c-a948-6ca9a14625e5",
  importe: 123.45,
  motivo: "Bote heredado de 2025-26",
  fecha: "2026-08-15",
  registradoPor: "019ff7eb-9999-7b8c-a948-6ca9a14625e6",
  createdAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/ajustes-bote", {
  post: {
    operationId: "ajustesBoteCreate",
    summary: "Registra un ajuste manual del bote",
    description:
      "Ajuste manual que suma o resta al bote de una temporada. Sin 'temporada' en el body se usa la activa; solo se admiten ajustes en la temporada activa. El importe admite valores negativos.",
    tags: ["ajustes-bote"],
    security: [{ bearerAuth: [] }],
    "x-required-role": "admin",
    requestBody: {
      required: true,
      content: {
        "application/json": { schema: CreateAjusteBoteSchema, example: createAjusteBoteEjemplo },
      },
    },
    responses: {
      "201": {
        description: "Ajuste de bote registrado.",
        headers: {
          Location: { description: "/api/v1/ajustes-bote/{id}", schema: { type: "string" } },
        },
        content: {
          "application/json": { schema: AjusteBoteResponseSchema, example: ajusteBoteEjemplo },
        },
      },
      "400": {
        description:
          "importe con más de 2 decimales, motivo vacío, fecha o temporada con formato inválido.",
      },
      "401": { description: "Sin access token válido." },
      "403": { description: "El usuario autenticado no es admin." },
      "404": {
        description:
          "No existe esa temporada, o no hay temporada activa y no se especificó ninguna.",
      },
      "409": { description: "La temporada indicada no es la activa." },
    },
  },
  get: {
    operationId: "ajustesBoteFindAll",
    summary: "Lista los ajustes de bote de una temporada",
    description:
      "Sin '?temporada=', lista los de la temporada activa. Incluye el bote heredado (origenTemporadaId no nulo). Disponible para cualquier usuario autenticado, como parte de la transparencia de la clasificación.",
    tags: ["ajustes-bote"],
    security: [{ bearerAuth: [] }],
    parameters: [temporadaQueryParam],
    responses: {
      "200": {
        description: "Ajustes de bote de la temporada, ordenados por fecha.",
        content: {
          "application/json": {
            schema: z.array(AjusteBoteResponseSchema),
            example: [boteHeredadoEjemplo, ajusteBoteEjemplo],
          },
        },
      },
      "400": { description: "'temporada' con formato inválido." },
      "401": { description: "Sin access token válido." },
      "404": {
        description:
          "No existe esa temporada, o no hay temporada activa y no se especificó ninguna.",
      },
    },
  },
});

registerPath("/ajustes-bote/{id}", {
  delete: {
    operationId: "ajustesBoteRemove",
    summary: "Elimina un ajuste de bote",
    description:
      "Un ajuste mal apuntado se borra y se vuelve a crear; no existe PUT. Solo ajustes de la temporada activa.",
    tags: ["ajustes-bote"],
    security: [{ bearerAuth: [] }],
    "x-required-role": "admin",
    parameters: [idParam],
    responses: {
      "204": { description: "Ajuste de bote eliminado." },
      "401": { description: "Sin access token válido." },
      "403": { description: "El usuario autenticado no es admin." },
      "404": { description: "No existe ese ajuste de bote." },
      "409": { description: "El ajuste pertenece a una temporada que no es la activa." },
    },
  },
});
```

- [ ] **Step 8: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/ajustes-bote.test.ts tests/integration/dashboard.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add src/modules/ajustes-bote/ajustes-bote.schemas.ts src/modules/ajustes-bote/ajustes-bote.repository.ts src/modules/ajustes-bote/ajustes-bote.service.ts src/modules/ajustes-bote/ajustes-bote.controller.ts src/modules/ajustes-bote/ajustes-bote.routes.ts src/modules/ajustes-bote/ajustes-bote.openapi.ts openapi/openapi.json tests/integration/ajustes-bote.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat: ajustes de bote filtrables por temporada y editables solo en la activa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: boteTotal suma solo los ajustes de su temporada (y redondea a céntimos)

**Files:**

- Modify: `src/modules/dashboard/dashboard.repository.ts:71-75` (`sumaAjustesBote`) y añadir `boteTemporada`
- Modify: `src/modules/dashboard/dashboard.service.ts:94-115` (`temporada`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.repository.ts:37-41` (borrar la copia muerta de `sumaAjustesBote` y el import `sql`)
- Modify: `tests/integration/dashboard.test.ts` (helper nuevo, renombrar el test de la línea 291, dos tests nuevos)

**Interfaces:**

- Consumes: `agregados(filtros: AgregadosFiltros, tx?: DbOrTx): Promise<Agregados>`.
- Produces:

  ```ts
  export interface AjustesBoteFiltros {
    temporadaId: string;
  }
  export async function sumaAjustesBote(filtros: AjustesBoteFiltros, tx?: DbOrTx): Promise<number>;
  export async function boteTemporada(temporadaId: string, tx?: DbOrTx): Promise<number>; // ajustes + resultados, redondeado a céntimos
  ```

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/integration/dashboard.test.ts`, añadir este helper debajo de `crearTemporada` (línea 26):

```ts
async function crearYActivarTemporada(
  header: Record<string, string>,
  codigo: string,
  fechaInicio: string,
  fechaFin: string,
) {
  await request(app)
    .post("/api/v1/temporadas")
    .set(header)
    .send({ codigo, nombre: `Temporada ${codigo}`, fechaInicio, fechaFin });
  await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
}
```

Renombrar el test de la línea 291 a `"con un ajuste de bote de la temporada -> boteTotal = sumaBote + ajuste"` (cuerpo sin cambios) y añadir dentro de `describe("GET /api/v1/dashboard/temporada", ...)`, antes de `"sin temporada activa -> 404"`:

```ts
test("boteTotal solo suma los ajustes de su propia temporada", async () => {
  const admin = await createAdmin();
  const adminHeader = await authHeader(admin);
  await crearYActivarTemporada(adminHeader, "2026-27", "2026-08-15", "2027-05-30");
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(adminHeader)
    .send({ importe: 7, motivo: "Ajuste de 2026-27", fecha: "2026-09-01" });
  // 2025-26 empieza antes: activarla no genera bote heredado.
  await crearYActivarTemporada(adminHeader, "2025-26", "2025-08-15", "2026-05-30");
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(adminHeader)
    .send({ importe: 3, motivo: "Ajuste de 2025-26", fecha: "2025-09-01" });

  const activa = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);
  const otra = await request(app)
    .get("/api/v1/dashboard/temporada?temporada=2026-27")
    .set(adminHeader);

  expect(activa.status).toBe(200);
  expect(activa.body.temporada).toBe("2025-26");
  expect(activa.body.boteTotal).toBe(3);
  expect(otra.status).toBe(200);
  expect(otra.body.boteTotal).toBe(7);
});

test("ajuste con decimales -> boteTotal redondeado a céntimos", async () => {
  const admin = await createAdmin();
  const adminHeader = await authHeader(admin);
  const userA = await createUser();
  const userB = await createUser();
  const userC = await createUser();
  // Bote de la jornada: 0.90 + 0.90 + 1.00 = 2.80
  await prepararJornadaConTresMiembros(
    adminHeader,
    await authHeader(userA),
    await authHeader(userB),
    await authHeader(userC),
  );
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(adminHeader)
    .send({ importe: 10.1, motivo: "Bote heredado manual", fecha: "2026-08-15" });

  const response = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

  expect(response.status).toBe(200);
  expect(response.body.boteTotal).toBe(12.9);
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/dashboard.test.ts`
Expected: FAIL en "boteTotal solo suma los ajustes de su propia temporada" (`boteTotal` es 10 en las dos temporadas). "ajuste con decimales" falla con `12.899999999999999` (si la aritmética de punto flotante del entorno diese justo 12.9, el rojo de la tarea lo pone el test anterior).

- [ ] **Step 3: Repositorio del dashboard.** En `src/modules/dashboard/dashboard.repository.ts`, sustituir `sumaAjustesBote` (líneas 71-75) por:

```ts
export interface AjustesBoteFiltros {
  temporadaId: string;
}

export async function sumaAjustesBote(
  filtros: AjustesBoteFiltros,
  tx: DbOrTx = db,
): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${ajustesBote.importe}), 0)` })
    .from(ajustesBote)
    .where(eq(ajustesBote.temporadaId, filtros.temporadaId));
  /* v8 ignore next -- @preserve */
  return row ? Number(row.total) : 0;
}

// Bote de una temporada: sus ajustes (incluido el heredado) + el bote de todas sus jornadas calculadas.
// Única fuente de verdad: lo usan boteTotal (dashboard) y el bote heredado (temporadas.activate).
export async function boteTemporada(temporadaId: string, tx: DbOrTx = db): Promise<number> {
  const ajustes = await sumaAjustesBote({ temporadaId }, tx);
  const { sumaBote } = await agregados({ temporadaId }, tx);
  return Math.round((ajustes + sumaBote) * 100) / 100;
}
```

- [ ] **Step 4: Servicio del dashboard.** En `src/modules/dashboard/dashboard.service.ts`, en `temporada`, borrar `const ajustesBote = await dashboardRepository.sumaAjustesBote();`, añadir tras `const agg = ...`:

```ts
const boteTotal = await dashboardRepository.boteTemporada(temporadaResuelta.id);
```

y cambiar `boteTotal: ajustesBote + agg.sumaBote,` por `boteTotal,`.

- [ ] **Step 5: Quitar la copia muerta.** En `src/modules/ajustes-bote/ajustes-bote.repository.ts`, borrar la función `sumaAjustesBote` (líneas 37-41) y cambiar el import a `import { asc, eq } from "drizzle-orm";`. Comprobar que nadie la usa:

Run: `grep -rn "ajustesBoteRepository.sumaAjustesBote" src tests scripts`
Expected: sin resultados.

- [ ] **Step 6: Ejecutar en verde.**

Run: `npm test -- tests/integration/dashboard.test.ts tests/integration/ajustes-bote.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/modules/dashboard/dashboard.repository.ts src/modules/dashboard/dashboard.service.ts src/modules/ajustes-bote/ajustes-bote.repository.ts tests/integration/dashboard.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
fix: boteTotal suma solo los ajustes de su temporada y redondea a céntimos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: GET /dashboard/jornada devuelve boteJornadaAjustado

**Files:**

- Modify: `src/modules/dashboard/dashboard.repository.ts` (`AgregadosFiltros`, `agregados`, `AjustesBoteFiltros`, `sumaAjustesBote`)
- Modify: `src/modules/dashboard/dashboard.service.ts:71-92` (`jornada`)
- Modify: `src/modules/dashboard/dashboard.schemas.ts:42-51` (`DashboardJornadaResponseSchema`)
- Modify: `src/modules/dashboard/dashboard.openapi.ts:61-70,108` (ejemplo y descripción)
- Modify: `tests/integration/dashboard.test.ts` (helper y dos tests)
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: `jornadasService.findByNumero(numero: number, temporadaCodigo?: string)` → `{ id: string; fecha: string; ... }`.
- Produces:

  ```ts
  export interface AgregadosFiltros {
    temporadaId?: string | undefined;
    jornadaId?: string | undefined;
    usuarioId?: string | undefined;
    hastaNumeroJornada?: number | undefined; // numero_jornada <= n
  }
  export interface AjustesBoteFiltros {
    temporadaId: string;
    hastaFecha?: string | undefined; // fecha <= hastaFecha OR es heredado
  }
  // Respuesta GET /dashboard/jornada gana: boteJornadaAjustado: number (importeConSigno)
  ```

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/integration/dashboard.test.ts`, añadir este helper debajo de `prepararJornadaConTresMiembros` (asume equipos creados y temporada activa):

```ts
async function calcularJornadaConTresMiembros(
  adminHeader: Record<string, string>,
  headers: [Record<string, string>, Record<string, string>, Record<string, string>],
  numeroJornada: number,
  fecha: string,
) {
  await request(app)
    .post("/api/v1/jornadas")
    .set(adminHeader)
    .send({ numeroJornada, fecha, partidos: partidosValidos() });
  await request(app).put(`/api/v1/jornadas/${numeroJornada}/fechas`).set(adminHeader).send({
    fechaAperturaApuestas: "2020-01-01T00:00:00Z",
    fechaCierreApuestas: "2099-01-01T00:00:00Z",
    fechaCierreJornada: null,
  });
  const [headerA, headerB, headerC] = headers;
  await request(app)
    .post(`/api/v1/jornadas/${numeroJornada}/apuestas`)
    .set(headerA)
    .send({ numeroApuesta: 1, partidos: partidosConAciertos(10) });
  await request(app)
    .post(`/api/v1/jornadas/${numeroJornada}/apuestas`)
    .set(headerB)
    .send({ numeroApuesta: 1, partidos: partidosConAciertos(10) });
  await request(app)
    .post(`/api/v1/jornadas/${numeroJornada}/apuestas`)
    .set(headerC)
    .send({ numeroApuesta: 1, partidos: partidosConAciertos(4) });
  await request(app)
    .put(`/api/v1/jornadas/${numeroJornada}/resultados`)
    .set(adminHeader)
    .send(resultadosBody());
  await request(app).put(`/api/v1/jornadas/${numeroJornada}/fechas`).set(adminHeader).send({
    fechaAperturaApuestas: "2020-01-01T00:00:00Z",
    fechaCierreApuestas: "2020-06-01T00:00:00Z",
    fechaCierreJornada: null,
  });
  const calculo = await request(app)
    .post("/api/v1/calculos")
    .set(adminHeader)
    .send({ jornada: numeroJornada });
  expect(calculo.status).toBe(200);
}

async function temporadaConDosJornadas() {
  const admin = await createAdmin();
  const adminHeader = await authHeader(admin);
  const headers: [Record<string, string>, Record<string, string>, Record<string, string>] = [
    await authHeader(await createUser()),
    await authHeader(await createUser()),
    await authHeader(await createUser()),
  ];
  await crearEquipos(adminHeader);
  await crearTemporada(adminHeader, "2026-27");
  return { adminHeader, headers };
}
```

y añadir dentro de `describe("GET /api/v1/dashboard/jornada", ...)`:

```ts
test("en la última jornada y sin ajustes posteriores, boteJornadaAjustado == boteTotal", async () => {
  const { adminHeader, headers } = await temporadaConDosJornadas();
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(adminHeader)
    .send({ importe: 5.55, motivo: "Bote heredado manual", fecha: "2026-08-15" });
  // Cada jornada deja 2.80 de bote (0.90 + 0.90 + 1.00).
  await calcularJornadaConTresMiembros(adminHeader, headers, 1, "2026-08-20");
  await calcularJornadaConTresMiembros(adminHeader, headers, 2, "2026-08-27");

  const jornada = await request(app).get("/api/v1/dashboard/jornada?jornada=2").set(adminHeader);
  const temporada = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

  expect(jornada.status).toBe(200);
  expect(jornada.body.boteJornada).toBe(2.8);
  expect(jornada.body.boteJornadaAjustado).toBe(11.15);
  expect(jornada.body.boteJornadaAjustado).toBe(temporada.body.boteTotal);
  expectMatchesOpenApiSchema({
    path: "/dashboard/jornada",
    method: "get",
    status: 200,
    body: jornada.body,
  });
});

test("ajustes antes del inicio, el mismo día y después de la jornada", async () => {
  const { adminHeader, headers } = await temporadaConDosJornadas();
  const ajustes = [
    { importe: 5.55, motivo: "Anterior al inicio de temporada", fecha: "2026-08-01" },
    { importe: -1.25, motivo: "Mismo día que la jornada 2", fecha: "2026-08-27" },
    { importe: 4, motivo: "Posterior a la última jornada", fecha: "2026-09-30" },
  ];
  for (const ajuste of ajustes) {
    await request(app).post("/api/v1/ajustes-bote").set(adminHeader).send(ajuste);
  }
  await calcularJornadaConTresMiembros(adminHeader, headers, 1, "2026-08-20");
  await calcularJornadaConTresMiembros(adminHeader, headers, 2, "2026-08-27");

  const jornada1 = await request(app).get("/api/v1/dashboard/jornada?jornada=1").set(adminHeader);
  const jornada2 = await request(app).get("/api/v1/dashboard/jornada?jornada=2").set(adminHeader);
  const temporada = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

  // J1: 5.55 + 2.80
  expect(jornada1.body.boteJornadaAjustado).toBe(8.35);
  // J2: 5.55 - 1.25 + 2.80 + 2.80
  expect(jornada2.body.boteJornadaAjustado).toBe(9.9);
  // Total: J2 + 4 (el ajuste posterior solo cuenta en el total)
  expect(temporada.body.boteTotal).toBe(13.9);
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/dashboard.test.ts`
Expected: FAIL en los dos tests nuevos (`boteJornadaAjustado` es `undefined`).

- [ ] **Step 3: Repositorio.** En `src/modules/dashboard/dashboard.repository.ts`:

Cambiar el import a `import { and, eq, lte, sql, type SQL } from "drizzle-orm";`.

Añadir a `AgregadosFiltros`:

```ts
    hastaNumeroJornada?: number | undefined;
```

En `agregados`, tras la línea del filtro `usuarioId`, añadir:

```ts
if (filtros.hastaNumeroJornada !== undefined)
  condiciones.push(lte(jornadas.numeroJornada, filtros.hastaNumeroJornada));
```

Sustituir `AjustesBoteFiltros` y `sumaAjustesBote` por:

```ts
export interface AjustesBoteFiltros {
  temporadaId: string;
  hastaFecha?: string | undefined;
}

export async function sumaAjustesBote(
  filtros: AjustesBoteFiltros,
  tx: DbOrTx = db,
): Promise<number> {
  const condiciones: SQL[] = [eq(ajustesBote.temporadaId, filtros.temporadaId)];
  if (filtros.hastaFecha !== undefined) {
    // El bote heredado cuenta siempre, aunque su fecha (fechaInicio) sea posterior a la jornada.
    condiciones.push(
      sql`(${ajustesBote.fecha} <= ${filtros.hastaFecha} OR ${ajustesBote.origenTemporadaId} IS NOT NULL)`,
    );
  }
  const [row] = await tx
    .select({ total: sql<string>`COALESCE(SUM(${ajustesBote.importe}), 0)` })
    .from(ajustesBote)
    .where(and(...condiciones));
  /* v8 ignore next -- @preserve */
  return row ? Number(row.total) : 0;
}
```

- [ ] **Step 4: Servicio.** En `src/modules/dashboard/dashboard.service.ts`, en `jornada`, tras `const agg = await dashboardRepository.agregados({ jornadaId: jornadaResuelta.id });` añadir:

```ts
const acumulado = await dashboardRepository.agregados({
  temporadaId: temporadaActual.id,
  hastaNumeroJornada: query.jornada,
});
const ajustesHastaJornada = await dashboardRepository.sumaAjustesBote({
  temporadaId: temporadaActual.id,
  hastaFecha: jornadaResuelta.fecha,
});
```

y en el objeto devuelto, debajo de `boteJornada: agg.sumaBote,`:

```ts
        boteJornadaAjustado: redondear(ajustesHastaJornada + acumulado.sumaBote),
```

- [ ] **Step 5: Schema y OpenAPI.** En `src/modules/dashboard/dashboard.schemas.ts`, en `DashboardJornadaResponseSchema`, debajo de `boteJornada: importeEuros,`:

```ts
    boteJornadaAjustado: importeConSigno,
```

En `src/modules/dashboard/dashboard.openapi.ts`, en `jornadaEjemplo`, debajo de `boteJornada: 17.49,`:

```ts
    boteJornadaAjustado: 140.94,
```

y sustituir la `description` de `/dashboard/jornada` por:

```ts
        description:
            "Solo disponible una vez la jornada tiene un cálculo ejecutado (POST /calculos). 'boteJornada' es el bote generado solo en esta jornada; 'boteJornadaAjustado' es el bote acumulado de la temporada hasta esta jornada: ajustes con fecha <= fecha de la jornada (el bote heredado cuenta siempre) más el bote de las jornadas con número <= este. En la última jornada coincide con 'boteTotal' de /dashboard/temporada salvo ajustes posteriores a ella.",
```

y la de `/dashboard/temporada` por:

```ts
        description:
            "Máximos y mínimos de aciertos con quiénes los lograron (pueden ser varios), y los totales de premios, pagos y bote. 'boteTotal' = ajustes de bote de esta temporada (incluido el heredado) + bote de sus jornadas calculadas.",
```

- [ ] **Step 6: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/dashboard.test.ts`
Expected: PASS, incluido el test existente "de jornada sin calcular -> 404" (el 404 se lanza antes de calcular el acumulado).

- [ ] **Step 7: Commit.**

```bash
git add src/modules/dashboard/dashboard.repository.ts src/modules/dashboard/dashboard.service.ts src/modules/dashboard/dashboard.schemas.ts src/modules/dashboard/dashboard.openapi.ts openapi/openapi.json tests/integration/dashboard.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat: GET /dashboard/jornada devuelve boteJornadaAjustado (bote acumulado hasta la jornada)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Activar una temporada crea su bote heredado de la anterior

**Files:**

- Modify: `src/modules/ajustes-bote/ajustes-bote.repository.ts` (añadir `findHeredado`, `updateHeredado`)
- Modify: `src/modules/temporadas/temporadas.service.ts:1-5,60-65` (imports y `activate`)
- Modify: `src/modules/temporadas/temporadas.controller.ts:1-2,39-43` (`activate` con `userId`)
- Modify: `src/modules/temporadas/temporadas.openapi.ts:154-155` (descripción de activar)
- Modify: `tests/integration/temporadas.test.ts` (imports, helpers y un `describe` nuevo)
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: `dashboardRepository.boteTemporada(temporadaId: string, tx?: DbOrTx): Promise<number>`, `temporadasRepository.findActiva(tx)`, `temporadasRepository.activate(codigo, tx)`, `ajustesBoteRepository.create(input: AjusteBoteInput, tx)`.
- Produces:

  ```ts
  export async function findHeredado(
    temporadaId: string,
    tx?: DbOrTx,
  ): Promise<AjusteBoteFila | undefined>;
  export async function updateHeredado(
    id: string,
    input: AjusteBoteInput,
    tx?: DbOrTx,
  ): Promise<void>;
  export async function activate(codigo: string, registradoPor: string): Promise<TemporadaFila>; // temporadas.service
  ```

- [ ] **Step 1: Escribir los tests que fallan.** En `tests/integration/temporadas.test.ts`, añadir a los imports:

```ts
import { resultadosMiembro } from "../../src/db/schema/resultados_miembro.js";
```

y al final del archivo:

```ts
const TEMPORADA_A = {
  codigo: "2025-26",
  nombre: "Temporada 2025/26",
  fechaInicio: "2025-08-15",
  fechaFin: "2026-05-30",
};
const TEMPORADA_B = {
  codigo: "2026-27",
  nombre: "Temporada 2026/27",
  fechaInicio: "2026-08-15",
  fechaFin: "2027-05-30",
};

interface AjusteRespuesta {
  id: string;
  importe: number;
  motivo: string;
  fecha: string;
  temporadaId: string;
  origenTemporadaId: string | null;
  registradoPor: string;
}

async function crearTemporadaHttp(
  header: Record<string, string>,
  datos: typeof TEMPORADA_A,
): Promise<string> {
  const response = await request(app)
    .post("/api/v1/temporadas")
    .set(header)
    .send(temporadaBody(datos));
  return response.body.id as string;
}

async function activar(header: Record<string, string>, codigo: string) {
  const response = await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
  expect(response.status).toBe(200);
}

async function sembrarJornadaCalculada(
  temporadaId: string,
  numeroJornada: number,
  fecha: string,
  usuarioId: string,
  bote: number,
) {
  const [jornada] = await db
    .insert(jornadas)
    .values({ temporadaId, numeroJornada, fecha, createdBy: usuarioId })
    .returning();
  if (!jornada) throw new Error("No se pudo sembrar la jornada");
  await db.insert(resultadosMiembro).values({
    jornadaId: jornada.id,
    usuarioId,
    aciertosMax: 10,
    ranking: 1,
    escalon: 1,
    importeEscalon: 1.5,
    bote,
  });
}

async function ajustesDe(
  header: Record<string, string>,
  codigo: string,
): Promise<AjusteRespuesta[]> {
  const response = await request(app).get(`/api/v1/ajustes-bote?temporada=${codigo}`).set(header);
  expect(response.status).toBe(200);
  return response.body as AjusteRespuesta[];
}

async function boteTotalDe(header: Record<string, string>, codigo: string): Promise<number> {
  const response = await request(app)
    .get(`/api/v1/dashboard/temporada?temporada=${codigo}`)
    .set(header);
  expect(response.status).toBe(200);
  return response.body.boteTotal as number;
}

// A activa con bote final 12.30 = ajustes (10.10 - 2.05) + jornadas (3.35 + 0.90). B creada sin activar.
async function prepararTemporadaAConBote(header: Record<string, string>, adminId: string) {
  const idA = await crearTemporadaHttp(header, TEMPORADA_A);
  const idB = await crearTemporadaHttp(header, TEMPORADA_B);
  await activar(header, TEMPORADA_A.codigo);
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(header)
    .send({ importe: 10.1, motivo: "Bote inicial", fecha: "2025-08-15" });
  await request(app)
    .post("/api/v1/ajustes-bote")
    .set(header)
    .send({ importe: -2.05, motivo: "Gastos", fecha: "2025-09-01" });
  await sembrarJornadaCalculada(idA, 1, "2025-08-20", adminId, 3.35);
  await sembrarJornadaCalculada(idA, 2, "2025-08-27", adminId, 0.9);
  return { idA, idB };
}

describe("Bote heredado al activar una temporada", () => {
  test("sin temporada activa previa -> no se crea bote heredado", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporadaHttp(header, TEMPORADA_A);

    await activar(header, TEMPORADA_A.codigo);

    expect(await ajustesDe(header, TEMPORADA_A.codigo)).toEqual([]);
  });

  test("activar una temporada posterior hereda el bote final de la anterior (ajustes + jornadas)", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    const { idA, idB } = await prepararTemporadaAConBote(header, admin.id);

    await activar(header, TEMPORADA_B.codigo);

    const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
    expect(ajustesB).toHaveLength(1);
    expect(ajustesB[0]).toMatchObject({
      importe: 12.3,
      motivo: "Bote heredado de 2025-26",
      fecha: TEMPORADA_B.fechaInicio,
      temporadaId: idB,
      origenTemporadaId: idA,
      registradoPor: admin.id,
    });
    expect(await boteTotalDe(header, TEMPORADA_A.codigo)).toBe(12.3);
    expect(await boteTotalDe(header, TEMPORADA_B.codigo)).toBe(12.3);
  });

  test("activar otra vez la temporada ya activa no duplica ni recalcula el heredado", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await prepararTemporadaAConBote(header, admin.id);
    await activar(header, TEMPORADA_B.codigo);
    const antes = await ajustesDe(header, TEMPORADA_B.codigo);

    await activar(header, TEMPORADA_B.codigo);

    expect(await ajustesDe(header, TEMPORADA_B.codigo)).toEqual(antes);
  });

  test("reactivar una temporada más antigua no le crea heredado y la nueva conserva el suyo", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await prepararTemporadaAConBote(header, admin.id);
    await activar(header, TEMPORADA_B.codigo);

    await activar(header, TEMPORADA_A.codigo);

    const ajustesA = await ajustesDe(header, TEMPORADA_A.codigo);
    expect(ajustesA).toHaveLength(2);
    expect(ajustesA.every((a) => a.origenTemporadaId === null)).toBe(true);
    const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
    expect(ajustesB).toHaveLength(1);
    expect(ajustesB[0]?.importe).toBe(12.3);
  });

  test("volver a activar la nueva tras corregir la antigua recalcula su heredado sin duplicarlo", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await prepararTemporadaAConBote(header, admin.id);
    await activar(header, TEMPORADA_B.codigo);
    const [heredadoInicial] = await ajustesDe(header, TEMPORADA_B.codigo);
    await activar(header, TEMPORADA_A.codigo);
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send({ importe: 5, motivo: "Corrección tardía", fecha: "2026-05-01" });

    await activar(header, TEMPORADA_B.codigo);

    const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
    expect(ajustesB).toHaveLength(1);
    expect(ajustesB[0]?.id).toBe(heredadoInicial?.id);
    expect(ajustesB[0]?.importe).toBe(17.3);
    expect(await boteTotalDe(header, TEMPORADA_B.codigo)).toBe(17.3);
  });

  test("el heredado cuenta en boteJornadaAjustado aunque la jornada sea anterior a fechaInicio", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    const { idB } = await prepararTemporadaAConBote(header, admin.id);
    await activar(header, TEMPORADA_B.codigo);
    await sembrarJornadaCalculada(idB, 1, "2026-08-10", admin.id, 1.5);

    const response = await request(app).get("/api/v1/dashboard/jornada?jornada=1").set(header);

    expect(response.status).toBe(200);
    expect(response.body.boteJornadaAjustado).toBe(13.8);
  });
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/temporadas.test.ts`
Expected: FAIL en "activar una temporada posterior hereda...", "activar otra vez...", "reactivar...", "volver a activar..." y "el heredado cuenta..." (no hay heredado). "sin temporada activa previa" pasa ya (es la regresión que debe seguir en verde).

- [ ] **Step 3: Repositorio de ajustes.** En `src/modules/ajustes-bote/ajustes-bote.repository.ts`, cambiar el import a `import { and, asc, eq, isNotNull } from "drizzle-orm";` y añadir al final:

```ts
export async function findHeredado(
  temporadaId: string,
  tx: DbOrTx = db,
): Promise<AjusteBoteFila | undefined> {
  const [row] = await tx
    .select()
    .from(ajustesBote)
    .where(and(eq(ajustesBote.temporadaId, temporadaId), isNotNull(ajustesBote.origenTemporadaId)));
  return row;
}

export async function updateHeredado(
  id: string,
  input: AjusteBoteInput,
  tx: DbOrTx = db,
): Promise<void> {
  await tx.update(ajustesBote).set(input).where(eq(ajustesBote.id, id));
}
```

- [ ] **Step 4: Servicio de temporadas.** En `src/modules/temporadas/temporadas.service.ts`, añadir a los imports:

```ts
import * as ajustesBoteRepository from "../ajustes-bote/ajustes-bote.repository.js";
import * as dashboardRepository from "../dashboard/dashboard.repository.js";
```

y sustituir `activate` (líneas 60-65) por:

```ts
interface TemporadaRef {
  id: string;
  codigo: string;
  fechaInicio: string;
}

// Crea (o recalcula, si ya existe) el ajuste "Bote heredado de <anterior>" en la nueva temporada.
async function registrarBoteHeredado(
  anterior: TemporadaRef,
  nueva: TemporadaRef,
  registradoPor: string,
  tx: DbOrTx,
) {
  const datos = {
    importe: await dashboardRepository.boteTemporada(anterior.id, tx),
    motivo: `Bote heredado de ${anterior.codigo}`,
    fecha: nueva.fechaInicio,
    temporadaId: nueva.id,
    origenTemporadaId: anterior.id,
    registradoPor,
  };
  const existente = await ajustesBoteRepository.findHeredado(nueva.id, tx);
  if (existente) {
    await ajustesBoteRepository.updateHeredado(existente.id, datos, tx);
  } else {
    await ajustesBoteRepository.create(datos, tx);
  }
}

export async function activate(codigo: string, registradoPor: string) {
  return db.transaction(async (tx) => {
    const nueva = await resolveTemporada(codigo, tx);
    const anterior = await temporadasRepository.findActiva(tx);
    const activada = await temporadasRepository.activate(codigo, tx);
    // Solo se hereda hacia delante: re-activar la misma o una temporada más antigua no toca heredados.
    if (anterior && anterior.id !== nueva.id && anterior.fechaInicio < nueva.fechaInicio) {
      await registrarBoteHeredado(anterior, nueva, registradoPor, tx);
    }
    return activada;
  });
}
```

- [ ] **Step 5: Controller.** En `src/modules/temporadas/temporadas.controller.ts`, añadir `import { UnauthorizedError } from "../../core/errors.js";` y, debajo de los imports:

```ts
function requireAuthContext(req: Request) {
  /* v8 ignore next -- @preserve */
  if (!req.auth) {
    throw new UnauthorizedError();
  }
  return req.auth;
}
```

y sustituir `activate` por:

```ts
export async function activate(req: Request, res: Response): Promise<void> {
  const { codigo } = req.params as TemporadaCodigoParam;
  const auth = requireAuthContext(req);
  const temporada = await temporadasService.activate(codigo, auth.userId);
  res.status(200).json(temporada);
}
```

- [ ] **Step 6: OpenAPI.** En `src/modules/temporadas/temporadas.openapi.ts`, sustituir la `description` de `/temporadas/{codigo}/activar` por:

```ts
        description:
            "Desactiva cualquier otra temporada activa y activa esta, en una única transacción (garantizado además por un índice único parcial en BD). Si la temporada que estaba activa empezó antes que esta, en la misma transacción se crea (o se recalcula, si ya existía) en esta un ajuste 'Bote heredado de <código anterior>' con el bote final de la anterior y fecha = fechaInicio. Re-activar la misma temporada o una más antigua no toca ningún bote heredado.",
```

- [ ] **Step 7: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/temporadas.test.ts tests/integration/ajustes-bote.test.ts tests/integration/dashboard.test.ts tests/integration/calculos.test.ts`
Expected: PASS (los tests de dashboard/calculos/ajustes que activan dos temporadas lo hacen con la misma `fechaInicio` o hacia atrás, así que no generan heredado).

- [ ] **Step 8: Commit.**

```bash
git add src/modules/ajustes-bote/ajustes-bote.repository.ts src/modules/temporadas/temporadas.service.ts src/modules/temporadas/temporadas.controller.ts src/modules/temporadas/temporadas.openapi.ts openapi/openapi.json tests/integration/temporadas.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat: activar una temporada crea su bote heredado de la anterior en la misma transacción

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Protecciones del bote heredado (no se borra a mano; se elimina con su temporada)

**Files:**

- Modify: `src/modules/ajustes-bote/ajustes-bote.repository.ts` (añadir `removeHeredado`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.service.ts` (`remove`)
- Modify: `src/modules/ajustes-bote/ajustes-bote.openapi.ts` (409 del DELETE)
- Modify: `src/modules/temporadas/temporadas.service.ts:46-58` (`remove`)
- Modify: `src/modules/temporadas/temporadas.openapi.ts:135,145` (descripción y 409 del DELETE)
- Modify: `tests/integration/ajustes-bote.test.ts`, `tests/integration/temporadas.test.ts`
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Produces:

  ```ts
  export async function removeHeredado(temporadaId: string, tx?: DbOrTx): Promise<void>; // ajustes-bote.repository
  export async function remove(codigo: string): Promise<void>; // temporadas.service, transaccional
  ```

- [ ] **Step 1: Escribir los tests que fallan.** Añadir al final de `tests/integration/ajustes-bote.test.ts`:

```ts
describe("DELETE del bote heredado", () => {
  test("-> 409 y sigue en la lista", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header, "2025-26", { fechaInicio: "2025-08-15", fechaFin: "2026-05-30" });
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send(ajusteBoteBody({ importe: 10 }));
    await crearTemporada(header, "2026-27");
    const lista = await request(app).get("/api/v1/ajustes-bote").set(header);
    const heredado = (lista.body as Array<{ id: string; origenTemporadaId: string | null }>).find(
      (a) => a.origenTemporadaId !== null,
    );
    expect(heredado).toBeDefined();

    const response = await request(app).delete(`/api/v1/ajustes-bote/${heredado?.id}`).set(header);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "El bote heredado no se puede borrar a mano: se recalcula al activar la temporada.",
    );
    const despues = await request(app).get("/api/v1/ajustes-bote").set(header);
    expect(despues.body).toHaveLength(1);
  });
});
```

En `tests/integration/temporadas.test.ts`, añadir a los imports:

```ts
import { eq } from "drizzle-orm";
import { ajustesBote } from "../../src/db/schema/ajustes_bote.js";
```

y al final del archivo (usa los helpers de la Task 5):

```ts
describe("DELETE de temporadas con ajustes de bote", () => {
  test("temporada cuyo único ajuste es su bote heredado -> 204 y el heredado se borra con ella", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporadaHttp(header, TEMPORADA_A);
    const idB = await crearTemporadaHttp(header, TEMPORADA_B);
    await activar(header, TEMPORADA_A.codigo);
    await activar(header, TEMPORADA_B.codigo);
    await activar(header, TEMPORADA_A.codigo);

    const response = await request(app)
      .delete(`/api/v1/temporadas/${TEMPORADA_B.codigo}`)
      .set(header);

    expect(response.status).toBe(204);
    expect(
      await db.select().from(ajustesBote).where(eq(ajustesBote.temporadaId, idB)),
    ).toHaveLength(0);
  });

  test("temporada con ajustes manuales -> 409", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporadaHttp(header, TEMPORADA_A);
    await activar(header, TEMPORADA_A.codigo);
    await request(app)
      .post("/api/v1/ajustes-bote")
      .set(header)
      .send({ importe: 10, motivo: "Bote inicial", fecha: "2025-08-15" });

    const response = await request(app)
      .delete(`/api/v1/temporadas/${TEMPORADA_A.codigo}`)
      .set(header);

    expect(response.status).toBe(409);
    expect(response.body.message).toBe(
      "No se puede borrar una temporada que tiene jornadas o ajustes de bote asociados.",
    );
  });

  test("temporada que es origen del bote heredado de otra -> 409", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporadaHttp(header, TEMPORADA_A);
    await crearTemporadaHttp(header, TEMPORADA_B);
    await activar(header, TEMPORADA_A.codigo);
    await activar(header, TEMPORADA_B.codigo);

    const response = await request(app)
      .delete(`/api/v1/temporadas/${TEMPORADA_A.codigo}`)
      .set(header);

    expect(response.status).toBe(409);
  });
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/ajustes-bote.test.ts tests/integration/temporadas.test.ts`
Expected: FAIL en "DELETE del bote heredado -> 409" (recibe 204), "temporada cuyo único ajuste es su bote heredado" (recibe 409 por la FK) y "temporada con ajustes manuales" (el mensaje aún habla solo de jornadas). "origen del bote heredado de otra" ya da 409 (FK `restrict`).

- [ ] **Step 3: Repositorio.** En `src/modules/ajustes-bote/ajustes-bote.repository.ts`, añadir:

```ts
export async function removeHeredado(temporadaId: string, tx: DbOrTx = db): Promise<void> {
  await tx
    .delete(ajustesBote)
    .where(and(eq(ajustesBote.temporadaId, temporadaId), isNotNull(ajustesBote.origenTemporadaId)));
}
```

- [ ] **Step 4: Servicio de ajustes.** En `src/modules/ajustes-bote/ajustes-bote.service.ts`, en `remove`, justo después del `throw new NotFoundError(...)` y su llave de cierre, añadir:

```ts
if (existente.origenTemporadaId !== null) {
  throw new ConflictError(
    "El bote heredado no se puede borrar a mano: se recalcula al activar la temporada.",
  );
}
```

- [ ] **Step 5: Servicio de temporadas.** En `src/modules/temporadas/temporadas.service.ts`, sustituir `remove` por:

```ts
export async function remove(codigo: string) {
  const temporada = await resolveTemporada(codigo);
  try {
    await db.transaction(async (tx) => {
      // El heredado propio se va con la temporada; jornadas, ajustes manuales o ser origen
      // del heredado de otra temporada siguen bloqueando por FK RESTRICT.
      await ajustesBoteRepository.removeHeredado(temporada.id, tx);
      await temporadasRepository.remove(codigo, tx);
    });
  } catch (err) {
    /* v8 ignore next -- @preserve */
    if (isForeignKeyViolation(err)) {
      throw new ConflictError(
        "No se puede borrar una temporada que tiene jornadas o ajustes de bote asociados.",
      );
    }
    /* v8 ignore next -- @preserve */
    throw err;
  }
}
```

- [ ] **Step 6: OpenAPI.** En `src/modules/ajustes-bote/ajustes-bote.openapi.ts`, cambiar el 409 del `delete` por:

```ts
            "409": { description: "El ajuste es un bote heredado, o pertenece a una temporada que no es la activa." },
```

En `src/modules/temporadas/temporadas.openapi.ts`, en el `delete` de `/temporadas/{codigo}`, cambiar la `description` y el 409 por:

```ts
        description:
            "Solo se puede borrar si no tiene jornadas ni ajustes de bote manuales y no es el origen del bote heredado de otra temporada (RESTRICT en BD). Su propio bote heredado se borra con ella.",
```

```ts
            "409": { description: "La temporada tiene jornadas o ajustes de bote asociados, o es origen de un bote heredado (RESTRICT)." },
```

- [ ] **Step 7: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/ajustes-bote.test.ts tests/integration/temporadas.test.ts`
Expected: PASS (incluido el test existente "temporada con jornadas asociadas -> 409").

- [ ] **Step 8: Commit.**

```bash
git add src/modules/ajustes-bote/ajustes-bote.repository.ts src/modules/ajustes-bote/ajustes-bote.service.ts src/modules/ajustes-bote/ajustes-bote.openapi.ts src/modules/temporadas/temporadas.service.ts src/modules/temporadas/temporadas.openapi.ts openapi/openapi.json tests/integration/ajustes-bote.test.ts tests/integration/temporadas.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
feat: el bote heredado no se borra a mano y se elimina con su temporada

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Recálculo bloqueado en temporadas no activas (mensaje explícito + test que fija que no se toca la liquidación)

El bloqueo ya existe (`calculos.service.ts:76-78`, test en `tests/integration/calculos.test.ts:159`). Esta tarea solo hace explícito el motivo y fija que la liquidación guardada no cambia.

**Files:**

- Modify: `src/modules/calculos/calculos.service.ts:77`
- Modify: `src/modules/calculos/calculos.openapi.ts` (409 del `post`)
- Modify: `tests/integration/calculos.test.ts` (test nuevo dentro de `describe("POST /api/v1/calculos")`)
- Regenerate: `openapi/openapi.json`

**Interfaces:**

- Consumes: `ejecutar(input: EjecutarCalculoInput)` sin cambio de firma.
- Produces: `ConflictError("La temporada '<codigo>' no está activa: no se pueden recalcular sus jornadas.")` (HTTP 409, `error: "CONFLICT"`).

- [ ] **Step 1: Escribir el test que falla.** En `tests/integration/calculos.test.ts`, debajo del test "sobre jornada de temporada no activa -> 409" (línea 171):

```ts
test("recalcular una jornada de una temporada ya no activa -> 409 explícito y no toca la liquidación", async () => {
  const admin = await createAdmin();
  const header = await authHeader(admin);
  await prepararJornadaCalculable(header);
  const primero = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });
  expect(primero.status).toBe(200);
  await crearTemporada(header, "2025-26", true);

  const response = await request(app)
    .post("/api/v1/calculos")
    .set(header)
    .send({ jornada: 1, temporada: "2026-27" });

  expect(response.status).toBe(409);
  expect(response.body.error).toBe("CONFLICT");
  expect(response.body.message).toBe(
    "La temporada '2026-27' no está activa: no se pueden recalcular sus jornadas.",
  );
  const guardado = await request(app)
    .get("/api/v1/calculos?jornada=1&temporada=2026-27")
    .set(header);
  expect(guardado.body).toEqual(primero.body);
});
```

- [ ] **Step 2: Ejecutar y ver el rojo.**

Run: `npm test -- tests/integration/calculos.test.ts`
Expected: FAIL solo en la aserción del `message` (hoy es "La temporada '2026-27' no está activa.").

- [ ] **Step 3: Implementación.** En `src/modules/calculos/calculos.service.ts:77`:

```ts
throw new ConflictError(
  `La temporada '${temporada.codigo}' no está activa: no se pueden recalcular sus jornadas.`,
);
```

En `src/modules/calculos/calculos.openapi.ts`, el 409 del `post`:

```ts
            "409": { description: "Temporada no activa (no se recalculan jornadas de temporadas cerradas: el bote heredado quedaría desfasado), apuestas todavía abiertas, sin resultados registrados, o sin ninguna apuesta." },
```

- [ ] **Step 4: Regenerar OpenAPI y ejecutar en verde.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm test -- tests/integration/calculos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add src/modules/calculos/calculos.service.ts src/modules/calculos/calculos.openapi.ts openapi/openapi.json tests/integration/calculos.test.ts
git diff --cached --stat
git commit -m "$(cat <<'EOF'
fix: mensaje explícito al recalcular jornadas de una temporada no activa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Verificación completa de la rama (igual que CI)

**Files:**

- Regenerate (solo si hubiera diferencias): `openapi/openapi.json`

**Interfaces:** ninguna nueva.

- [ ] **Step 1: Typecheck y lint.**

Run: `npm run typecheck && npm run lint`
Expected: sin errores.

- [ ] **Step 2: Suite completa con cobertura.**

Run: `npm run test:cov`
Expected: PASS y umbrales cumplidos (100 % en `temporadas.service.ts`, `dashboard.service.ts`, `calculos.service.ts`). Si `temporadas.service.ts` no llega al 100 %, la rama descubierta está en `activate`/`registrarBoteHeredado`: cada condición del `if` tiene su test en la Task 5 (sin anterior, misma temporada, temporada más antigua, heredado nuevo, heredado existente).

- [ ] **Step 3: Contrato OpenAPI como en CI.**

Run: `npm run openapi:generate && npx prettier --write openapi/openapi.json && npm run openapi:lint && git diff --exit-code openapi/openapi.json`
Expected: lint sin errores y `git diff` sin cambios. Si hubiera cambios, commitearlos:

```bash
git add openapi/openapi.json
git commit -m "$(cat <<'EOF'
chore: regenera el contrato OpenAPI

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4: Migraciones coherentes con el schema.**

Run: `npm run db:generate -- --name=comprobacion`
Expected: "No schema changes, nothing to migrate". Si se generase algo, borrar los archivos generados y volver a la Task 1, Step 5.

- [ ] **Step 5: Comprobar que no se ha colado nada ajeno.**

Run: `git log --stat main..HEAD` y `git status --short`
Expected: los commits solo contienen archivos de este plan; `git status` sigue mostrando los cambios ajenos (`package.json`, `docker/pull-prod.sh`, `.atl/`, `.agents/`, `.claude/`, `comandos/`) sin commitear.

---

### Task 9: Ensayo de la migración contra la BD local (copia de producción)

Sin commits. La BD local se ha sincronizado con `npm run db:pull-prod`; si se quiere repetir el ensayo desde cero, volver a ejecutar `npm run db:pull-prod` (borra los datos locales). Las queries se pegan en `npm run db:psql`.

**Files:** ninguno.

**Interfaces:** ninguna.

- [ ] **Step 1: Capturar el estado ANTES (anotar los resultados).**

```sql
-- A1. Temporadas y cuál está activa (si hay ajustes, debe haber exactamente una activa)
SELECT id, codigo, fecha_inicio, fecha_fin, activa FROM temporadas ORDER BY fecha_inicio;

-- A2. Ajustes actuales
SELECT count(*) AS n_ajustes, COALESCE(sum(importe), 0) AS suma_ajustes FROM ajustes_bote;
SELECT id, importe, motivo, fecha FROM ajustes_bote ORDER BY fecha, created_at;

-- A3. boteTotal de la temporada activa con la fórmula ACTUAL (todos los ajustes + jornadas de la activa)
SELECT
    (SELECT COALESCE(sum(importe), 0) FROM ajustes_bote)
  + (SELECT COALESCE(sum(rm.bote), 0)
       FROM resultados_miembro rm
       JOIN jornadas j ON j.id = rm.jornada_id
       JOIN temporadas t ON t.id = j.temporada_id
      WHERE t.activa) AS bote_total_antes;

-- A4. Última migración aplicada
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 1;
```

- [ ] **Step 2 (opcional): Comprobar el fallo explícito sin tocar datos.** Se ejecuta dentro de una transacción que se deshace:

```sql
BEGIN;
UPDATE temporadas SET activa = false;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "ajustes_bote")
       AND NOT EXISTS (SELECT 1 FROM "temporadas" WHERE "activa") THEN
        RAISE EXCEPTION 'Migración 0010: hay ajustes de bote pero ninguna temporada activa a la que asignarlos. Activa una temporada y vuelve a migrar.';
    END IF;
END $$;
ROLLBACK;
```

Expected: `ERROR: Migración 0010: hay ajustes de bote...` si hay ajustes (si la tabla está vacía no hay error). Tras el `ROLLBACK`, `SELECT codigo FROM temporadas WHERE activa;` vuelve a devolver la activa.

- [ ] **Step 3: Aplicar la migración.**

Run: `npm run db:migrate`
Expected: termina sin errores.

- [ ] **Step 4: Verificar DESPUÉS.**

```sql
-- D1. Ajustes sin temporada: 0
SELECT count(*) AS sin_temporada FROM ajustes_bote WHERE temporada_id IS NULL;

-- D2. Todos los ajustes existentes están en la temporada activa: 0
SELECT count(*) AS fuera_de_la_activa
  FROM ajustes_bote a JOIN temporadas t ON t.id = a.temporada_id
 WHERE NOT t.activa;

-- D3. Mismo número y suma que A2
SELECT count(*) AS n_ajustes, COALESCE(sum(importe), 0) AS suma_ajustes FROM ajustes_bote;

-- D4. La migración no crea heredados: 0
SELECT count(*) AS heredados FROM ajustes_bote WHERE origen_temporada_id IS NOT NULL;

-- D5. boteTotal con la fórmula NUEVA: debe ser igual a bote_total_antes (A3)
SELECT
    (SELECT COALESCE(sum(a.importe), 0)
       FROM ajustes_bote a JOIN temporadas t ON t.id = a.temporada_id
      WHERE t.activa)
  + (SELECT COALESCE(sum(rm.bote), 0)
       FROM resultados_miembro rm
       JOIN jornadas j ON j.id = rm.jornada_id
       JOIN temporadas t ON t.id = j.temporada_id
      WHERE t.activa) AS bote_total_despues;

-- D6. Restricciones e índices
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'ajustes_bote'::regclass ORDER BY conname;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ajustes_bote' ORDER BY indexname;

-- D7. La migración 0010 está registrada (hash = sha256 del archivo)
SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 2;

-- D8. Última jornada calculada de la activa y ajustes posteriores a ella
--     (si D8b devuelve 0 filas, boteJornadaAjustado de esa jornada debe ser igual a boteTotal)
SELECT j.numero_jornada, j.fecha
  FROM jornadas j JOIN temporadas t ON t.id = j.temporada_id
 WHERE t.activa AND EXISTS (SELECT 1 FROM resultados_miembro rm WHERE rm.jornada_id = j.id)
 ORDER BY j.numero_jornada DESC LIMIT 1;
SELECT a.fecha, a.importe, a.motivo
  FROM ajustes_bote a JOIN temporadas t ON t.id = a.temporada_id
 WHERE t.activa AND a.origen_temporada_id IS NULL
   AND a.fecha > (SELECT max(j.fecha) FROM jornadas j JOIN temporadas t2 ON t2.id = j.temporada_id
                   WHERE t2.activa AND EXISTS (SELECT 1 FROM resultados_miembro rm WHERE rm.jornada_id = j.id));
```

Expected: D1 = 0, D2 = 0, D3 = A2, D4 = 0, D5 = A3; D6 incluye `ajustes_bote_temporada_id_temporadas_id_fk`, `ajustes_bote_origen_temporada_id_temporadas_id_fk`, `ajustes_bote_origen_distinto_check` y el índice `ajustes_bote_un_heredado_por_temporada`; en D7 el `hash` coincide con `shasum -a 256 drizzle/0010_bote_por_temporada.sql`.

- [ ] **Step 5: Verificar por API en local.** En una terminal `npm run dev`; en otra:

```bash
TOKEN=$(npm run -s token -- --email=<email de un admin de la BD local>)
curl -fsS -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/dashboard/temporada | jq .boteTotal
curl -fsS -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/dashboard/jornada?jornada=<numero_jornada de D8>" | jq '{boteJornada, boteJornadaAjustado}'
curl -fsS -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/ajustes-bote | jq 'map({importe, fecha, temporadaId, origenTemporadaId})'
```

Expected: `boteTotal` = A3 (redondeado a 2 decimales); `boteJornadaAjustado` = `boteTotal` si D8b no devolvió filas; la lista de ajustes = A2 con `temporadaId` de la activa y `origenTemporadaId: null`. Si `npm run token` imprime algo más que el token, copiar el token a mano.

- [ ] **Step 6: Ensayar el rollback (SQL de down de la Task 10, Step R2) y volver a migrar.** Ejecutar el bloque R2 en `npm run db:psql`, repetir A3 (debe dar `bote_total_antes`) y A4 (vuelve a ser la migración 0009). Después `npm run db:migrate` otra vez y repetir D1–D5. Así el down queda probado con datos reales antes de necesitarlo.

---

### Task 10: Despliegue a producción (checklist manual para el usuario)

Ningún paso se ejecuta automáticamente. `$VPS_HOST` es el mismo que usa `npm run db:pull-prod`. En el VPS todos los comandos se lanzan desde `~/quini-api`.

**Files:** ninguno.

**Interfaces:** ninguna.

**Coordinación con el frontend (antes de empezar):**

- `boteTotal` NO cambia de valor en el momento del despliegue (todos los ajustes pasan a la temporada activa, D5 = A3). Cambia de significado a partir de la próxima activación de temporada: ya incluye el bote heredado. El `calcularResumenBote` del frontend NO debe sumar los ajustes encima de `boteTotal` (desde e3af0cf `boteTotal` ya los incluye; si hoy los suma, ya está contando doble).
- Campos nuevos que el frontend debe tolerar: `boteJornadaAjustado` en /dashboard/jornada; `temporadaId` y `origenTemporadaId` en /ajustes-bote.
- GET /ajustes-bote pasa a devolver solo los de la temporada activa (o `?temporada=`). POST/DELETE devuelven 409 para temporadas no activas y para el bote heredado (`origenTemporadaId !== null`): ocultar el botón de borrar en ese caso. POST sin temporada activa devuelve 404.
- quini-web edita un ajuste creando uno nuevo (POST) y borrando el viejo (DELETE) (`src/features/admin-ajustes-bote/api/useEditarAjusteBoteAdmin.ts` en el repo hermano). Con el heredado el DELETE devuelve 409 y deja un duplicado manual: el frontend debe ocultar editar y borrar cuando `origenTemporadaId !== null`, publicado antes o a la vez que este despliegue de la API.
- Sin escrituras de ajustes durante el despliegue: `deploy.yml` ejecuta la migración antes de cambiar los contenedores, y el POST /ajustes-bote del código antiguo daría 500 por el `temporada_id` NOT NULL durante esos segundos.
- Sin temporada activa, GET /ajustes-bote devuelve ahora 404 en lugar de `[]` (la pantalla de ajustes del frontend mostrará un error entre temporadas).
- Nota para el frontend: `calcularResumenBote` (`quini-web/src/features/admin-ajustes-bote/lib/calcularResumenBote.ts`) suma los ajustes encima de `boteTotal`, que ya los incluye (doble conteo previo; ahora el heredado también se cuenta doble ahí).
- Orden recomendado: backend primero (los cambios son aditivos), frontend después.

- [ ] **Step P1: Merge a main con CI en verde.**

```bash
git push -u origin bote-por-temp-con-ajustes
gh pr create --base main --title "feat: bote por temporada con ajustes y bote heredado" --body "$(cat <<'EOF'
Bote por temporada (ajustes + jornadas), boteJornadaAjustado en /dashboard/jornada y bote heredado al activar temporada. Plan: docs/superpowers/plans/2026-10-01-bote-por-temporada-con-ajustes.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
gh pr checks --watch
gh pr merge --merge
git checkout main && git pull
```

Los cambios ajenos sin commitear viajan con `git checkout main` (no se pierden), pero siguen sin commitear: no añadirlos.

- [ ] **Step P2: Backup de producción y datos de rollback (en el VPS).**

```bash
ssh ubuntu@$VPS_HOST
cd ~/quini-api
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_dump -U quini -Fc quini > backup-pre-bote-temporada-$(date +%Y%m%d-%H%M).dump
ls -lh backup-pre-bote-temporada-*.dump
head -c 5 backup-pre-bote-temporada-*.dump; echo   # debe imprimir PGDMP
# Imagen que está corriendo ahora (es la que se restaura en un rollback); se espera el sha de v1.0.0 = 69dda75a7222b723240dc64a26d52eb499568516
docker inspect --format '{{.Config.Image}}' $(docker compose --env-file .env.prod -f docker-compose.prod.yml ps -q api)
```

Copiar el backup fuera del VPS (desde el portátil): `scp ubuntu@$VPS_HOST:~/quini-api/backup-pre-bote-temporada-*.dump ~/backups/`.

- [ ] **Step P3: Capturar el estado ANTES en producción.** Abrir psql: `docker compose --env-file .env.prod -f docker-compose.prod.yml exec postgres psql -U quini -d quini` y ejecutar A1–A4 de la Task 9. Anotar `bote_total_antes`. Si A2 devuelve ajustes y A1 no tiene ninguna temporada activa, PARAR: la migración fallaría (el deploy se detendría sin tocar nada, pero conviene activar antes la temporada correcta).

- [ ] **Step P4: Disparar el despliegue.** Ya existe el tag `v1.0.0` (apunta a 69dda75, en origin). Crear el siguiente desde `main` actualizado:

```bash
git tag -a v1.1.0 -m "Bote por temporada con ajustes y bote heredado"
git push origin v1.1.0
gh run watch
```

Alternativa sin tag: `gh workflow run deploy.yml --ref main && gh run watch`. El workflow ejecuta `node dist/scripts/migrate.js` antes de `up -d api` con `set -e`: si la migración falla, se aplica el rollback de la transacción, la API antigua sigue en marcha y el job falla.

- [ ] **Step P5: Verificación post-deploy.**

```bash
curl -fsS https://api.quiniweb.com/health
```

En psql de producción, ejecutar D1–D8 de la Task 9 y comparar D5 con `bote_total_antes`. Por API, con un access token de admin sacado de la sesión del frontend (DevTools; `npm run token` está prohibido con `NODE_ENV=production`):

```bash
curl -fsS -H "Authorization: Bearer $TOKEN" https://api.quiniweb.com/api/v1/dashboard/temporada | jq .boteTotal
curl -fsS -H "Authorization: Bearer $TOKEN" "https://api.quiniweb.com/api/v1/dashboard/jornada?jornada=<numero_jornada de D8>" | jq '{boteJornada, boteJornadaAjustado}'
curl -fsS -H "Authorization: Bearer $TOKEN" https://api.quiniweb.com/api/v1/ajustes-bote | jq 'map({importe, temporadaId, origenTemporadaId})'
```

Expected: `boteTotal` = `bote_total_antes`; `boteJornadaAjustado` = `boteTotal` si D8b no devuelve filas; todos los ajustes con `origenTemporadaId: null`.

- [ ] **Step P6: Desplegar el frontend** con los cambios descritos arriba y comprobar en pantalla que el bote total no ha cambiado.

**Rollback** (solo si algo sale mal; ensayado en la Task 9, Step 6):

- [ ] **Step R1: Volver a la imagen anterior (en el VPS).** Primero el código: la imagen nueva lee `temporada_id` y fallaría sin la columna.

```bash
cd ~/quini-api
export TAG=<sha anotado en P2, se espera 69dda75a7222b723240dc64a26d52eb499568516>
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d api
curl -fsS https://api.quiniweb.com/health
```

Entre R1 y R2 la API antigua puede leer, pero POST /ajustes-bote fallaría (columna `temporada_id` NOT NULL): ejecutar R2 inmediatamente.

- [ ] **Step R2: SQL de down (manual; drizzle no lo genera).** Antes, comprobar que la última fila de `drizzle.__drizzle_migrations` es la 0010 (su `hash` = `shasum -a 256 drizzle/0010_bote_por_temporada.sql`) y anotar los heredados que se van a borrar (`SELECT * FROM ajustes_bote WHERE origen_temporada_id IS NOT NULL;`):

```sql
BEGIN;
-- Los heredados no existían en el modelo anterior; si se quedasen, el código viejo los sumaría al bote global.
DELETE FROM ajustes_bote WHERE origen_temporada_id IS NOT NULL;
ALTER TABLE ajustes_bote DROP CONSTRAINT IF EXISTS ajustes_bote_origen_distinto_check;
DROP INDEX IF EXISTS ajustes_bote_un_heredado_por_temporada;
ALTER TABLE ajustes_bote DROP CONSTRAINT IF EXISTS ajustes_bote_origen_temporada_id_temporadas_id_fk;
ALTER TABLE ajustes_bote DROP CONSTRAINT IF EXISTS ajustes_bote_temporada_id_temporadas_id_fk;
ALTER TABLE ajustes_bote DROP COLUMN IF EXISTS origen_temporada_id;
ALTER TABLE ajustes_bote DROP COLUMN IF EXISTS temporada_id;
DELETE FROM drizzle.__drizzle_migrations WHERE id = (SELECT max(id) FROM drizzle.__drizzle_migrations);
COMMIT;
```

Después repetir A3 (debe dar `bote_total_antes`) y A4 (última migración = 0009).

- [ ] **Step R3 (último recurso): restaurar el backup.** Pierde todo lo escrito después de P2:

```bash
cat backup-pre-bote-temporada-<fecha>.dump | docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T postgres pg_restore -U quini -d quini --clean --if-exists
```

- [ ] **Step R4:** revertir el merge en `main` (`git revert -m 1 <sha del merge>`) para que el siguiente despliegue no vuelva a aplicar la migración, y avisar al frontend.

---

## Riesgos documentados (no se resuelven en este plan)

- **Datos de temporadas cerradas editables fuera del bote**: `PUT /jornadas/:n/resultados` y las apuestas de temporadas no activas siguen permitidos. No alteran el bote mientras el recálculo esté bloqueado (Task 7), pero lo mostrado en resultados/apuestas puede dejar de cuadrar con `resultados_miembro`.
- **Concurrencia en `activate`**: dos activaciones simultáneas podrían leer la misma `anterior`; el índice único del heredado evita duplicados (la segunda fallaría con 500 por violación única) y el de `temporadas_una_activa` evita dos activas. Con un único admin el riesgo es bajo; la mejora sería `SELECT ... FOR UPDATE` en `findActiva`.
- **Edición de `fechaInicio` tras crear el heredado**: la fecha del heredado no se actualiza hasta la siguiente activación hacia delante. No afecta a los cálculos (P3) pero se verá en el listado.
- **Carga masiva** (`npm run carga`): activa temporadas sin crear heredado (P11).
- **El ajuste manual "bote heredado" que ya existe en producción** (commit e3af0cf) se asigna a la temporada activa. Correcto: forma parte del bote de esa temporada y se arrastrará automáticamente a la siguiente al activarla.
- **Rollback con heredados creados**: si entre el despliegue y un rollback se activó una temporada nueva, R2 borra su heredado; su importe queda anotado en el paso previo de R2 para recrearlo a mano como ajuste en el modelo antiguo si hiciera falta.

## Autorrevisión

- **Cobertura de decisiones**: D1 → Task 1 (+ verificación Task 9); D2 → Task 3; D3 → Task 4 (pin "boteJornadaAjustado == boteTotal"); D4 → Task 5 (+ idempotencia por índice único, P2); D5 → Task 7 (P9); D6 → Tasks 1, 2 y 6 (P4, P5, P7); D7 → OpenAPI regenerado en Tasks 1, 2, 4, 5, 6 y 7 y comprobado en Task 8; despliegue → Tasks 9 y 10. P6 → Task 6; P8 → Task 3; P10 → tests de fechas de la Task 4.
- **Placeholders**: los únicos valores que no se pueden fijar al escribir el plan son datos que solo existen en tiempo de ejecución y que el paso dice de dónde sacar (`<email de un admin de la BD local>`, `<numero_jornada de D8>`, `<sha anotado en P2>`, `<fecha>` del backup, `<sha del merge>`).
- **Consistencia de nombres y tipos**: `temporadaId` / `origenTemporadaId` (TS) ↔ `temporada_id` / `origen_temporada_id` (SQL) en schema, migración, repositorio, respuestas y queries; índice `ajustes_bote_un_heredado_por_temporada` y check `ajustes_bote_origen_distinto_check` iguales en schema, SQL, D6 y down; `AjustesBoteFiltros` se introduce en la Task 3 y se amplía con `hastaFecha` en la Task 4; `sumaAjustesBote(filtros, tx)` y `boteTemporada(temporadaId, tx)` con la misma firma en Tasks 3, 4 y 5; `activate(codigo, registradoPor)` en servicio y controller (Task 5); mensajes de error idénticos entre implementación y tests (Tasks 2, 6 y 7).
- **Tests robustos al orden de las tareas**: los tests de las Tasks 2 y 3 que activan dos temporadas activan después la más antigua, así que la herencia de la Task 5 no les cambia el resultado; los helpers existentes de dashboard/calculos crean temporadas con la misma `fechaInicio`, que P2 trata como "no hereda".
