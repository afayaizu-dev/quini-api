---
recurso: <nombre-en-plural-minusculas> # ej: jornadas, apuestas, resultados
rutaBase: /api/v1/<recurso>
version: 1
estado: borrador # borrador | aprobada | implementada | obsoleta
autor: <tu nombre>
fecha: YYYY-MM-DD
depende_de: [] # ej: [temporadas, jornadas]
---

# Especificación — <Recurso>

> **Cómo usar esta plantilla**
>
> ```bash
> cp docs/specs/_plantilla.md docs/specs/NN-<recurso>.md
> ```
>
> Rellena de arriba abajo y **borra todos los bloques `<!-- guía -->`** antes de dar la spec por aprobada.
> Referencias al plan: contrato de errores (§10), roles (§8), observabilidad (§16), matriz de tests (§13).
>
> **Tres reglas de oro**
>
> 1. **Toda regla de validación va numerada.** Cada número se convierte en un test con nombre.
> 2. **Todo caso tiene su código HTTP escrito.** Si no está escrito, quien implemente **pregunta**; no adivina.
> 3. **Lo que no está en la spec, no se implementa.** El apartado 10 existe para que eso sea explícito y no un olvido.

---

## 1. Alcance

<!-- guía: dos o tres frases. Qué gestiona este recurso y para qué existe en el producto.
     Si no consigues explicarlo sin mencionar otros tres recursos, probablemente el alcance está mal cortado. -->

Este documento define la API REST para la gestión de **<recurso>**. Cubre:

- El modelo de datos de <recurso> y sus entidades dependientes.
- Las reglas de validación asociadas.
- La autorización exigida por cada endpoint.
- Los endpoints <listar: crear, consultar, actualizar, eliminar…>.

---

## 2. Ubicación en el dominio

<!-- guía: decide de qué cuelga el recurso. Determina la unicidad, las claves ajenas y si las
     rutas necesitan contexto. Ver decisión D17 del plan: las rutas son planas y el contexto
     (temporada) se resuelve contra la activa, con ?temporada=<codigo> para apuntar a otra. -->

| Pregunta                                                 | Respuesta                                            |
| -------------------------------------------------------- | ---------------------------------------------------- |
| ¿De qué entidad cuelga?                                  | `temporada` / `jornada` / ninguna                    |
| ¿Clave ajena obligatoria?                                | Sí / No                                              |
| ¿Se resuelve contra la **temporada activa** por defecto? | Sí / No / No aplica                                  |
| ¿Admite `?temporada=<codigo>`?                           | Sí / No / No aplica                                  |
| Identificador público en la URL                          | `id` (UUID) / campo natural (indicar cuál)           |
| ¿La unicidad es global o compuesta?                      | ej: `UNIQUE (temporada_id, numero)`                  |
| Al borrar el padre                                       | `CASCADE` (se borra con él) / `RESTRICT` (lo impide) |

> **Ejemplo (jornadas)**: cuelga de `temporada`, FK obligatoria, se resuelve contra la activa, identificador público `numeroJornada`, unicidad `UNIQUE (temporada_id, numero_jornada)`, y al borrar la temporada → `RESTRICT`.

**Decisión sobre el borrado del padre y por qué**: <una frase>

---

## 3. Modelo de datos

### 3.1 <Entidad principal>

| Campo (API, camelCase) | Columna (BD, snake_case) | Tipo                               | Obligatorio              | Descripción         |
| ---------------------- | ------------------------ | ---------------------------------- | ------------------------ | ------------------- |
| `id`                   | `id`                     | UUID                               | Generado por el servidor | Identificador único |
| `<campo>`              | `<campo>`                | <string / entero / date / boolean> | Sí / No                  |                     |
| —                      | `created_at`             | `timestamptz`                      | Automático               | Auditoría           |
| —                      | `updated_at`             | `timestamptz`                      | Automático               | Auditoría           |
| —                      | `created_by`             | UUID → `users.id`                  | Automático               | Quién lo creó       |

<!-- guía: `timestamptz` siempre, nunca `timestamp`. Emails con `citext`.
     Los campos de auditoría no se exponen en la API salvo que la spec lo diga. -->

### 3.2 <Entidad dependiente, si existe>

| Campo | Columna | Tipo | Obligatorio | Descripción |
| ----- | ------- | ---- | ----------- | ----------- |
|       |         |      |             |             |

### 3.3 Restricciones en base de datos

<!-- guía: esto NO es decorativo. Todo lo que se pueda garantizar en la BD, se garantiza ahí:
     dos peticiones concurrentes pasan la validación de Zod a la vez, pero no pasan un UNIQUE. -->

