# Plan — Nuevos servicios de la API quini (F15 → F21)

> **Estado**: propuesta de trabajo con decisiones cerradas. Nada implementado todavía.
> **Fuente**: `docs/07-Servicios_adicionales.md` (borrador informal) + sesión de cierre de dudas del 2026-08-14.
> **Continúa**: `docs/00-Plan-inicial.md` (F0–F14). F11 —módulo Jornadas— está cerrado y es la plantilla de referencia.
> **Fecha**: 2026-08-14
> **Versión**: v1
> **Objetivo del documento**: convertir el borrador del doc 07 en un plan ejecutable — modelo de datos, contrato de endpoints, algoritmo de cálculo y 7 fases con criterio de aceptación verificable — sin introducir ninguna tecnología ni herramienta nueva.

---

## Índice

0. [Cómo se usa este documento y modo de trabajo](#0-cómo-se-usa-este-documento-y-modo-de-trabajo)
1. [Alcance y decisiones cerradas](#1-alcance-y-decisiones-cerradas)
2. [Dónde encaja en el plan original](#2-dónde-encaja-en-el-plan-original)
3. [Modelo de datos](#3-modelo-de-datos)
4. [Catálogo de endpoints](#4-catálogo-de-endpoints)
5. [Reglas de negocio transversales](#5-reglas-de-negocio-transversales)
6. [Algoritmo de cálculo](#6-algoritmo-de-cálculo)
7. [Fases](#7-fases)
8. [Los cinco puntos de contacto de cada módulo](#8-los-cinco-puntos-de-contacto-de-cada-módulo)
9. [Checklist maestro](#9-checklist-maestro)
10. [Cuestiones abiertas y deuda conocida](#10-cuestiones-abiertas-y-deuda-conocida)
11. [Divergencias respecto a `docs/07-Servicios_adicionales.md`](#11-divergencias-respecto-a-docs07-servicios_adicionalesmd)

---

## 0. Cómo se usa este documento y modo de trabajo

Igual que `00-Plan-inicial.md`: **fase a fase**, y cada fase termina con un criterio de aceptación comprobable con un comando. Si no pasa, no se sigue.

**Modo de trabajo acordado**: la implementación se hace **paso a paso y a mano**. El asistente explica qué hay que hacer y por qué; **tú ejecutas todos los comandos y escribes todo el código**. El asistente solo escribe ficheros `.md` de `docs/`.

Antes de empezar cualquier módulo, la lectura obligada es **`docs/06-ServiciosNegocio.md`**: contiene la anatomía de los 5 ficheros, las convenciones por capa y el checklist de 10 pasos que define "hecho". Este documento **no** repite eso; añade lo que es específico de estos 6 módulos.

Cada fase copia además `docs/specs/_plantilla.md` a `docs/specs/NN-<recurso>.md` antes de escribir código.

**Restricción del encargo, en firme**: cero dependencias nuevas, cero herramientas nuevas. Todo se resuelve con Express 5 + Zod + Drizzle + PostgreSQL 18 + zod-openapi + Vitest/Supertest, que es lo que ya hay instalado. En particular: **no hay scheduler ni cron**; el cierre "automático" de apuestas se deriva comparando `now()` con las fechas en cada petición (N12).

---

## 1. Alcance y decisiones cerradas

### 1.1 Alcance

Seis áreas de negocio, procedentes del doc 07:

| Área              | Qué entra                                                                               | Módulo            | Fase |
| ----------------- | --------------------------------------------------------------------------------------- | ----------------- | ---- |
| Perfil de usuario | Apellidos, apodo, teléfono, crédito                                                     | `usuarios`        | F15  |
| Ciclo de jornada  | Fechas de apertura/cierre de apuestas, cierre de jornada, apuesta oficial al pleno      | `jornadas` (ext.) | F16  |
| Resultados        | 14 signos + pleno + 6 categorías de premio, por jornada                                 | `resultados`      | F17  |
| Apuestas          | 2 apuestas por miembro y jornada, con ventana temporal y trazabilidad de quién las creó | `apuestas`        | F18  |
| Cálculos          | Aciertos, premios, ranking, escalón de pago, bote                                       | `calculos`        | F19  |
| Pagos             | Dinero que el miembro entrega, y crédito resultante                                     | `pagos`           | F20  |
| Dashboard         | Agregados por miembro, jornada y temporada                                              | `dashboard`       | F21  |

### 1.2 Decisiones cerradas

Las respuestas del doc 07 dejaban dos contradicciones internas y varias erratas. Esto es lo que queda cerrado:

| #   | Cuestión                             | Decisión                                                                                                                                         |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| N1  | Forma de la tabla de resultados      | **14 columnas por jornada** (`resultado_1..14`) + `resultado_15` + 6 columnas de premio. El contrato de la API expone un **array**               |
| N2  | Algoritmo de escalones               | **Regla por grupos** (la del ejemplo 2 del doc 07). El ejemplo 1 tenía erratas y se recalcula en §6.3                                            |
| N3  | Entidad de miembro                   | **`idMiembro` = `users.id`**. Peña única e implícita. Sin tablas `penas` ni `miembros`                                                           |
| N4  | Pleno al 15 en el ranking            | Oficial **por jornada** (uno solo), **no cuenta** para aciertos, ranking ni escalones → aciertos de un miembro ∈ **0..14**                       |
| N5  | Categoría de premio 15               | **Se adjudica a los acertantes de 14**, a partes iguales si hay varios. En 30 años de peña nunca ha caído, pero el modelo la contempla           |
| N6  | Bote                                 | `bote_miembro = importe_escalon + premios − 1,50`                                                                                                |
| N7  | Qué resta del crédito                | El **`importe_escalon` completo** (p. ej. 2,20). De ahí, 1,50 es el precio real de las 2 apuestas y el resto es la aportación neta al bote       |
| N8  | Cómo se guarda el crédito            | **Saldo calculado del ledger**, sin columna en `users`: `SUM(pagos.importe) − SUM(resultados_miembro.importe_escalon)`                           |
| N9  | Rutas de apuestas                    | **Anidadas** bajo la jornada: `/jornadas/{n}/apuestas...`, manteniendo `?temporada=` (D17 del plan original)                                     |
| N10 | Nombre del importe del escalón       | Se llama **`importeEscalon`**, no `pago`, para no colisionar con la tabla `pagos` (dinero entregado en mano)                                     |
| N11 | Las 3 fechas y el pleno oficial      | Viven **solo** en endpoints dedicados, no en `POST`/`PUT /jornadas`, para que un reemplazo total no las borre en silencio                        |
| N12 | Cierre automático de apuestas        | **Derivado en cada petición** comparando `now()` con las fechas. Sin cron ni job                                                                 |
| N13 | Cobertura de tests                   | Se mantiene el **100 % por service** que ya exige `vitest.config.ts`. Si alguna fase resulta desproporcionada, se rebaja **ese** umbral concreto |
| N14 | Unidad de reparto de la categoría 15 | **Por apuesta**: cada apuesta con 14 aciertos cobra una parte. Quien clave 14 en sus dos apuestas cobra dos partes                               |

### 1.3 Por qué N7 importa

Con N7 la economía de la jornada cuadra y es auditable:

````text
El miembro paga            importe_escalon   (p. ej. 2,20)  -> se resta de su crédito
La peña gasta en boletos   1,50              (2 x 0,75)     -> coste real
Queda en el bote           0,70 + premios
```text

Sin N7 (si del crédito solo se restaran 1,50), los 0,70 que el bote apunta como aportación del miembro no saldrían del bolsillo de nadie y el bote sería ficticio.

---

## 2. Dónde encaja en el plan original

Estas fases van **después de F11** (Jornadas, cerrado) y **antes de F12** (hardening, CI y despliegue en VPS). Se numeran de forma continua **F15–F21** en lugar de renumerar F12–F14, que ya están escritas y referenciadas en el roadmap, el checklist y el glosario del plan original: renumerarlas no aporta nada y multiplica el riesgo de una errata.

| Fase | Contenido                                       | Estimación  | Depende de | Migración | Entregable verificable                          |
| ---- | ----------------------------------------------- | ----------- | ---------- | --------- | ----------------------------------------------- |
| F15  | Preparación + módulo `usuarios` (perfil)        | 2–3 h       | F11        | `0001`    | `GET /usuarios/me` con el perfil completo       |
| F16  | `jornadas`: 3 fechas + pleno oficial            | 2 h         | F15        | `0002`    | `apuestasAbiertas` derivado y coherente         |
| F17  | Módulo `resultados`                             | 3–4 h       | F16        | `0003`    | Resultados de una jornada guardados y leídos    |
| F18  | Módulo `apuestas`                               | 4–5 h       | F17        | `0004`    | Apuesta rechazada fuera de la ventana (409)     |
| F19  | Módulo `calculos` (+ `escalones_pago` sembrada) | 5–6 h       | F18        | `0005`    | Los 2 ejemplos del doc 07 reproducidos en tests |
| F20  | Módulo `pagos` + crédito en el perfil           | 2–3 h       | F19        | `0006`    | Crédito = ingresos − cargos, sin columna caché  |
| F21  | Módulo `dashboard`                              | 3–4 h       | F20        | —         | Los 3 agregados del doc 07                      |
|      | **Total**                                       | **21–27 h** |            |           |                                                 |

**Camino crítico**: F15 → F16 → F17 → F18 → F19 → F20 → F21. No admite reordenación real:

- F16 antes de F18 porque sin las fechas no hay ventana de apuestas que respetar.
- F17 y F18 antes de F19 porque el cálculo cruza resultados con apuestas.
- **F19 antes de F20**, que es el orden menos evidente: el crédito es `SUM(pagos) − SUM(importe_escalon)`, y los cargos no existen hasta que el cálculo los escribe.
- F21 al final: agrega lo que las anteriores producen.

**Nota sobre F14** (la skill `/quini-api-new` del plan original): estas 6 fases son exactamente el escenario que justifica esa skill. Tras terminar F17 —el primer módulo nuevo hecho a mano y con el patrón ya rodado tres veces— merece la pena valorar escribirla antes de F18, aunque el plan original la coloque al final. No es una tecnología nueva: es una skill de Claude Code, ya prevista en D26.

---

## 3. Modelo de datos

### 3.1 Diagrama

Extiende el diagrama de `00-Plan-inicial.md` §7. En gris conceptual, lo que ya existe; lo nuevo son las cinco tablas de abajo.

```mermaid
erDiagram
    USERS ||--o{ APUESTAS : "hace"
    USERS ||--o{ RESULTADOS_MIEMBRO : "obtiene"
    USERS ||--o{ PAGOS : "entrega"
    TEMPORADAS ||--o{ JORNADAS : "agrupa"
    JORNADAS ||--|{ PARTIDOS : "contiene 15"
    JORNADAS ||--o| RESULTADOS : "tiene 1"
    JORNADAS ||--o{ APUESTAS : "recibe"
    JORNADAS ||--o{ RESULTADOS_MIEMBRO : "liquida"

    USERS {
        uuid id PK
        citext email UK
        text nombre
        text apellidos "NUEVO"
        citext apodo UK "NUEVO, nullable"
        text telefono "NUEVO"
        text role "user | admin"
    }
    JORNADAS {
        uuid id PK
        uuid temporada_id FK
        int numero_jornada
        date fecha
        timestamptz fecha_apertura_apuestas "NUEVO"
        timestamptz fecha_cierre_apuestas "NUEVO"
        timestamptz fecha_cierre_jornada "NUEVO"
        text apuesta_pleno_15 "NUEVO, la oficial de la pena"
    }
    RESULTADOS {
        uuid id PK
        uuid jornada_id FK "UNICO"
        text resultado_1_a_14 "14 columnas, 1|X|2"
        text resultado_15 "pleno, 0-0 .. M-M"
        numeric premio_cat_10_a_15 "6 columnas"
    }
    APUESTAS {
        uuid id PK
        uuid jornada_id FK
        uuid usuario_id FK
        smallint numero_apuesta "1 | 2"
        text partido_1_a_14 "14 columnas, 1|X|2"
        text sugerencia_pleno_15 "nullable, informativa"
        uuid creada_por FK "el propio usuario o un admin"
    }
    ESCALONES_PAGO {
        uuid id PK
        smallint escalon UK "1..10"
        numeric importe "1,50 .. 2,50"
    }
    RESULTADOS_MIEMBRO {
        uuid id PK
        uuid jornada_id FK
        uuid usuario_id FK
        smallint aciertos_apuesta_1
        smallint aciertos_apuesta_2 "nullable"
        smallint aciertos_max
        numeric premio_apuesta_1
        numeric premio_apuesta_2
        smallint ranking
        smallint escalon
        numeric importe_escalon "cargo: resta del credito"
        numeric coste_apuestas "1,50 fijo"
        numeric bote
    }
    PAGOS {
        uuid id PK
        uuid usuario_id FK
        numeric importe
        date fecha_pago
        uuid registrado_por FK
    }
```text

### 3.2 Tablas nuevas

Todas siguen las convenciones ya establecidas en `src/db/schema/`: `pgTable`, PK `uuid().primaryKey().default(sql\`uuidv7()\`)`,`timestamp(..., { withTimezone: true })`, columnas`snake_case`explícitas y constraints con **nombre propio** en el callback`(t) => [...]`, igual que`src/db/schema/temporadas.ts`.

#### `resultados` — una fila por jornada (N1)

| Columna                           | Tipo                             | Notas                                             |
| --------------------------------- | -------------------------------- | ------------------------------------------------- |
| `id`                              | uuid PK                          |                                                   |
| `jornada_id`                      | uuid                             | FK → `jornadas` **ON DELETE CASCADE**, **UNIQUE** |
| `resultado_1` … `resultado_14`    | text NOT NULL                    | 14 columnas                                       |
| `resultado_15`                    | text NOT NULL                    | El pleno. Siempre hay resultado (doc 07)          |
| `premio_cat_10` … `premio_cat_15` | numeric(12,2) NOT NULL DEFAULT 0 | 6 columnas. `0` = sin acertantes / bote           |
| `created_at`, `updated_at`        | timestamptz                      |                                                   |

Constraints:

```text
resultados_jornada_key        UNIQUE (jornada_id)
resultados_resultado_N_check  CHECK (resultado_N ~ '^[1X2]$')        -- N = 1..14
resultados_resultado_15_check CHECK (resultado_15 ~ '^[012M]-[012M]$')
resultados_premio_N_check     CHECK (premio_cat_N >= 0)              -- N = 10..15
```text

#### `apuestas`

| Columna                    | Tipo              | Notas                                                       |
| -------------------------- | ----------------- | ----------------------------------------------------------- |
| `id`                       | uuid PK           |                                                             |
| `jornada_id`               | uuid              | FK → `jornadas` **CASCADE**                                 |
| `usuario_id`               | uuid              | FK → `users` **RESTRICT** (no borrar quien tiene historial) |
| `numero_apuesta`           | smallint NOT NULL | 1 o 2                                                       |
| `partido_1` … `partido_14` | text NOT NULL     | 14 columnas, obligatorias todas                             |
| `sugerencia_pleno_15`      | text NULL         | Informativa (N4): no puntúa, ayuda al admin a decidir       |
| `creada_por`               | uuid              | FK → `users`. El propio usuario o un admin                  |
| `created_at`, `updated_at` | timestamptz       |                                                             |

```text
apuestas_jornada_usuario_numero_key UNIQUE (jornada_id, usuario_id, numero_apuesta)
apuestas_numero_check               CHECK (numero_apuesta IN (1, 2))
apuestas_partido_N_check            CHECK (partido_N ~ '^[1X2]$')     -- N = 1..14
apuestas_pleno_check                CHECK (sugerencia_pleno_15 ~ '^[012M]-[012M]$')
```text

#### `escalones_pago` — tabla de configuración, sin API

| Columna   | Tipo                   |
| --------- | ---------------------- |
| `id`      | uuid PK                |
| `escalon` | smallint **UNIQUE**    |
| `importe` | numeric(12,2) NOT NULL |

```text
escalones_pago_escalon_key   UNIQUE (escalon)
escalones_pago_escalon_check CHECK (escalon BETWEEN 1 AND 10)
escalones_pago_importe_check CHECK (importe > 0)
```text

Contenido, verbatim del doc 07 (**ojo: del escalón 1 al 2 el salto es de 0,20; no hay 1,60**):

| escalón | importe |
| ------- | ------- |
| 10      | 2,50    |
| 9       | 2,40    |
| 8       | 2,30    |
| 7       | 2,20    |
| 6       | 2,10    |
| 5       | 2,00    |
| 4       | 1,90    |
| 3       | 1,80    |
| 2       | 1,70    |
| 1       | 1,50    |

#### `resultados_miembro` — el resultado del cálculo

| Columna                    | Tipo                                | Notas                                          |
| -------------------------- | ----------------------------------- | ---------------------------------------------- |
| `id`                       | uuid PK                             |                                                |
| `jornada_id`               | uuid                                | FK → `jornadas` **CASCADE**                    |
| `usuario_id`               | uuid                                | FK → `users` **RESTRICT**                      |
| `aciertos_apuesta_1`       | smallint NULL                       | 0..14                                          |
| `aciertos_apuesta_2`       | smallint NULL                       | NULL si el miembro solo tiene una apuesta      |
| `aciertos_max`             | smallint NOT NULL                   | Base del ranking y del escalón                 |
| `premio_apuesta_1`         | numeric(12,2) DEFAULT 0             |                                                |
| `premio_apuesta_2`         | numeric(12,2) DEFAULT 0             |                                                |
| `ranking`                  | smallint NOT NULL                   | 1 = más aciertos                               |
| `escalon`                  | smallint NOT NULL                   | 1..10                                          |
| `importe_escalon`          | numeric(12,2) NOT NULL              | **El cargo**: es lo que resta del crédito (N7) |
| `coste_apuestas`           | numeric(12,2) NOT NULL DEFAULT 1.50 | **El gasto**: precio real de las 2 apuestas    |
| `bote`                     | numeric(12,2) NOT NULL              | `importe_escalon + premios − coste_apuestas`   |
| `created_at`, `updated_at` | timestamptz                         |                                                |

```text
resultados_miembro_jornada_usuario_key UNIQUE (jornada_id, usuario_id)
resultados_miembro_aciertos_N_check    CHECK (aciertos_N BETWEEN 0 AND 14)
resultados_miembro_escalon_check       CHECK (escalon BETWEEN 1 AND 10)
resultados_miembro_ranking_check       CHECK (ranking >= 1)
```text

#### `pagos` — dinero que el miembro entrega

| Columna          | Tipo                   | Notas                                |
| ---------------- | ---------------------- | ------------------------------------ |
| `id`             | uuid PK                |                                      |
| `usuario_id`     | uuid                   | FK → `users` **RESTRICT**            |
| `importe`        | numeric(12,2) NOT NULL | `> 0`                                |
| `fecha_pago`     | date NOT NULL          | Cuándo se entregó el dinero          |
| `registrado_por` | uuid                   | FK → `users`. El admin que lo apuntó |
| `created_at`     | timestamptz            | Cuándo se metió en el sistema        |

```text
pagos_importe_check CHECK (importe > 0)
```text

### 3.3 Tablas modificadas

`users` (migración `0001`):

| Columna     | Tipo        | Notas                                                   |
| ----------- | ----------- | ------------------------------------------------------- |
| `apellidos` | text NULL   |                                                         |
| `apodo`     | citext NULL | **UNIQUE**. En Postgres varios `NULL` no colisionan     |
| `telefono`  | text NULL   | Sin `CHECK` de formato: se valida en Zod, sin librerías |

Sin columna `credito` (N8).

`jornadas` (migración `0002`):

| Columna                   | Tipo             |
| ------------------------- | ---------------- |
| `fecha_apertura_apuestas` | timestamptz NULL |
| `fecha_cierre_apuestas`   | timestamptz NULL |
| `fecha_cierre_jornada`    | timestamptz NULL |
| `apuesta_pleno_15`        | text NULL        |

```text
jornadas_ventana_check CHECK (
    fecha_apertura_apuestas IS NULL
 OR fecha_cierre_apuestas   IS NULL
 OR fecha_cierre_apuestas > fecha_apertura_apuestas
)
jornadas_pleno_check CHECK (apuesta_pleno_15 ~ '^[012M]-[012M]$')
```text

### 3.4 Defensa en dos capas

Mismo criterio que el plan original §7: Zod rechaza en el borde (400) y PostgreSQL garantiza la integridad (409 / imposible).

| Regla                                               | Zod (→400)                                             | PostgreSQL                                                                     |
| --------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Los 14 signos son `1`, `X` o `2`                    | `z.enum(["1","X","2"])` × 14 en un array `.length(14)` | 14 `CHECK (~ '^[1X2]$')`                                                       |
| El pleno tiene la forma `n-n` con `n ∈ {0,1,2,M}`   | `z.string().regex(/^[012M]-[012M]$/)`                  | `CHECK (~ '^[012M]-[012M]$')`                                                  |
| Un resultado por jornada                            | —                                                      | `UNIQUE (jornada_id)` → violación ⇒ **upsert**                                 |
| Dos apuestas por miembro y jornada, numeradas 1 y 2 | `z.literal(1).or(z.literal(2))`                        | `UNIQUE (jornada_id, usuario_id, numero_apuesta)` + `CHECK IN (1,2)` → **409** |
| Importes de euros no negativos y con 2 decimales    | `importeEuros` (§3.5)                                  | `CHECK (>= 0)`, `numeric(12,2)`                                                |
| Un cálculo por miembro y jornada                    | —                                                      | `UNIQUE (jornada_id, usuario_id)` → **upsert**                                 |
| No borrar un usuario con apuestas, cálculos o pagos | —                                                      | FK `ON DELETE RESTRICT` → **409**                                              |
| Borrar una jornada arrastra resultados y apuestas   | —                                                      | FK `ON DELETE CASCADE` (con guarda en el service, §5)                          |
| La ventana de apuestas es coherente                 | `refine(cierre > apertura)`                            | `jornadas_ventana_check`                                                       |

### 3.5 Puntos de diseño que conviene tener claros antes de escribir código

**`importe_escalon` y `coste_apuestas` son columnas distintas a propósito.** La primera es el **cargo** al miembro (lo que resta de su crédito, N7); la segunda es el **gasto** real en boletos. El bote es la diferencia más los premios. Si un día cambia el precio del boleto, `coste_apuestas` deja de ser 1,50 y el histórico sigue siendo correcto porque el valor está guardado fila a fila.

**`escalon` e `importe_escalon` se guardan desnormalizados**, sin FK a `escalones_pago`. Si mañana se retoca el importe de un escalón, las jornadas ya calculadas no se reescriben solas. Es el mismo criterio con el que una factura guarda el precio y no un puntero al catálogo.

**`escalones_pago` NO entra en `tests/setup/truncate.ts`.** Se siembra en la migración `0005` y ninguna FK apunta a ella, así que el `TRUNCATE ... RESTART IDENTITY CASCADE` del `beforeEach` no la alcanza mientras no se la nombre. Si se añade a esa lista, **todos** los tests de cálculos se quedan sin escalones y fallan de forma desconcertante.

**Dinero**: `numeric(12,2)` en la base, `number` con 2 decimales en el contrato. Dos avisos:

1. Drizzle devuelve `numeric` como **string** por defecto. Antes de escribir el repository, comprobar si `numeric(name, { precision: 12, scale: 2, mode: "number" })` está soportado en `drizzle-orm@0.45.2`; si no lo está, mapear con `Number()` en el repository y **no** dejar que un string se cuele hasta el service.
2. El algoritmo de cálculo opera **en céntimos enteros** (`Math.round(euros * 100)`) y solo convierte a euros al construir la respuesta. Repartir un premio entre 3 apuestas con aritmética de coma flotante produce descuadres de un céntimo que luego no se pueden explicar.

**Estado derivado, no almacenado** — es la respuesta a la cuestión pendiente #1 del doc 07 ("no hace falta estado, lo hace más complejo"):

```ts
apuestasAbiertas =
  fechaAperturaApuestas !== null &&
  fechaCierreApuestas !== null &&
  fechaAperturaApuestas <= now &&
  now < fechaCierreApuestas &&
  fechaCierreJornada === null;
```text

No hay enum de estado que mantener. Una jornada recién creada tiene las tres fechas a `NULL` → apuestas cerradas hasta que el admin las abra. El "cierre manual" y el "cierre programado" son **el mismo campo** (`fecha_cierre_apuestas`), tal y como se cerró en el doc 07.

**Primitivas Zod compartidas entre módulos.** El proyecto ya tiene el patrón: `jornadas.schemas.ts` importa `codigoTemporada` de `temporadas.schemas.js`. Se sigue igual, sin crear una carpeta de esquemas comunes:

| Primitiva       | Se define en            | La reutilizan                                |
| --------------- | ----------------------- | -------------------------------------------- |
| `signoQuiniela` | `resultados.schemas.ts` | `apuestas.schemas.ts`                        |
| `plenoAl15`     | `resultados.schemas.ts` | `apuestas.schemas.ts`, `jornadas.schemas.ts` |
| `importeEuros`  | `resultados.schemas.ts` | `calculos`, `pagos`, `dashboard`             |

```ts
export const signoQuiniela = z.enum(["1", "X", "2"]);
export const plenoAl15 = z.string().regex(/^[012M]-[012M]$/);
export const importeEuros = z
  .number()
  .nonnegative()
  .refine((v) => Number(v.toFixed(2)) === v, "Máximo 2 decimales.");
```text

---

## 4. Catálogo de endpoints

Base: `/api/v1`. La columna **Auth** indica lo mínimo exigido. Todas las rutas colgadas de una jornada admiten `?temporada=<codigo>` y, si no se indica, resuelven contra la **temporada activa** (D17 del plan original).

### 4.1 Perfil de usuario (F15, crédito en F20)

| Método | Ruta             | Auth      | Descripción                                                                    |
| ------ | ---------------- | --------- | ------------------------------------------------------------------------------ |
| GET    | `/usuarios/me`   | Bearer    | Perfil completo + `credito`. Distinto de `/auth/me`, que es la sonda del token |
| PUT    | `/usuarios/me`   | Bearer    | `nombre`, `apellidos`, `apodo`, `telefono`. **Nunca** `email` ni `role`        |
| GET    | `/usuarios`      | **admin** | Lista de miembros con su crédito                                               |
| GET    | `/usuarios/{id}` | **admin** | Detalle                                                                        |
| PUT    | `/usuarios/{id}` | **admin** | Actualiza el perfil de otro miembro                                            |

### 4.2 Ciclo de la jornada (F16)

| Método | Ruta                            | Auth      | Descripción                                                                          |
| ------ | ------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| PUT    | `/jornadas/{n}/fechas`          | **admin** | Fija las 3 fechas (cualquiera puede ir a `null`). Es también la vía para **reabrir** |
| POST   | `/jornadas/{n}/cerrar-apuestas` | **admin** | Atajo: `fecha_cierre_apuestas = now()`                                               |
| PUT    | `/jornadas/{n}/pleno`           | **admin** | Apuesta oficial de la peña al pleno (una por jornada)                                |

### 4.3 Resultados (F17)

| Método | Ruta                       | Auth      | Descripción                                                  |
| ------ | -------------------------- | --------- | ------------------------------------------------------------ |
| GET    | `/jornadas/{n}/resultados` | Bearer    | 200 con los 14 + pleno + premios; 404 si no hay              |
| PUT    | `/jornadas/{n}/resultados` | **admin** | Upsert: **201 + `Location`** al crear, **200** al actualizar |
| DELETE | `/jornadas/{n}/resultados` | **admin** | 204; **409** si la jornada ya está calculada                 |

### 4.4 Apuestas (F18)

| Método | Ruta                                     | Auth   | Descripción                                                     |
| ------ | ---------------------------------------- | ------ | --------------------------------------------------------------- |
| POST   | `/jornadas/{n}/apuestas`                 | Bearer | 201 + `Location`. `usuarioId` en el body **solo** para admin    |
| GET    | `/jornadas/{n}/apuestas`                 | Bearer | Admin siempre; el resto **solo con las apuestas cerradas** (§5) |
| GET    | `/jornadas/{n}/apuestas/mias`            | Bearer | Las del usuario del token                                       |
| PUT    | `/jornadas/{n}/apuestas/{numeroApuesta}` | Bearer | Reemplazo total de los 14 signos                                |
| DELETE | `/jornadas/{n}/apuestas/{numeroApuesta}` | Bearer | 204                                                             |

### 4.5 Cálculos (F19)

| Método | Ruta                            | Auth      | Descripción                                                        |
| ------ | ------------------------------- | --------- | ------------------------------------------------------------------ |
| POST   | `/calculos`                     | **admin** | Body `{ jornada, temporada? }`. **Idempotente**. Cierra la jornada |
| GET    | `/calculos?jornada=&temporada=` | Bearer    | Resultado: fila por miembro (ordenada por `ranking`) + agregados   |

`POST /calculos` responde **200**, no 201: no crea un recurso direccionable nuevo, ejecuta una operación cuyo resultado se consulta en `GET /calculos`.

### 4.6 Pagos (F20)

| Método | Ruta          | Auth      | Descripción                                                      |
| ------ | ------------- | --------- | ---------------------------------------------------------------- |
| POST   | `/pagos`      | **admin** | `{ usuarioId, importe, fechaPago }` → 201                        |
| GET    | `/pagos`      | **admin** | `?usuario=&desde=&hasta=`                                        |
| GET    | `/pagos/mios` | Bearer    | Los del usuario del token                                        |
| DELETE | `/pagos/{id}` | **admin** | 204. **No hay `PUT`**: un pago mal apuntado se borra y se recrea |

### 4.7 Dashboard (F21)

| Método | Ruta                   | Auth   | Query                  | Devuelve                                                                                                                                                                                  |
| ------ | ---------------------- | ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/dashboard/miembro`   | Bearer | `?temporada=&usuario=&jornada=` | `pagosTotales` (Σ `importe_escalon`), `ingresosTotales` (Σ `pagos`), `credito`, `mediaAciertos`, `maxAciertos`, `minAciertos`, `maxPremio`, `premiosTotales`, `porcentajeApuestasPropias` |
| GET    | `/dashboard/jornada`   | Bearer | `?jornada=&temporada=` | `pagosJornada`, `boteJornada`, `mediaAciertosDosApuestas`, `mediaAciertosMaximos`, `premiosTotales`, `clasificacion[]`                                                                    |
| GET    | `/dashboard/temporada` | Bearer | `?temporada=`          | `maxAciertos` + quiénes, `minAciertos` + quiénes, `premiosTotales`, `pagosTotales`, `boteTotal`, `jornadasCalculadas`                                                                     |

Sin `?usuario=`, `/dashboard/miembro` devuelve el del token. Un `user` que pida otro recibe **403**; un `admin`, cualquiera. Con `?jornada=N` los agregados son acumulados hasta la jornada N inclusive: resultados y apuestas con `numero_jornada <= N`; pagos y `credito` con `fecha_pago` / fecha de jornada `<=` la fecha de la jornada N. Jornada inexistente o sin cálculo: **404**; no entera o `< 1`: **400**. Sin el parámetro, temporada completa.

### 4.8 Aviso sobre `/usuarios/me` y el orden de las rutas

En Express, `/usuarios/:id` declarado **antes** de `/usuarios/me` captura `me` como si fuera un id, y el `validate({ params })` con `z.uuid()` responde **400** en lugar de servir el perfil. Las rutas literales van siempre primero:

```ts
usuariosRouter.get("/me", requireAuth, getMe); // PRIMERO
usuariosRouter.put("/me", requireAuth, validate({ body: UpdatePerfilSchema }), updateMe);
usuariosRouter.get("/", requireAuth, requireRole("admin"), findAll);
usuariosRouter.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  validate({ params: UsuarioIdParamSchema }),
  findById,
);
```text

Lo mismo aplica a `/pagos/mios` frente a `/pagos/{id}`, y a `/jornadas/{n}/apuestas/mias` frente a `/jornadas/{n}/apuestas/{numeroApuesta}`.

---

## 5. Reglas de negocio transversales

**Ventana de apuestas.** Crear, editar o borrar una apuesta exige `apuestasAbiertas`. Cerrada → **409 `CONFLICT`**, y esto vale **para todos, incluido el admin**: en el momento en que se cierran las apuestas, los boletos ya están jugados en la administración de loterías y cambiar la base de datos sería mentir. La vía de escape existe y es auditable: mover `fecha_cierre_apuestas` con `PUT /jornadas/{n}/fechas`.

**Propiedad de la apuesta.** Un `user` solo opera sobre sus propias apuestas: mandar el `usuarioId` de otro es **403**. Un `admin` puede crear y editar por cualquiera —es el caso previsto en el doc 07: "en caso de que no la cree, el administrador la hará por ellos"—. `apuestas.creada_por` guarda quién la escribió de verdad, y de ahí sale el `porcentajeApuestasPropias` del dashboard, que era el objetivo declarado del campo `idUsuario` del doc 07.

**Visibilidad de las apuestas de los demás.** Mientras las apuestas están abiertas, `GET /jornadas/{n}/apuestas` es solo para admin (**403** para el resto): si todos se vieran en tiempo real, la primera apuesta condicionaría al resto. Una vez cerradas, cualquiera autenticado las ve — es una peña, no un secreto.

**Guardas nuevas en `jornadas`.** `PUT` y `DELETE` de una jornada que tenga resultados o apuestas → **409**. Sin esto, reemplazar los 15 partidos deja los resultados y los aciertos apuntando a otros partidos, y el error no se manifiesta hasta que alguien mira la clasificación y no cuadra. Se implementa de forma incremental: la guarda por resultados en F17 y la guarda por apuestas en F18, porque hasta entonces esas tablas no existen.

**Borrado de una jornada.** A nivel de base de datos, `resultados`, `apuestas` y `resultados_miembro` cuelgan de la jornada con `ON DELETE CASCADE`: son hijos suyos y no tienen sentido sin ella. La red de seguridad no es el `RESTRICT`, es la guarda del service: el admin tiene que borrar primero los resultados y las apuestas, de forma explícita.

**Contrato de errores.** Se reutiliza el catálogo de `00-Plan-inicial.md` §10 **sin añadir ni un código nuevo**. Todos los estados de negocio inválidos (apuestas cerradas, faltan resultados, temporada no activa, jornada ya calculada) son `CONFLICT` **409**. Los servicios lanzan las subclases de `AppError` que ya existen en `src/core/errors.ts` y el `error-handler` sigue siendo el único sitio que serializa.

**Autorización.** El patrón no cambia: `requireAuth` en lectura, `requireRole("admin")` en escritura de administración, y el orden de middlewares siempre `requireAuth → requireRole → validate → controller`. La novedad son los endpoints donde el permiso depende **del dato**, no solo del rol (apuestas propias, `?usuario=` del dashboard): eso se comprueba en el **service**, no en un middleware, porque necesita saber de quién es el recurso.

---

## 6. Algoritmo de cálculo

### 6.1 Requisitos previos

Del doc 07, con los códigos HTTP asignados:

| Requisito                                  | Si falla |
| ------------------------------------------ | -------- |
| La temporada existe                        | 404      |
| La temporada está **activa**               | 409      |
| La jornada existe                          | 404      |
| Las apuestas están **cerradas**            | 409      |
| Hay resultados registrados para la jornada | 409      |
| Hay al menos una apuesta                   | 409      |
| Quien lo ejecuta es `admin`                | 403      |

### 6.2 El algoritmo

```text
 1. temporada = temporadasService.resolveTemporada(temporada?)      -> 404
    si !temporada.activa                                           -> 409
 2. jornada   = jornadasService.findByNumero(n, temporada.codigo)   -> 404
 3. si apuestasAbiertas(jornada)                                    -> 409
 4. resultados = resultadosRepo.findByJornada(jornada.id)           -> 409 si no existen
 5. apuestas   = apuestasRepo.findByJornada(jornada.id)             -> 409 si no hay ninguna

 6. ACIERTOS Y PREMIO BASE, por apuesta:
      aciertos    = COUNT(partido_k == resultado_k) para k = 1..14
                    // el pleno NO cuenta (N4): el maximo es 14
      premio_base = aciertos entre 10 y 14 ? premio_cat_<aciertos> : 0

 7. REPARTO DE LA CATEGORIA 15 (N5, N14 -> la unidad es la APUESTA):
      acertantes14 = apuestas con aciertos == 14
      si acertantes14 no esta vacio:
          parte = premio_cat_15 / acertantes14.length
          // en centimos enteros; el resto (0..n-1 centimos) se asigna
          // por orden de apuesta.id ascendente, para que reejecutar
          // el calculo de exactamente el mismo resultado
      premio(apuesta) = premio_base + parte
      // un miembro con 14 en sus dos apuestas cobra dos partes

 8. AGREGADO POR MIEMBRO (solo miembros con >= 1 apuesta):
      aciertos_max = MAX(aciertos de sus apuestas)
      premios      = SUMA(premio de sus apuestas)

 9. GRUPOS Y ESCALON:
      grupos = valores distintos de aciertos_max, ordenados ASC
      para j = 0 .. grupos.length - 1:
          escalon(grupo_j) = MAX(1, 10 - j)     // j = 0 es quien menos acerto
      ranking(grupo_j) = posicion del grupo ordenado DESC, base 1

10. EXCEPCION DEL ACERTANTE UNICO:
      si el grupo MAS ALTO tiene exactamente 1 miembro
         -> ese miembro pasa al escalon 1 (1,50)

11. LIQUIDACION, por miembro:
      importe_escalon = escalones_pago[escalon].importe   // resta del credito (N7)
      coste_apuestas  = 1,50                              // precio real de las 2 apuestas
      bote_miembro    = importe_escalon + premios - coste_apuestas

12. UPSERT en resultados_miembro por (jornada_id, usuario_id), TODO en una transaccion
13. jornada.fecha_cierre_jornada = now()
14. devolver: fila por miembro + agregados de la jornada
```text

Reglas que hay que dejar escritas en el service:

- **Idempotencia**. Reejecutar sobrescribe. Es seguro porque el crédito se calcula del ledger (N8): no hay saldo cacheado que haya que deshacer primero. Por el mismo motivo, el reparto de la categoría 15 tiene que ser **determinista**.
- **Clamp del escalón a 1**. La tabla tiene 10 escalones; con más de 10 grupos, `10 - j` se saldría por abajo.
- **Miembros con una sola apuesta**. Entran en el cálculo con `aciertos_apuesta_2 = NULL`. Los miembros con cero apuestas quedan fuera del ranking (no se les cobra nada).
- **La excepción del escalón 1** se aplica al **máximo único**, y su importe es **1,50**. El `(1,00)` que aparece en un párrafo del doc 07 es una errata: la tabla de escalones y el ejemplo 2 dicen 1,50.
- **El pleno se guarda aunque no puntúe**. `resultados.resultado_15` y `jornadas.apuesta_pleno_15` son el dato oficial de la jornada y aparecen en el dashboard.

### 6.3 Ejemplo 1 recalculado

El ejemplo 1 del doc 07 tiene la tabla y el texto inconsistentes con su propio ejemplo 2 (asigna el escalón 7 al grupo de 7 aciertos y mezcla 8 y 9 dentro del grupo de 8). Aplicando el algoritmo:

Sin premios en esta jornada (el máximo son 8 aciertos, por debajo de la categoría 10).

| Miembro | Aciertos ap. 1 | Aciertos ap. 2 | Máximo | Grupo | Escalón | Importe | Bote |
| ------- | -------------- | -------------- | ------ | ----- | ------- | ------- | ---- |
| user 6  | 5              | 5              | **5**  | 1.º   | **10**  | 2,50    | 1,00 |
| user 9  | 6              | 6              | **6**  | 2.º   | **9**   | 2,40    | 0,90 |
| user 1  | 3              | 7              | **7**  | 3.º   | **8**   | 2,30    | 0,80 |
| user 2  | 5              | 7              | **7**  | 3.º   | **8**   | 2,30    | 0,80 |
| user 4  | 4              | 7              | **7**  | 3.º   | **8**   | 2,30    | 0,80 |
| user 5  | 6              | 7              | **7**  | 3.º   | **8**   | 2,30    | 0,80 |
| user 10 | 6              | 7              | **7**  | 3.º   | **8**   | 2,30    | 0,80 |
| user 3  | 8              | 8              | **8**  | 4.º   | **7**   | 2,20    | 0,70 |
| user 7  | 6              | 8              | **8**  | 4.º   | **7**   | 2,20    | 0,70 |
| user 8  | 8              | 7              | **8**  | 4.º   | **7**   | 2,20    | 0,70 |

El grupo más alto (8 aciertos) tiene **tres** miembros → no se aplica la excepción del acertante único.

Cuadre de la jornada:

```text
Σ importe_escalon = 2,50 + 2,40 + 5 x 2,30 + 3 x 2,20 = 23,00
Σ coste_apuestas  = 10 x 1,50                          = 15,00
Σ premios                                              =  0,00
bote de la jornada = 23,00 - 15,00 + 0,00              =  8,00
```text

### 6.4 Ejemplo 2 recalculado

Este es el ejemplo que valida el algoritmo: los escalones salen **idénticos** a la tabla del doc 07. Lo único que se corrige es la columna del bote, que allí no restaba los 1,50, y el `2` de la columna de importe de user 2, que es un `2,50`.

Premio de categoría 10 = **10,49**, que gana la apuesta 2 de user 6 (10 aciertos).

| Miembro | Aciertos ap. 1 | Aciertos ap. 2 | Máximo | Grupo | Escalón | Importe | Premios | Bote      |
| ------- | -------------- | -------------- | ------ | ----- | ------- | ------- | ------- | --------- |
| user 2  | 4              | 4              | **4**  | 1.º   | **10**  | 2,50    | —       | 1,00      |
| user 4  | 5              | 5              | **5**  | 2.º   | **9**   | 2,40    | —       | 0,90      |
| user 9  | 5              | 5              | **5**  | 2.º   | **9**   | 2,40    | —       | 0,90      |
| user 1  | 6              | 4              | **6**  | 3.º   | **8**   | 2,30    | —       | 0,80      |
| user 3  | 7              | 4              | **7**  | 4.º   | **7**   | 2,20    | —       | 0,70      |
| user 7  | 7              | 6              | **7**  | 4.º   | **7**   | 2,20    | —       | 0,70      |
| user 8  | 6              | 7              | **7**  | 4.º   | **7**   | 2,20    | —       | 0,70      |
| user 10 | 7              | 7              | **7**  | 4.º   | **7**   | 2,20    | —       | 0,70      |
| user 5  | 8              | 7              | **8**  | 5.º   | **6**   | 2,10    | —       | 0,60      |
| user 6  | 8              | 10             | **10** | 6.º   | **1** ⚠ | 1,50    | 10,49   | **10,49** |

⚠ user 6 es el **único** miembro del grupo más alto → se le aplica la excepción y baja al escalón 1 (1,50) en vez del 5 que le tocaría por orden de grupo.

Cuadre de la jornada:

```text
Σ importe_escalon = 2,50 + 2 x 2,40 + 2,30 + 4 x 2,20 + 2,10 + 1,50 = 22,00
Σ coste_apuestas  = 10 x 1,50                                       = 15,00
Σ premios                                                           = 10,49
bote de la jornada = 22,00 - 15,00 + 10,49                           = 17,49
```text

Estos dos ejemplos se convierten literalmente en dos tests unitarios de F19. El ejemplo 2 es la prueba de que el algoritmo es el que la peña tiene en la cabeza; el ejemplo 1, la prueba de que se corrigió una errata a conciencia y no por descuido.

---

## 7. Fases

Cada fase sigue el formato de F10/F11 del plan original: objetivo, esquema, tabla de ficheros, matriz de aceptación (una fila = un test), bloque de aceptación con `curl` y "qué aprendes". Al hacerse paso a paso, cada fase se recorre en este orden, verificando en cada paso:

```text
spec (docs/specs/NN-*.md) -> schema de BD -> migracion (LEER el .sql)
   -> schemas Zod -> repository -> service -> controller -> routes
   -> openapi -> tests -> npm run typecheck && npm run lint && npm test
```text

---

### F15 — Preparación y perfil de usuario (≈ 2–3 h)

**Objetivo**: dejar el terreno preparado para seis módulos nuevos y entregar el perfil de usuario.

#### Paso 0 — Deuda que hay que pagar antes, no después

`isUniqueViolation` e `isForeignKeyViolation` están hoy **copiados a mano en cinco services** (`jornadas`, `equipos`, `temporadas`, `auth`, `invitations`). Con seis módulos más serían once copias de la misma lógica de "desenvolver `err.cause` y comparar el SQLSTATE".

Se extraen a `src/core/db-errors.ts`:

```ts
export function isUniqueViolation(err: unknown): boolean; // 23505
export function isForeignKeyViolation(err: unknown): boolean; // 23503, 23001
```text

y los cinco services pasan a importarlo. **Criterio de aceptación**: `npm test` sigue verde sin tocar ningún test — los casos 409 existentes ya cubren ambas funciones.

#### Paso 1 — La primera migración incremental

Hasta ahora todo el esquema vive en una única migración (`drizzle/0000_cute_thunderbolts.sql`) que se ha ido regenerando desde cero. **Eso termina aquí**: `0001` es la primera migración que se **encadena**, y a partir de este punto ninguna migración ya aplicada se regenera ni se edita.

`0001` añade a `users`: `apellidos`, `apodo` (citext, único) y `telefono`.

#### Paso 2 — Módulo `usuarios`

| Fichero                  | Responsabilidad                                                                                     | Detalle crítico                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `usuarios.schemas.ts`    | `UpdatePerfilSchema` (todos los campos opcionales), `UsuarioResponseSchema`, `UsuarioIdParamSchema` | `UpdatePerfilSchema` usa **`.strict()`**: mandar `role` o `email` da un **400** explícito en vez de ignorarse en silencio |
| `usuarios.repository.ts` | `findById`, `findAll`, `updatePerfil`                                                               | Nunca devuelve `password_hash`: se seleccionan las columnas de forma explícita                                            |
| `usuarios.service.ts`    | `getMe`, `updateMe`, `findAll`, `findById`, `update`                                                | Violación de unicidad del `apodo` → **409** con `isUniqueViolation` (ya compartido)                                       |
| `usuarios.controller.ts` | CRUD de perfil                                                                                      | `requireAuthContext(req)` da el `userId` para `/me`                                                                       |
| `usuarios.routes.ts`     | `/me` **antes** de `/:id` (§4.8)                                                                    | Lectura del propio perfil: cualquier autenticado. Listado y perfil de otros: `requireRole("admin")`                       |

`credito` **no** aparece todavía: se añade al `UsuarioResponseSchema` en F20, cuando existe el ledger. Es un cambio aditivo y no rompe a ningún cliente.

**Matriz de aceptación**:

| #   | Caso                                                | Esperado                                |
| --- | --------------------------------------------------- | --------------------------------------- |
| 1   | `GET /usuarios/me` sin token                        | 401                                     |
| 2   | `GET /usuarios/me` con token                        | 200 con nombre/apellidos/apodo/teléfono |
| 3   | `PUT /usuarios/me` válido                           | 200 con los datos actualizados          |
| 4   | `PUT /usuarios/me` con apodo de otro miembro        | **409**                                 |
| 5   | `PUT /usuarios/me` con apodo en otra capitalización | **409** (es `citext`)                   |
| 6   | `PUT /usuarios/me` mandando `role: "admin"`         | **400** (por `.strict()`)               |
| 7   | `PUT /usuarios/me` con `telefono: "  "`             | 400                                     |
| 8   | `GET /usuarios` como `user`                         | **403**                                 |
| 9   | `GET /usuarios` como `admin`                        | 200                                     |
| 10  | `GET /usuarios/{id}` inexistente (admin)            | 404                                     |
| 11  | `GET /usuarios/{id}` con id no UUID                 | 400                                     |
| 12  | `PUT /usuarios/{id}` como `user`                    | 403                                     |
| 13  | Ninguna respuesta incluye `passwordHash`            | verificado en el test                   |
| 14  | Las respuestas cumplen el esquema OpenAPI           | contract test verde                     |

**Aceptación**:

```bash
npm run db:generate && cat drizzle/0001_*.sql   # LEER la migración antes de aplicarla
npm run db:migrate
curl -s -X PUT http://localhost:3000/api/v1/usuarios/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"apellidos":"Fernández López","apodo":"Jota","telefono":"600123456"}' | jq
curl -s http://localhost:3000/api/v1/usuarios/me -H "Authorization: Bearer $TOKEN" | jq
npm test
```text

**Qué aprendes**: migraciones incrementales de verdad, `citext` con unicidad opcional (`NULL` no colisiona en Postgres), `.strict()` de Zod como defensa contra escalada de privilegios por un campo de más, y por qué el orden de declaración de rutas en Express no es cosmético.

---

### F16 — Jornadas: fechas de apuestas y pleno oficial (≈ 2 h)

**Objetivo**: dar a la jornada su ciclo de vida sin introducir un campo de estado (respuesta a la cuestión pendiente #1 del doc 07).

Migración `0002`: las 3 fechas `timestamptz`, `apuesta_pleno_15` y los dos `CHECK` de §3.3.

| Fichero                  | Responsabilidad                                                                                                               | Detalle crítico                                                                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `jornadas.schemas.ts`    | `FechasJornadaSchema` (3 fechas `nullable`), `PlenoJornadaSchema`; `JornadaResponseSchema` gana 4 campos + `apuestasAbiertas` | `refine` de coherencia: `fechaCierreApuestas > fechaAperturaApuestas`. Reutiliza `plenoAl15`                |
| `jornadas.repository.ts` | `updateFechas`, `updatePleno`                                                                                                 | `updated_at` se refresca en ambas                                                                           |
| `jornadas.service.ts`    | Helper **exportado** `apuestasAbiertas(jornada)` y `assertApuestasAbiertas()`                                                 | Lo consumirá `apuestas.service.ts` en F18 y `calculos.service.ts` en F19: un solo sitio donde vive la regla |
| `jornadas.controller.ts` | `updateFechas`, `cerrarApuestas`, `updatePleno`                                                                               | 200 con la jornada completa, para que el cliente vea el `apuestasAbiertas` resultante                       |
| `jornadas.routes.ts`     | 3 rutas nuevas, todas `requireRole("admin")`                                                                                  | Patrón calcado de `POST /temporadas/{codigo}/activar`                                                       |

**Las fechas y el pleno NO entran en `POST`/`PUT /jornadas`** (N11). El `PUT` es un reemplazo total: si las fechas estuvieran en su body, cualquier `PUT` que no las reenviara las borraría en silencio. Una jornada nace con las tres a `NULL` (apuestas cerradas) y el admin las abre cuando toca.

⚠ **Cambio de contrato**: `JornadaResponseSchema` gana cinco campos, así que `openapi/openapi.json` cambia y hay que **actualizar `tests/integration/jornadas.test.ts`**. Es esperable, no un error: el contract test está haciendo exactamente su trabajo.

**Matriz de aceptación**:

| #   | Caso                                              | Esperado                           |
| --- | ------------------------------------------------- | ---------------------------------- |
| 1   | `PUT /jornadas/1/fechas` válidas (admin)          | 200 y `apuestasAbiertas` coherente |
| 2   | `PUT` con cierre anterior a la apertura           | 400                                |
| 3   | `PUT` con las 3 fechas a `null`                   | 200, `apuestasAbiertas: false`     |
| 4   | `PUT /fechas` como `user`                         | 403                                |
| 5   | `PUT /fechas` de jornada inexistente              | 404                                |
| 6   | `POST /jornadas/1/cerrar-apuestas` (admin)        | 200, `apuestasAbiertas: false`     |
| 7   | `POST /cerrar-apuestas` como `user`               | 403                                |
| 8   | `PUT /jornadas/1/pleno` con `"1-2"`               | 200                                |
| 9   | `PUT /pleno` con `"M-M"`                          | 200                                |
| 10  | `PUT /pleno` con `"3-0"`                          | 400                                |
| 11  | `PUT /pleno` con `"1 - 2"`                        | 400                                |
| 12  | `GET /jornadas/1` sin fechas configuradas         | 200, `apuestasAbiertas: false`     |
| 13  | `GET /jornadas/1` con la ventana abierta          | 200, `apuestasAbiertas: true`      |
| 14  | `GET /jornadas/1` con `fechaCierreJornada` puesta | 200, `apuestasAbiertas: false`     |
| 15  | Las respuestas cumplen el esquema OpenAPI         | contract test verde                |

**Aceptación**:

```bash
curl -s -X PUT http://localhost:3000/api/v1/jornadas/1/fechas \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"fechaAperturaApuestas":"2026-09-01T10:00:00Z","fechaCierreApuestas":"2026-09-05T20:00:00Z"}' | jq
curl -s http://localhost:3000/api/v1/jornadas/1 -H "Authorization: Bearer $TOKEN" | jq '.apuestasAbiertas'
curl -s -X POST http://localhost:3000/api/v1/jornadas/1/cerrar-apuestas -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.apuestasAbiertas'
```text

**Qué aprendes**: modelar un ciclo de vida con fechas en lugar de una máquina de estados, por qué un `PUT` de reemplazo total y los campos "de proceso" no deben compartir body, y cómo un contract test avisa de un cambio de contrato antes de que lo note un cliente.

---

### F17 — Módulo Resultados (≈ 3–4 h)

**Objetivo**: registrar los resultados oficiales y el cuadro de premios de una jornada.

Migración `0003`: tabla `resultados` (§3.2). Leer el `.sql` y comprobar que están el `UNIQUE (jornada_id)`, los 14 `CHECK` de signo, el del pleno y el `ON DELETE CASCADE`.

**Montaje del router anidado** — la única pieza de fontanería nueva de este documento. El router declara la ruta completa y se monta en `/jornadas`, así no hace falta `mergeParams`:

```ts
// src/modules/resultados/resultados.routes.ts
export const resultadosRouter = Router();
resultadosRouter.get("/:numeroJornada/resultados", requireAuth, validate({ ... }), findByJornada);

// src/routes.ts
router.use("/jornadas", jornadasRouter);
router.use("/jornadas", resultadosRouter);   // lo que jornadasRouter no case, cae aquí
```text

| Fichero                    | Responsabilidad                                                                                                             | Detalle crítico                                                                                               |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `resultados.schemas.ts`    | Primitivas compartidas (`signoQuiniela`, `plenoAl15`, `importeEuros`), `UpsertResultadosSchema`, `ResultadosResponseSchema` | El contrato es un **array de 14** (`resultados`) + `resultado15` + objeto `premios` con claves `"10"`..`"15"` |
| `resultados.repository.ts` | `findByJornada`, `upsert`, `remove`                                                                                         | `upsert` con `onConflictDoUpdate` sobre `jornada_id`; devuelve además si **creó** o **actualizó**             |
| `resultados.service.ts`    | Resuelve temporada y jornada; mapea array ↔ 14 columnas                                                                     | El mapeo array→columnas vive **solo aquí**: ni el controller ni el repository saben del array                 |
| `resultados.controller.ts` | **201 + `Location`** al crear, **200** al actualizar; 204 en `DELETE`                                                       | `DELETE` de una jornada ya calculada (`fechaCierreJornada` no nula) → **409**                                 |
| `resultados.routes.ts`     | Lectura: autenticado. Escritura: `requireRole("admin")`                                                                     | Rutas declaradas con el prefijo `/:numeroJornada/resultados`                                                  |

En esta fase se añade también la **guarda por resultados** en `jornadas.service.ts`: `PUT`/`DELETE` de una jornada con resultados → **409**.

**Matriz de aceptación**:

| #   | Caso                                                       | Esperado                  |
| --- | ---------------------------------------------------------- | ------------------------- |
| 1   | `PUT /jornadas/1/resultados` completo (admin), primera vez | **201** + `Location`      |
| 2   | `PUT` de nuevo con otros valores                           | **200** actualizado       |
| 3   | `PUT` como `user`                                          | 403                       |
| 4   | `PUT` sin token                                            | 401                       |
| 5   | `PUT` con 13 resultados                                    | 400                       |
| 6   | `PUT` con 15 resultados                                    | 400                       |
| 7   | `PUT` con un resultado `"3"`                               | 400                       |
| 8   | `PUT` con un resultado `"x"` minúscula                     | 400                       |
| 9   | `PUT` con `resultado15: "3-0"`                             | 400                       |
| 10  | `PUT` con `resultado15: "M-2"`                             | 201/200 (válido)          |
| 11  | `PUT` con un premio negativo                               | 400                       |
| 12  | `PUT` con un premio de 3 decimales                         | 400                       |
| 13  | `PUT` con premios a 0 (sin acertantes)                     | 201 (es el caso normal)   |
| 14  | `PUT` en jornada inexistente                               | 404                       |
| 15  | `PUT` con `?temporada=` de otra temporada                  | 201 en esa jornada        |
| 16  | `GET /jornadas/1/resultados` (user)                        | 200, array de 14 en orden |
| 17  | `GET` de jornada sin resultados                            | 404                       |
| 18  | `DELETE` (admin)                                           | 204 sin cuerpo            |
| 19  | `DELETE` como `user`                                       | 403                       |
| 20  | `DELETE` de jornada ya calculada                           | **409**                   |
| 21  | `PUT /jornadas/1` (la jornada) con resultados registrados  | **409**                   |
| 22  | Las respuestas cumplen el esquema OpenAPI                  | contract test verde       |

**Aceptación**:

```bash
curl -i -X PUT http://localhost:3000/api/v1/jornadas/1/resultados \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"resultados":["1","X","2","1","1","X","2","1","X","2","1","1","X","2"],
       "resultado15":"1-M",
       "premios":{"10":10.49,"11":0,"12":0,"13":0,"14":0,"15":0}}'
curl -s http://localhost:3000/api/v1/jornadas/1/resultados -H "Authorization: Bearer $TOKEN" | jq
```text

**Qué aprendes**: subrecursos singleton en REST (`PUT` idempotente que responde 201 o 200 según cree o actualice), `onConflictDoUpdate` de Drizzle, y separar la **forma del contrato** (un array cómodo) de la **forma del almacenamiento** (14 columnas con `CHECK` propio) sin que ninguna de las dos contamine a la otra.

---

### F18 — Módulo Apuestas (≈ 4–5 h)

**Objetivo**: que los miembros apuesten, con ventana temporal, permisos por propiedad y trazabilidad de quién creó cada apuesta.

Migración `0004`: tabla `apuestas` (§3.2). Comprobar en el `.sql` el `UNIQUE (jornada_id, usuario_id, numero_apuesta)` y los 14 `CHECK`.

| Fichero                  | Responsabilidad                                                                                                                                | Detalle crítico                                                                                                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `apuestas.schemas.ts`    | `CreateApuestaSchema` (`numeroApuesta`, `partidos[14]`, `sugerenciaPleno15?`, `usuarioId?`), `UpdateApuestaSchema`, `NumeroApuestaParamSchema` | Reutiliza `signoQuiniela` y `plenoAl15` de `resultados.schemas.js`. `usuarioId` es opcional y **solo lo honra el admin** |
| `apuestas.repository.ts` | `create`, `findByJornada`, `findByJornadaYUsuario`, `findOne`, `replace`, `remove`, `countByJornada`                                           | `countByJornada` es lo que usa la guarda de `jornadas.service.ts`                                                        |
| `apuestas.service.ts`    | Ventana, propiedad, mapeo array ↔ 14 columnas, `creada_por`                                                                                    | Usa `jornadasService.assertApuestasAbiertas()` (F16); duplicado → **409** vía `isUniqueViolation`                        |
| `apuestas.controller.ts` | 201 + `Location`, 200, 204                                                                                                                     | `Location: /api/v1/jornadas/{n}/apuestas/{numeroApuesta}`                                                                |
| `apuestas.routes.ts`     | `/mias` **antes** de `/:numeroJornada/apuestas/:numeroApuesta`                                                                                 | Toda la escritura es `requireAuth` a secas: el permiso fino depende del dato y se decide en el service                   |

Aquí se añade la **guarda por apuestas** en `jornadas.service.ts`: `PUT`/`DELETE` de una jornada con apuestas → **409**.

**Matriz de aceptación**:

| #   | Caso                                                         | Esperado                                    |
| --- | ------------------------------------------------------------ | ------------------------------------------- |
| 1   | `POST` apuesta válida (user, para sí mismo, ventana abierta) | 201 + `Location` + `creadaPorElMismo: true` |
| 2   | `POST` con `usuarioId` de otro, como `user`                  | **403**                                     |
| 3   | `POST` con `usuarioId` de otro, como `admin`                 | 201 + `creadaPorElMismo: false`             |
| 4   | `POST` con `usuarioId` inexistente, como `admin`             | 404                                         |
| 5   | `POST` repetida con el mismo `numeroApuesta`                 | **409**                                     |
| 6   | `POST` con `numeroApuesta: 3`                                | 400                                         |
| 7   | `POST` con 13 partidos                                       | 400                                         |
| 8   | `POST` con un partido `"3"`                                  | 400                                         |
| 9   | `POST` con `sugerenciaPleno15: "1-M"`                        | 201                                         |
| 10  | `POST` con `sugerenciaPleno15: "5-0"`                        | 400                                         |
| 11  | `POST` sin `sugerenciaPleno15`                               | 201 (es opcional)                           |
| 12  | `POST` en jornada sin fechas configuradas                    | **409**                                     |
| 13  | `POST` antes de la fecha de apertura                         | **409**                                     |
| 14  | `POST` después del cierre de apuestas                        | **409**                                     |
| 15  | `POST` después del cierre, como `admin`                      | **409** (tampoco el admin)                  |
| 16  | `POST` en jornada ya calculada                               | **409**                                     |
| 17  | `POST` sin token                                             | 401                                         |
| 18  | `PUT` de la propia con la ventana abierta                    | 200                                         |
| 19  | `PUT` de la de otro, como `user`                             | 403                                         |
| 20  | `PUT` de la de otro, como `admin`                            | 200                                         |
| 21  | `PUT` después del cierre                                     | **409**                                     |
| 22  | `PUT` de una apuesta inexistente                             | 404                                         |
| 23  | `DELETE` de la propia con la ventana abierta                 | 204                                         |
| 24  | `DELETE` después del cierre                                  | **409**                                     |
| 25  | `GET` colección como `user` con la ventana **abierta**       | **403**                                     |
| 26  | `GET` colección como `user` con la ventana **cerrada**       | 200 con todas                               |
| 27  | `GET` colección como `admin` con la ventana abierta          | 200 con todas                               |
| 28  | `GET /mias`                                                  | 200 solo con las propias                    |
| 29  | `PUT /jornadas/1` (la jornada) con apuestas registradas      | **409**                                     |
| 30  | Las respuestas cumplen el esquema OpenAPI                    | contract test verde                         |

Los casos **13, 14 y 15** son el corazón de la fase: sin ellos, la ventana de apuestas es un comentario en la documentación y no una regla.

**Aceptación**:

```bash
curl -i -X POST http://localhost:3000/api/v1/jornadas/1/apuestas \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"numeroApuesta":1,
       "partidos":["1","X","2","1","1","X","2","1","X","2","1","1","X","2"],
       "sugerenciaPleno15":"1-M"}'
curl -s http://localhost:3000/api/v1/jornadas/1/apuestas/mias -H "Authorization: Bearer $TOKEN" | jq
curl -s -X POST http://localhost:3000/api/v1/jornadas/1/cerrar-apuestas -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -i -X POST http://localhost:3000/api/v1/jornadas/1/apuestas -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"numeroApuesta":2,"partidos":["1","1","1","1","1","1","1","1","1","1","1","1","1","1"]}'
# -> 409: la ventana esta cerrada
```text

**Qué aprendes**: autorización que depende **del dato** y no solo del rol (y por qué eso vive en el service, no en un middleware), reglas temporales derivadas sin scheduler, y trazabilidad de autoría (`creada_por`) como fuente de una métrica de producto.

---

### F19 — Módulo Cálculos (≈ 5–6 h)

**Objetivo**: convertir apuestas + resultados en ranking, escalón de pago, premios y bote. Es la fase con más lógica de negocio de todo el proyecto.

Migración `0005`: `escalones_pago` (**con la semilla**) y `resultados_miembro`.

> **La única excepción a "no editar migraciones"**: la semilla de los 10 escalones se añade a mano al `.sql` generado **antes de aplicarlo**. La convención del proyecto prohíbe editar una migración **ya aplicada**; añadir los `INSERT` antes de la primera aplicación es correcto y es lo que hace que los tests tengan escalones sin necesidad de un script de seed aparte. Recordatorio de §3.5: `escalones_pago` **no** se añade a `tests/setup/truncate.ts`.

#### Decisión de diseño: el algoritmo va en un fichero aparte y es puro

| Fichero                  | Responsabilidad                                                                                                            | Detalle crítico                                                                                                                              |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `calculos.algoritmo.ts`  | **Función pura**: `calcularJornada(apuestas, resultados, escalones) → LiquidacionMiembro[]`. Sin BD, sin `req`, sin fechas | Es lo que permite llegar al 100 % de cobertura (N13) con tests unitarios rápidos, en vez de montar 20 apuestas por HTTP para cada caso borde |
| `calculos.schemas.ts`    | `EjecutarCalculoSchema` (`jornada`, `temporada?`), `CalculoQuerySchema`, `CalculoResponseSchema`                           | Reutiliza `importeEuros`                                                                                                                     |
| `calculos.repository.ts` | `findEscalones`, `upsertResultadosMiembro(filas, tx)`, `findByJornada`                                                     | El `upsert` recibe la transacción: las N filas entran juntas o no entran                                                                     |
| `calculos.service.ts`    | Requisitos previos (§6.1), orquestación, transacción, cierre de la jornada                                                 | Toda la aritmética se delega en `calculos.algoritmo.ts`; el service solo valida, lee, escribe y cierra                                       |
| `calculos.controller.ts` | `POST` → 200 con el resumen; `GET` → 200 ordenado por `ranking`                                                            | `POST` es 200, no 201 (§4.5)                                                                                                                 |
| `calculos.routes.ts`     | `POST` con `requireRole("admin")`; `GET` con `requireAuth`                                                                 | Rutas planas, como pedía el doc 07                                                                                                           |

**Matriz de aceptación** — unitarios del algoritmo:

| #   | Caso                                                     | Esperado                                                       |
| --- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | **Ejemplo 1 del doc 07 recalculado** (§6.3)              | Escalones 10/9/8/7, botes 1,00/0,90/0,80/0,70, bote total 8,00 |
| 2   | **Ejemplo 2 del doc 07** (§6.4)                          | Escalones **idénticos** a la tabla del doc; bote total 17,49   |
| 3   | Todos los miembros con los mismos aciertos               | Todos al escalón 10 (2,50)                                     |
| 4   | Máximo alcanzado por un solo miembro                     | Ese miembro al escalón 1 (1,50)                                |
| 5   | Máximo compartido por dos miembros                       | **No** se aplica la excepción                                  |
| 6   | Apuesta con 12 aciertos                                  | Cobra `premio_cat_12`                                          |
| 7   | Apuesta con 9 aciertos                                   | Premio 0                                                       |
| 8   | Categoría 15 con 3 apuestas de 14 aciertos               | Reparto a partes iguales, resto en céntimos determinista       |
| 9   | Categoría 15 con las 2 apuestas de un mismo miembro a 14 | Ese miembro cobra **2 partes** (N14)                           |
| 10  | Categoría 15 sin acertantes de 14                        | No se reparte nada                                             |
| 11  | Miembro con una sola apuesta                             | `aciertos_apuesta_2 = null`, entra en el ranking               |
| 12  | 11 grupos distintos                                      | Escalón mínimo **1** (clamp), no 0 ni negativo                 |
| 13  | Apuesta con 14 aciertos y el pleno oficial acertado      | `aciertos = 14`, **no 15** (N4)                                |
| 14  | Miembro sin apuestas                                     | Fuera del ranking, sin cargo                                   |

**Matriz de aceptación** — integración:

| #   | Caso                                            | Esperado                                            |
| --- | ----------------------------------------------- | --------------------------------------------------- |
| 15  | `POST /calculos` (admin) con todo en orden      | 200 + `fechaCierreJornada` puesta                   |
| 16  | `POST /calculos` como `user`                    | 403                                                 |
| 17  | `POST` sin resultados registrados               | **409** con mensaje claro                           |
| 18  | `POST` sin ninguna apuesta                      | **409**                                             |
| 19  | `POST` con las apuestas todavía abiertas        | **409**                                             |
| 20  | `POST` sobre jornada de temporada **no activa** | **409**                                             |
| 21  | `POST` sin temporada activa y sin `temporada`   | 404                                                 |
| 22  | `POST` de jornada inexistente                   | 404                                                 |
| 23  | `POST` **dos veces**                            | Mismo resultado, sin filas duplicadas (idempotente) |
| 24  | `POST`, corregir un resultado, `POST` otra vez  | Cifras actualizadas y coherentes                    |
| 25  | `GET /calculos?jornada=1`                       | 200 ordenado por `ranking` ascendente               |
| 26  | `GET /calculos` de jornada sin calcular         | 404                                                 |
| 27  | Las respuestas cumplen el esquema OpenAPI       | contract test verde                                 |

**Aceptación**:

```bash
curl -s -X POST http://localhost:3000/api/v1/calculos \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"jornada":1}' | jq
curl -s 'http://localhost:3000/api/v1/calculos?jornada=1' -H "Authorization: Bearer $TOKEN" \
  | jq '.miembros[] | {apodo, aciertosMax, escalon, importeEscalon, bote}'
npm run test:cov   # el 100 % de calculos.service.ts y calculos.algoritmo.ts
```text

**Qué aprendes**: extraer un algoritmo a una función pura para poder probarlo de verdad, idempotencia de una operación que escribe muchas filas, aritmética de dinero en céntimos enteros, reparto determinista de un resto, y cómo un ejemplo de negocio bien escrito (el 2) valida un algoritmo y otro mal escrito (el 1) obliga a decidir de forma explícita en vez de copiar.

---

### F20 — Módulo Pagos y crédito (≈ 2–3 h)

**Objetivo**: registrar el dinero que los miembros entregan y cerrar el círculo del crédito.

Migración `0006`: tabla `pagos` (§3.2).

| Fichero               | Responsabilidad                                                                                            | Detalle crítico                                                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pagos.schemas.ts`    | `CreatePagoSchema` (`usuarioId`, `importe`, `fechaPago`), `PagosQuerySchema` (`usuario`, `desde`, `hasta`) | `importe` con `importeEuros` y `.positive()`: un pago de 0 no es un pago                                     |
| `pagos.repository.ts` | `create`, `findAll(filtros)`, `findByUsuario`, `remove`, **`getCredito(usuarioId)`**                       | `getCredito` hace en **una sola consulta** `SUM(pagos.importe) − SUM(resultados_miembro.importe_escalon)`    |
| `pagos.service.ts`    | CRUD + `getCredito` expuesto para otros módulos                                                            | Es el equivalente de `resolveTemporada`: el punto único desde el que `usuarios` y `dashboard` piden el saldo |
| `pagos.controller.ts` | 201 en `POST`, 204 en `DELETE`                                                                             | Sin `PUT`: un pago mal apuntado se borra y se vuelve a crear, y así queda el rastro                          |
| `pagos.routes.ts`     | `/mios` **antes** de `/:id`; `POST`/`GET`/`DELETE` con `requireRole("admin")`                              | `GET /pagos/mios` solo `requireAuth`                                                                         |

Y el cierre del círculo: `usuarios.service.ts` pasa a llamar a `pagosService.getCredito()` y `UsuarioResponseSchema` gana el campo `credito`. Es la misma relación entre módulos que ya existe entre `jornadas` y `temporadas`, en la misma dirección: un service consume el service de otro módulo, nunca su repository.

**Por qué el crédito no es una columna** (N8): recalcular una jornada, borrar un pago mal apuntado o corregir un resultado son operaciones normales en una peña. Con un saldo cacheado, cada una obliga a deshacer con exactitud el movimiento anterior, y el día que un `catch` se traga un error el saldo miente para siempre sin que nadie lo note. Calculado del ledger, el saldo **no puede** desincronizarse. Con diez miembros, el coste de la consulta es irrelevante.

**Matriz de aceptación**:

| #   | Caso                                                            | Esperado                          |
| --- | --------------------------------------------------------------- | --------------------------------- |
| 1   | `POST /pagos` válido (admin)                                    | 201 y el crédito del miembro sube |
| 2   | `POST /pagos` como `user`                                       | 403                               |
| 3   | `POST` con `importe: 0`                                         | 400                               |
| 4   | `POST` con `importe: -10`                                       | 400                               |
| 5   | `POST` con `importe: 10.999`                                    | 400                               |
| 6   | `POST` con `usuarioId` inexistente                              | 404                               |
| 7   | `POST` con `fechaPago: "01-09-2026"`                            | 400                               |
| 8   | `GET /pagos` como `user`                                        | 403                               |
| 9   | `GET /pagos?usuario={id}` como `admin`                          | 200 filtrado                      |
| 10  | `GET /pagos?desde=&hasta=`                                      | 200 en el rango                   |
| 11  | `GET /pagos/mios`                                               | 200 solo los propios              |
| 12  | `DELETE /pagos/{id}` (admin)                                    | 204 y el crédito baja             |
| 13  | `DELETE` inexistente                                            | 404                               |
| 14  | `GET /usuarios/me` tras un pago y una jornada calculada         | `credito = pago − importeEscalon` |
| 15  | Crédito negativo (debe con la peña)                             | Se muestra en negativo, sin error |
| 16  | Recalcular una jornada no altera el crédito de forma inesperada | Verificado en el test             |
| 17  | Las respuestas cumplen el esquema OpenAPI                       | contract test verde               |

**Aceptación**:

```bash
curl -s -X POST http://localhost:3000/api/v1/pagos \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"usuarioId":"'"$USER_ID"'","importe":50.00,"fechaPago":"2026-09-01"}' | jq
curl -s http://localhost:3000/api/v1/usuarios/me -H "Authorization: Bearer $TOKEN" | jq '.credito'
npm run db:psql -- -c 'select u.email, sum(p.importe) from users u join pagos p on p.usuario_id = u.id group by 1;'
```text

**Qué aprendes**: saldo calculado frente a saldo cacheado y por qué el primero es el que no miente, un ledger de dos lados (`pagos` como ingresos, `resultados_miembro.importe_escalon` como cargos), y por qué a veces la operación correcta es borrar y recrear en lugar de un `PUT`.

---

### F21 — Módulo Dashboard (≈ 3–4 h)

**Objetivo**: los agregados del doc 07, en tres endpoints de solo lectura. **Sin migración**: no hay tablas nuevas, todo sale de agregar lo que ya existe.

| Fichero                   | Responsabilidad                                            | Detalle crítico                                                                                                     |
| ------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `dashboard.schemas.ts`    | 3 schemas de query + 3 de respuesta                        | Los agregados que pueden no existir son `nullable`, no `0`: "aún no hay datos" y "la media es cero" no son lo mismo |
| `dashboard.repository.ts` | Una consulta agregada por endpoint                         | `SUM`/`AVG`/`MAX`/`MIN` + `GROUP BY` **en SQL**, no trayendo filas a Node para sumarlas en un bucle                 |
| `dashboard.service.ts`    | Resuelve temporada, comprueba el permiso sobre `?usuario=` | Sin `?usuario=`, el del token. Un `user` pidiendo otro → **403**                                                    |
| `dashboard.controller.ts` | 3 handlers de lectura                                      | Sin efectos secundarios: solo `GET`                                                                                 |
| `dashboard.routes.ts`     | `requireAuth` en las tres                                  | Sin `requireRole`: el permiso depende del `?usuario=`, y eso lo decide el service                                   |

Contenido de cada respuesta, mapeado a lo que pedía el doc 07:

| Nivel     | Campo                                                               | De dónde sale                                              |
| --------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| Miembro   | `pagosTotales`                                                      | `SUM(resultados_miembro.importe_escalon)` de la temporada  |
| Miembro   | `ingresosTotales`                                                   | `SUM(pagos.importe)`                                       |
| Miembro   | `credito`                                                           | `pagosService.getCredito()`                                |
| Miembro   | `mediaAciertos`                                                     | `AVG(aciertos_max)`                                        |
| Miembro   | `maxAciertos` / `minAciertos`                                       | `MAX`/`MIN(aciertos_max)`                                  |
| Miembro   | `maxPremio`                                                         | `MAX(premio_apuesta_1, premio_apuesta_2)`                  |
| Miembro   | `premiosTotales`                                                    | `SUM(premio_apuesta_1 + premio_apuesta_2)`                 |
| Miembro   | `porcentajeApuestasPropias`                                         | `apuestas` donde `creada_por = usuario_id`, sobre el total |
| Jornada   | `pagosJornada`                                                      | `SUM(importe_escalon)` de la jornada                       |
| Jornada   | `boteJornada`                                                       | `SUM(bote)`                                                |
| Jornada   | `mediaAciertosDosApuestas`                                          | `AVG` de todos los `aciertos_apuesta_1` y `_2`             |
| Jornada   | `mediaAciertosMaximos`                                              | `AVG(aciertos_max)`                                        |
| Jornada   | `clasificacion[]`                                                   | `resultados_miembro` ordenado por `ranking`                |
| Temporada | `maxAciertos` + `usuarios[]`                                        | `MAX(aciertos_max)` y quién lo hizo (pueden ser varios)    |
| Temporada | `minAciertos` + `usuarios[]`                                        | idem con `MIN`                                             |
| Temporada | `premiosTotales`, `pagosTotales`, `boteTotal`, `jornadasCalculadas` | agregados de la temporada                                  |

**Matriz de aceptación**:

| #   | Caso                                                 | Esperado                                |
| --- | ---------------------------------------------------- | --------------------------------------- |
| 1   | `GET /dashboard/miembro` sin `?usuario=`             | 200 con los datos del token             |
| 2   | `GET /dashboard/miembro?usuario={otro}` como `user`  | **403**                                 |
| 3   | `GET /dashboard/miembro?usuario={otro}` como `admin` | 200                                     |
| 4   | `GET /dashboard/miembro` sin jornadas calculadas     | 200 con `null`/0, **no 500**            |
| 5   | `porcentajeApuestasPropias` sin ninguna apuesta      | 0, **sin división por cero**            |
| 6   | `GET /dashboard/jornada?jornada=1` calculada         | 200 con la clasificación ordenada       |
| 7   | `GET /dashboard/jornada` de jornada sin calcular     | 404                                     |
| 8   | `GET /dashboard/jornada` de jornada inexistente      | 404                                     |
| 9   | `GET /dashboard/temporada`                           | 200 con máximos, mínimos y sus usuarios |
| 10  | Máximo compartido por dos miembros                   | Los dos aparecen en `usuarios[]`        |
| 11  | `GET /dashboard/temporada` sin temporada activa      | 404                                     |
| 12  | Medias con una sola jornada calculada                | Valor correcto, no `NaN`                |
| 13  | Cualquiera sin token                                 | 401                                     |
| 14  | Las respuestas cumplen el esquema OpenAPI            | contract test verde                     |

**Aceptación**:

```bash
curl -s http://localhost:3000/api/v1/dashboard/miembro -H "Authorization: Bearer $TOKEN" | jq
curl -s 'http://localhost:3000/api/v1/dashboard/jornada?jornada=1' -H "Authorization: Bearer $TOKEN" | jq
curl -s http://localhost:3000/api/v1/dashboard/temporada -H "Authorization: Bearer $TOKEN" | jq
npm test && npm run openapi:generate && npm run openapi:lint
```text

**Qué aprendes**: agregar en SQL en lugar de en Node, la diferencia entre "no hay datos" (`null`) y "el valor es cero", los casos borde de las divisiones (media de un conjunto vacío, porcentaje sin denominador) y autorización basada en un parámetro de query.

---

## 8. Los cinco puntos de contacto de cada módulo

Cinco ficheros **fuera** de la carpeta del módulo. Son los olvidos que rompen la build o dejan tests fantasma, así que van en el checklist de cada fase:

| #   | Fichero                   | Qué hay que añadir                                                                                          |
| --- | ------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | `src/db/schema/index.ts`  | `export * from "./<x>.js"` — es la entrada que lee `drizzle-kit`; sin esto la migración sale vacía          |
| 2   | `src/routes.ts`           | Montaje del router. Los anidados se montan en `/jornadas` declarando la ruta completa `/:numeroJornada/...` |
| 3   | `src/openapi/generate.ts` | `import "../modules/<x>/<x>.openapi.js"` **y** la entrada en `tags`                                         |
| 4   | `vitest.config.ts`        | Umbral `100` para `src/modules/<x>/<x>.service.ts` (N13)                                                    |
| 5   | `tests/setup/truncate.ts` | Las tablas nuevas en la lista literal — **excepto `escalones_pago`** (§3.5)                                 |

Orden de las tablas en `truncate.ts` al terminar F21 (las hijas primero, aunque el `CASCADE` lo resuelva igual):

```text
resultados_miembro, apuestas, resultados, pagos,
partidos, jornadas, equipos, temporadas,
oauth_accounts, refresh_tokens, invitations, users
```text

Y para el OpenAPI, los `tags` nuevos: `Usuarios`, `Resultados`, `Apuestas`, `Cálculos`, `Pagos`, `Dashboard`.

---

## 9. Checklist maestro

**Preparación (F15)**

- [ ] `isUniqueViolation` / `isForeignKeyViolation` extraídos a `src/core/db-errors.ts` y los 5 services usándolo
- [ ] `npm test` verde después del refactor, sin tocar ningún test
- [ ] Primera migración **incremental** (`0001`) aplicada; nunca más se regenera `0000`

**Modelo de datos**

- [ ] `users` con `apellidos`, `apodo` (citext único) y `telefono`; **sin** columna `credito`
- [ ] `jornadas` con las 3 fechas + `apuesta_pleno_15` y los 2 `CHECK`
- [ ] `resultados` con `UNIQUE (jornada_id)`, 14 `CHECK` de signo, `CHECK` del pleno, premios `>= 0`
- [ ] `apuestas` con `UNIQUE (jornada_id, usuario_id, numero_apuesta)` y `CHECK (numero_apuesta IN (1,2))`
- [ ] `escalones_pago` sembrada con los 10 escalones y **fuera** de `truncate.ts`
- [ ] `resultados_miembro` con `UNIQUE (jornada_id, usuario_id)` y aciertos `BETWEEN 0 AND 14`
- [ ] `pagos` con `CHECK (importe > 0)`
- [ ] `CASCADE` desde `jornadas` a sus hijos; `RESTRICT` desde `users`
- [ ] Cada `.sql` generado **leído** antes de aplicarlo

**Reglas de negocio**

- [ ] `apuestasAbiertas` derivado, en un solo sitio, y sin ningún campo de estado
- [ ] Apuesta fuera de la ventana → 409, también para el admin
- [ ] `usuarioId` de otro → 403 para `user`, permitido para `admin`, y `creada_por` registrado
- [ ] Colección de apuestas oculta a los `user` mientras la ventana está abierta
- [ ] `PUT`/`DELETE` de jornada con resultados o apuestas → 409
- [ ] Aciertos de 0 a 14: el pleno no puntúa
- [ ] Categoría 15 repartida entre las apuestas de 14, a partes iguales y con resto determinista
- [ ] Excepción del acertante único → escalón 1 (1,50)
- [ ] Escalón con clamp a 1
- [ ] `POST /calculos` idempotente y dentro de una transacción
- [ ] Crédito calculado del ledger, nunca cacheado
- [ ] Ningún código de error nuevo respecto a `00-Plan-inicial.md` §10

**Documentación y tests**

- [ ] Una spec por recurso en `docs/specs/NN-<recurso>.md`
- [ ] Todos los endpoints en el OpenAPI con `summary`, `description`, `operationId`, `tags`, ejemplos y 401 declarado
- [ ] `npm run openapi:lint` (Spectral) verde
- [ ] Los dos ejemplos del doc 07 como tests unitarios del algoritmo
- [ ] Contract test en cada endpoint nuevo
- [ ] `npm run test:cov` cumpliendo los umbrales (o el umbral concreto rebajado **y justificado**, N13)
- [ ] Colección de Insomnia regenerada desde el OpenAPI

---

## 10. Cuestiones abiertas y deuda conocida

### Abiertas

1. **Miembros que se incorporan a mitad de temporada.** Con N3 (miembro = usuario) no hay fecha de alta, así que el dashboard de temporada cuenta a todos los usuarios actuales. Mientras la peña sea estable no molesta; el día que alguien entre o salga a mitad de temporada, habrá que decidir entre una tabla `miembros` (usuario × temporada) o filtrar por "tiene apuestas en la temporada". La segunda opción no necesita migración.
2. **Precio del boleto.** `coste_apuestas` está fijado a 1,50 (2 × 0,75). Está guardado fila a fila, así que un cambio de precio no reescribe el histórico, pero la constante vive en el código: cuando cambie, habrá que decidir si pasa a la tabla de configuración.
3. **Umbral de cobertura.** N13 deja abierta la posibilidad de rebajar el 100 % de un service concreto si resulta desproporcionado. Si ocurre, se anota **cuál y por qué** en este documento, no se baja el umbral global en silencio.

### Deuda del repositorio, detectada pero fuera del alcance de estas fases

| Qué                                                                                              | Por qué importa                                                                           |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `cookie-parser` se usa en `src/app.ts` pero **no está en `dependencies`**                        | Funciona por resolución transitiva; un `npm ci` limpio o la imagen de producción rompería |
| `scripts/db-embedded.ts` está referenciado en `package.json` pero **no existe**                  | `npm run db:embedded` falla                                                               |
| Mensaje truncado en `equipos.service.ts::remove`: `"No se puede borrar un asociados."`           | Un 409 con un mensaje que no se entiende                                                  |
| `METRICS_ENABLED`, `OTEL_ENABLED`, `ENABLE_DEV_TOKENS` declaradas en `env.ts` sin implementación | Configuración que promete algo que no ocurre                                              |

Ninguna bloquea F15–F21. La primera conviene arreglarla antes de F12 (despliegue), porque ahí sí rompe.

---

## 11. Divergencias respecto a `docs/07-Servicios_adicionales.md`

El doc 07 se queda como borrador de origen y **no se modifica**. Este documento es el que manda. Aquí queda registrado dónde y por qué se aparta, para que dentro de tres semanas no parezca un descuido:

| Punto del doc 07                                               | Qué dice el doc 07                                       | Qué manda aquí                                                               | Motivo                                                                                      |
| -------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Ubicación de los resultados (Q&A #1 vs. cuestión pendiente #2) | Una fila **por partido** / una tabla **por jornada**     | Una tabla **por jornada** con 14 columnas (N1)                               | Las dos respuestas se contradecían; se elige la segunda, que además simplifica el cálculo   |
| Escalones de pago, ejemplo 1                                   | Tabla y texto incoherentes con el ejemplo 2              | Recalculado en §6.3                                                          | El ejemplo 2 sí es coherente con la regla por grupos y valida el algoritmo                  |
| Escalón del acertante único                                    | "el primer escalón (1,00)"                               | **1,50**                                                                     | La tabla de escalones y el ejemplo 2 dicen 1,50; el `(1,00)` es una errata                  |
| Bote, ejemplo 2                                                | La tabla no resta los 1,50                               | Se restan (N6)                                                               | El texto de los dos ejemplos y la tabla del ejemplo 1 sí los restan                         |
| Importe de user 2 en el ejemplo 2                              | `2`                                                      | `2,50`                                                                       | Errata: el escalón 10 vale 2,50                                                             |
| Pleno al 15 en la apuesta del miembro                          | Columna en la apuesta, y a la vez "solo 1 apuesta real"  | Oficial en `jornadas`, **sugerencia** informativa en la apuesta (N4)         | Refleja lo que la peña juega de verdad y conserva la trazabilidad de quién sugirió qué      |
| Aciertos máximos                                               | Implícitamente 15 (categorías de premio hasta 15)        | **14**: el pleno no puntúa (N4)                                              | Decisión explícita: el pleno no entra en cálculos ni pagos                                  |
| Categoría de premio 15                                         | Sin regla de atribución                                  | Se reparte entre las **apuestas** de 14 aciertos, a partes iguales (N5, N14) | Con aciertos máximos de 14, sin esta regla la categoría 15 sería inalcanzable               |
| `idMiembro`                                                    | Sugiere una entidad de miembro                           | `users.id` (N3)                                                              | Peña única e implícita; una tabla `miembros` no aporta nada hoy                             |
| `credito` en la tabla de usuarios                              | Columna que sube con cada pago                           | **Calculado** del ledger (N8)                                                | Un saldo cacheado se desincroniza en cuanto se recalcula una jornada o se corrige un pago   |
| Nombre del importe del escalón                                 | "pago"                                                   | `importeEscalon` (N10)                                                       | Colisionaba con la tabla `pagos` (dinero entregado); dos cosas distintas, dos nombres       |
| Estado de la jornada                                           | "no hace falta estado"                                   | Confirmado: derivado de las 3 fechas (N12)                                   | Se implementa tal cual, con el helper en un solo sitio                                      |
| Tabla de escalones                                             | "no requiere API inicialmente, se carga a mano"          | Sembrada en la migración `0005`, sin endpoints                               | Los tests también la necesitan; una semilla en la migración lo resuelve sin script aparte   |
| Ruta de cálculos                                               | `/calculos` con temporada opcional y jornada obligatoria | Igual, y se añade `GET /calculos` para consultar el resultado                | El doc solo describía la ejecución; consultarla hace falta para el dashboard y para depurar |

---

## Próximo paso

**F15, paso 0**: extraer `src/core/db-errors.ts` y hacer que los cinco services existentes lo usen. Nada más hasta que `npm test` vuelva a estar verde sin haber tocado un solo test.
````