| Tipo                 | Definición                                            | Traducción a HTTP si se viola               |
| -------------------- | ----------------------------------------------------- | ------------------------------------------- |
| `UNIQUE`             | `UNIQUE (<columnas>)`                                 | **409 `CONFLICT`**                          |
| `CHECK`              | `CHECK (<condición>)`                                 | 400 (no debería llegar: Zod lo corta antes) |
| `FOREIGN KEY`        | `→ <tabla>.<columna>` `ON DELETE <CASCADE\|RESTRICT>` | 404 o 409 según el caso                     |
| Índice único parcial | `UNIQUE (...) WHERE <condición>`                      | 409                                         |

### 3.4 Representación JSON

```json
{
  "id": "b3f1c2d0-1234-4a5b-9abc-9876543210ef",
  "<campo>": "<valor>"
}
```

---

## 4. Reglas de validación

<!-- guía: numeradas y atómicas: una regla, una comprobación, un test.
     "Los datos deben ser válidos" no es una regla, es un deseo.
     Rellena las dos últimas columnas: son las que evitan que la regla exista solo en un sitio. -->

| #   | Regla                                                             | Se defiende en Zod              | Se defiende en BD                          | Código si falla |
| --- | ----------------------------------------------------------------- | ------------------------------- | ------------------------------------------ | --------------- |
| 1   | <ej: `numero` debe ser entero ≥ 1>                                | `z.number().int().positive()`   | `CHECK (numero >= 1)`                      | 400             |
| 2   | <ej: `numero` único dentro de la temporada>                       | —                               | `UNIQUE (temporada_id, numero)`            | **409**         |
| 3   | <ej: `fecha` en formato ISO `YYYY-MM-DD`>                         | `z.string().date()`             | columna `DATE`                             | 400             |
| 4   | <ej: la lista contiene exactamente N elementos>                   | `.length(N)`                    | transacción del service                    | 400             |
| 5   | <ej: los valores de `orden` son 1..N sin huecos ni repeticiones>  | `refine` comparando el conjunto | `UNIQUE (padre_id, orden)`                 | 400             |
| 6   | <ej: los textos obligatorios no pueden estar vacíos ni en blanco> | `z.string().trim().min(1)`      | `NOT NULL` + `CHECK (length(trim(x)) > 0)` | 400             |

**Reglas de negocio que NO se pueden expresar en Zod ni en la BD** (van en el service):

| #   | Regla                                                     | Dónde vive             | Código si falla |
| --- | --------------------------------------------------------- | ---------------------- | --------------- |
| 7   | <ej: la fecha debe caer dentro del rango de la temporada> | `<recurso>.service.ts` | 400 / 409       |

**¿Alguna operación necesita transacción?**

<!-- guía: si una petición escribe en más de una tabla, o borra y vuelve a insertar, la respuesta es SÍ.
     Y entonces hace falta un test que verifique que un fallo a mitad deja los datos intactos (rollback). -->

| Operación  | Por qué necesita transacción     | Test de rollback obligatorio |
| ---------- | -------------------------------- | ---------------------------- |
| <ej: POST> | <ej: inserta el padre y N hijos> | Sí                           |

---

## 5. Autorización

<!-- guía: rol mínimo por operación. Roles disponibles: `user`, `admin`.
     Recuerda: 401 = "no sé quién eres"; 403 = "sé quién eres y no puedes".
     Todos los endpoints requieren autenticación salvo que aquí se diga lo contrario, y eso hay que justificarlo. -->

| Operación                   | `user`       | `admin` | Sin autenticar |
| --------------------------- | ------------ | ------- | -------------- |
| Consultar (lista y detalle) | ✅ / ❌      | ✅      | ❌ → 401       |
| Crear                       | ❌ → **403** | ✅      | ❌ → 401       |
| Actualizar                  | ❌ → **403** | ✅      | ❌ → 401       |
| Eliminar                    | ❌ → **403** | ✅      | ❌ → 401       |

**¿Hay reglas de propiedad?** <ej: "un `user` solo puede ver/editar sus propias apuestas"> — Sí / No.
Si la respuesta es sí, descríbelas aquí, porque **no son autorización por rol** sino filtrado por dueño, y se implementan en el service, no en el middleware:

<!-- ej: GET /apuestas devuelve solo las del usuario del token; un admin ve todas.
     Intentar acceder a la de otro devuelve 404 (no 403: no confirmes que existe). -->

---

## 6. Endpoints

Base: `<rutaBase>`. Todos requieren `Authorization: Bearer <token>` salvo indicación expresa.

<!-- guía: repite este bloque por endpoint. La tabla de respuestas debe estar COMPLETA:
     si un código no aparece, es que ese caso no puede ocurrir, y eso también es una afirmación. -->

### 6.1 Crear

`POST <rutaBase>`

**Rol requerido**: `admin` / `user`

**Cuerpo de la petición**

```json
{
  "<campo>": "<valor>"
}
```

**Parámetros de consulta**

| Parámetro   | Tipo             | Obligatorio | Descripción                             |
| ----------- | ---------------- | ----------- | --------------------------------------- |
| `temporada` | string `YYYY-YY` | No          | Si se omite, se usa la temporada activa |

**Respuestas**

| Código             | Situación                         | Cuerpo / cabeceras                     |
| ------------------ | --------------------------------- | -------------------------------------- |
| `201 Created`      | Creado correctamente              | Recurso completo + cabecera `Location` |
| `400 Bad Request`  | Incumple las reglas 1, 3, 4, 5, 6 | `VALIDATION_ERROR`                     |
| `401 Unauthorized` | Sin token, inválido o expirado    | `UNAUTHORIZED`                         |
| `403 Forbidden`    | Rol insuficiente                  | `FORBIDDEN`                            |
| `404 Not Found`    | <ej: no hay temporada activa>     | `NOT_FOUND`                            |
| `409 Conflict`     | Incumple la regla 2 (duplicado)   | `CONFLICT`                             |

### 6.2 Consultar lista

`GET <rutaBase>`

**Rol requerido**: `user`

| Aspecto                 | Definición                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Orden de los resultados | <ej: por `numero` ascendente> — **obligatorio definirlo**, o el orden será accidental |
| Filtros admitidos       | <ej: `?temporada=`>                                                                   |
| Paginación              | **No** (array plano) / Sí (describir el formato)                                      |
| Entidades dependientes  | ¿Se incluyen anidadas o hay que pedirlas aparte?                                      |

**Respuestas**

| Código             | Situación                                            |
| ------------------ | ---------------------------------------------------- |
| `200 OK`           | Array de `<Recurso>`, ordenado como se indica arriba |
| `401 Unauthorized` | Autenticación ausente o inválida                     |

### 6.3 Consultar por identificador

`GET <rutaBase>/{<identificador>}`

| Parámetro de ruta | Tipo            | Validación                                       |
| ----------------- | --------------- | ------------------------------------------------ |
| `<identificador>` | <entero / UUID> | <ej: entero positivo; `"abc"` → **400**, no 500> |

**Respuestas**

| Código             | Situación                          |
| ------------------ | ---------------------------------- |
| `200 OK`           | Recurso                            |
| `400 Bad Request`  | Identificador con formato inválido |
| `401 Unauthorized` |                                    |
| `404 Not Found`    | No existe                          |

### 6.4 Actualizar

`PUT <rutaBase>/{<identificador>}` — _reemplazo total_
`PATCH <rutaBase>/{<identificador>}` — _modificación parcial_

<!-- guía: elige UNO y borra el otro. PUT reemplaza el recurso completo (los campos ausentes se
     pierden); PATCH modifica solo lo enviado. Mezclar los dos es la fuente nº1 de sorpresas. -->

**Semántica elegida**: <PUT reemplazo total / PATCH parcial> — **por qué**: <una frase>

**Campos inmutables** (no se pueden cambiar nunca): <ej: `id`, `numero`, `codigo`>

**Respuestas**

| Código                | Situación                                 |
| --------------------- | ----------------------------------------- |
| `200 OK`              | Actualizado; devuelve el recurso completo |
| `400 Bad Request`     | Reglas de validación                      |
| `401` / `403` / `404` |                                           |
| `409 Conflict`        | <si aplica>                               |

### 6.5 Eliminar

`DELETE <rutaBase>/{<identificador>}`

| Aspecto                   | Definición                                        |
| ------------------------- | ------------------------------------------------- |
| ¿Borrado físico o lógico? | Físico / lógico (`deleted_at`) — <por qué>        |
| ¿Qué arrastra?            | <ej: sus N dependientes, por `ON DELETE CASCADE`> |
| ¿Cuándo se impide?        | <ej: 409 si tiene hijos con `RESTRICT`>           |

**Respuestas**

| Código                | Situación                 |
| --------------------- | ------------------------- |
| `204 No Content`      | Eliminado. **Sin cuerpo** |
| `401` / `403` / `404` |                           |
| `409 Conflict`        | <si aplica>               |

---

## 7. Errores propios del recurso

<!-- guía: solo lo que NO esté ya en el catálogo general del plan (§10).
     Si te salen más de dos o tres, sospecha: probablemente encajan en los códigos existentes. -->

| `error`          | HTTP  | Cuándo      | Mensaje orientativo       |
| ---------------- | ----- | ----------- | ------------------------- |
| `<CODIGO_NUEVO>` | <4xx> | <situación> | <mensaje para el usuario> |

Todos los errores siguen el formato del plan:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "<mensaje legible en español>",
  "details": [{ "path": "<campo>", "code": "<motivo>" }],
  "requestId": "01JB2..."
}
```

---

## 8. Métricas de negocio

<!-- guía: ver §16 del plan. Convención de nombres: <recurso>_<accion>_total (contadores),
     <recurso>_<cosa> (gauges). Labels SOLO con valores acotados y pocos: nunca id, email ni URL. -->

| Métrica                    | Tipo    | Labels (acotados)    | Para qué sirve               |
| -------------------------- | ------- | -------------------- | ---------------------------- |
| `<recurso>_created_total`  | counter | —                    | Uso real de la funcionalidad |
| `<recurso>_<accion>_total` | counter | `result="ok\|error"` |                              |
|                            |         |                      |                              |

**¿Alguna merece alerta?** <ej: no / sí: describir umbral y por qué te tiene que despertar>

---

## 9. Casos límite y decisiones tomadas

<!-- guía: el apartado más valioso de la spec, y el que se salta todo el mundo.
     Cada línea aquí es una discusión que no tendrás dentro de dos meses mirando el código
     sin recordar por qué hace lo que hace. -->

| #   | Caso                                               | Decisión                                    | Por qué                           |
| --- | -------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| 1   | ¿Qué pasa si <situación ambigua>?                  | <comportamiento + código HTTP>              |                                   |
| 2   | ¿Se puede modificar cuando <condición>?            |                                             |                                   |
| 3   | ¿Dos peticiones simultáneas con los mismos datos?  | <ej: la segunda recibe 409 por el `UNIQUE`> | La BD es el árbitro, no el código |
| 4   | ¿Distingue mayúsculas/acentos en <campo de texto>? |                                             |                                   |
| 5   | ¿Qué se devuelve si la lista está vacía?           | <`200` con `[]`, nunca 404>                 | Una colección vacía existe        |

---

## 10. Fuera de alcance

<!-- guía: explícito y con motivo. Sirve para dos cosas: que nadie implemente de más,
     y que tú recuerdes qué queda pendiente. -->

- <Funcionalidad> — <por qué queda fuera / en qué fase se abordará>
- <Funcionalidad> — <…>

---

## Checklist antes de dar la spec por aprobada

- [ ] Cada regla del apartado 4 está **numerada** y dice dónde se defiende (Zod, BD o service)
- [ ] **Ningún caso sin código HTTP** en las tablas de respuestas del apartado 6
- [ ] El rol requerido está escrito para **cada** operación (apartado 5)
- [ ] Está decidido de qué cuelga el recurso y cómo es la unicidad (apartado 2)
- [ ] Está decidido el comportamiento al borrar el padre (`CASCADE` o `RESTRICT`) y por qué
- [ ] El **orden** de los resultados de la lista está definido explícitamente
- [ ] Está elegido `PUT` **o** `PATCH`, con su semántica justificada, y los campos inmutables listados
- [ ] Las operaciones que escriben en varias tablas están marcadas como transaccionales
- [ ] Hay al menos un caso de **rollback** que testear si hay transacciones
- [ ] Los `409` están asociados a una restricción real de base de datos, no solo a una comprobación en código
- [ ] Las métricas tienen labels **acotados** (ningún `id`, `email` ni URL)
- [ ] El apartado 9 tiene como mínimo tres casos límite resueltos
- [ ] El apartado 10 no está vacío

## Qué se genera a partir de esta spec

Para saber si la spec está completa, comprueba que puedes derivar todo esto sin preguntar nada:

| Artefacto                                   | Sale de los apartados                    |
| ------------------------------------------- | ---------------------------------------- |
| Esquema Drizzle + migración                 | 2, 3                                     |
| Esquemas Zod (y con ellos el OpenAPI)       | 3, 4, 6                                  |
| Router con `requireAuth` / `requireRole`    | 5, 6                                     |
| Service (transacciones y reglas de negocio) | 4, 9                                     |
| Repository (consultas y orden)              | 3, 6                                     |
| Tests de validación                         | 4 (uno por número)                       |
| Tests de autorización                       | 5 (los 7 casos de auth + el 403 por rol) |
| Tests de casos límite                       | 9                                        |
| Contadores de métricas                      | 8                                        |
| Colección de Insomnia                       | 6 (vía OpenAPI)                          |

Si alguna fila no se puede derivar, **falta información en la spec**. Vuelve a ella antes de escribir código.
