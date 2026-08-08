# API Web Autenticación

## Objetivo

Quiero crear una API para una aplicación web, la API es autenticada.

## Tecnologia

1. Será una API REST
2. Las utenticación tendra 2 opciones
   - oAuth2 con usuario y contraseña
   - con una cuenta de gMail
3. Usaremos openAPI
4. Usaremos Express
5. Trabajeremos con TypeScript, node y npm
6. Trabajaremos tambien con INSONMIA para la
7. El sistema de bd será relacional, postgres
8. Para el desarrollo local usaremos postgreSQL en docker y postgresQL embebido (configrable a nivel de entorno)

## Necesidades

1. Necesito definir la arquitectura en base a la tecnología indicada
2. Todo tiene que estar documentado a nivel de endpoint.
3. Es necesario poder realizar test de todos los servicos y endPoints de forma autenticada
4. Debemos tener una forma de generar tokens para pobrar y llamar a los servicos desde desarrollo para pruebas

## Planteamiento de trabajo

1. Montar la arquitectura de trabajo
2. Disponer de un sistema de autenticación
3. Disponer de un estructura básica de la aplicación
4. Disponer de los compoentes de la aplicacion, node, librerias, docker, posgress
5. Una vez que tengamos esta parte iremos definiendo la colección de servicos de la API y la estructra de la base de datos.

## Diseño de API — Gestión de Jornadas de Quiniela (ejemplo)

Este es el disño para un endPoint de la APIU

## 1. Alcance

Este documento define, de forma formal, la API REST para la gestión de **jornadas** de una peña de quiniela. Cubre exclusivamente:

- El modelo de datos de una jornada y sus partidos.
- Las reglas de validación asociadas a dicho modelo.
- El mecanismo de autenticación exigido por los endpoints.
- Los endpoints CRUD (crear, consultar, actualizar y eliminar) sobre las jornadas.

Cualquier funcionalidad no derivada directamente de estos requisitos (usuarios, apuestas, resultados, peñas, gestión de roles, etc.) queda fuera del alcance de este documento.

## 2. Autenticación

Todos los endpoints descritos en la sección 5 requieren autenticación. El esquema utilizado es **Bearer Token (JWT)**.

- El cliente debe incluir el token en la cabecera `Authorization` con el formato: `Authorization: Bearer <token>`.
- La emisión del token (login/registro de usuarios) queda fuera del alcance de este documento; se asume un token JWT ya emitido y válido.

**Respuestas relacionadas con autenticación** (aplican a todos los endpoints de la sección 5):

| Código             | Situación                                                                 |
| ------------------ | ------------------------------------------------------------------------- |
| `401 Unauthorized` | No se envía cabecera `Authorization`, el token es inválido o ha expirado. |

## 3. Modelo de datos

### 3.1 Jornada

| Campo           | Tipo                            | Obligatorio              | Descripción                                |
| --------------- | ------------------------------- | ------------------------ | ------------------------------------------ |
| `id`            | string (UUID)                   | Generado por el servidor | Identificador único de la jornada.         |
| `numeroJornada` | entero (≥ 1)                    | Sí                       | Número identificativo de la jornada.       |
| `fecha`         | string (ISO 8601, `YYYY-MM-DD`) | Sí                       | Fecha de la jornada.                       |
| `partidos`      | array de `Partido`              | Sí                       | Lista ordenada de exactamente 15 partidos. |

### 3.2 Partido

| Campo             | Tipo          | Obligatorio | Descripción                                           |
| ----------------- | ------------- | ----------- | ----------------------------------------------------- |
| `orden`           | entero (1–15) | Sí          | Posición secuencial del partido dentro de la jornada. |
| `equipoLocal`     | string        | Sí          | Nombre del equipo local.                              |
| `equipoVisitante` | string        | Sí          | Nombre del equipo visitante.                          |

### 3.3 Representación JSON

```json
{
  "id": "b3f1c2d0-1234-4a5b-9abc-9876543210ef",
  "numeroJornada": 1,
  "fecha": "2026-09-06",
  "partidos": [
    {
      "orden": 1,
      "equipoLocal": "Real Madrid",
      "equipoVisitante": "Barcelona"
    },
    {
      "orden": 2,
      "equipoLocal": "Atlético de Madrid",
      "equipoVisitante": "Sevilla"
    },
    { "orden": 15, "equipoLocal": "Betis", "equipoVisitante": "Villarreal" }
  ]
}
```

## 4. Reglas de validación

1. `numeroJornada` debe ser único en el sistema y un entero positivo.
2. `fecha` debe ser una fecha válida en formato ISO 8601.
3. `partidos` debe contener **exactamente 15** elementos.
4. Los valores de `orden` de los partidos deben ser los números del 1 al 15, sin repeticiones y sin huecos.
5. En cada partido, `equipoLocal` y `equipoVisitante` son obligatorios y no pueden estar vacíos.
6. Toda petición que incumpla las reglas anteriores debe rechazarse con `400 Bad Request` y un cuerpo de error describiendo el motivo.

## 5. Endpoints

Base path: `/api/jornadas`

Todos los endpoints de esta sección requieren autenticación (ver sección 2).

### 5.1 Crear una jornada

`POST /api/jornadas`

Guarda una nueva jornada junto con sus 15 partidos.

**Cuerpo de la petición**

```json
{
  "numeroJornada": 1,
  "fecha": "2026-09-06",
  "partidos": [
    {
      "orden": 1,
      "equipoLocal": "Real Madrid",
      "equipoVisitante": "Barcelona"
    },
    "... (15 partidos en total)"
  ]
}
```

**Respuestas**

| Código             | Situación                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `201 Created`      | Jornada creada. Devuelve el recurso `Jornada` completo (incluyendo `id`) en el cuerpo y su URL en la cabecera `Location`. |
| `400 Bad Request`  | La petición incumple alguna regla de validación (sección 4).                                                              |
| `401 Unauthorized` | Autenticación ausente o inválida.                                                                                         |
| `409 Conflict`     | Ya existe una jornada con el mismo `numeroJornada`.                                                                       |

### 5.2 Consultar todas las jornadas

`GET /api/jornadas`

Devuelve la lista de jornadas guardadas.

**Respuesta**

| Código             | Situación                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| `200 OK`           | Devuelve un array de `Jornada`, ordenado por `numeroJornada` ascendente. |
| `401 Unauthorized` | Autenticación ausente o inválida.                                        |

### 5.3 Consultar una jornada por número de jornada

`GET /api/jornadas/{numeroJornada}`

**Parámetros de ruta**

| Parámetro       | Tipo   | Descripción                      |
| --------------- | ------ | -------------------------------- |
| `numeroJornada` | entero | Número de la jornada a consultar |

**Respuestas**

| Código             | Situación                                          |
| ------------------ | -------------------------------------------------- |
| `200 OK`           | Devuelve el recurso `Jornada` correspondiente.     |
| `401 Unauthorized` | Autenticación ausente o inválida.                  |
| `404 Not Found`    | No existe ninguna jornada con ese `numeroJornada`. |

### 5.4 Actualizar una jornada

`PUT /api/jornadas/{numeroJornada}`

Reemplaza por completo los datos de una jornada existente (fecha y los 15 partidos). Está sujeto a las mismas reglas de validación de la sección 4.

**Parámetros de ruta**

| Parámetro       | Tipo   | Descripción                       |
| --------------- | ------ | --------------------------------- |
| `numeroJornada` | entero | Número de la jornada a actualizar |

**Cuerpo de la petición**

```json
{
  "fecha": "2026-09-06",
  "partidos": [
    {
      "orden": 1,
      "equipoLocal": "Real Madrid",
      "equipoVisitante": "Barcelona"
    },
    "... (15 partidos en total)"
  ]
}
```

**Respuestas**

| Código             | Situación                                                                |
| ------------------ | ------------------------------------------------------------------------ |
| `200 OK`           | Jornada actualizada. Devuelve el recurso `Jornada` completo actualizado. |
| `400 Bad Request`  | La petición incumple alguna regla de validación (sección 4).             |
| `401 Unauthorized` | Autenticación ausente o inválida.                                        |
| `404 Not Found`    | No existe ninguna jornada con ese `numeroJornada`.                       |

### 5.5 Eliminar una jornada

`DELETE /api/jornadas/{numeroJornada}`

Elimina una jornada existente junto con sus partidos.

**Parámetros de ruta**

| Parámetro       | Tipo   | Descripción                     |
| --------------- | ------ | ------------------------------- |
| `numeroJornada` | entero | Número de la jornada a eliminar |

**Respuestas**

| Código             | Situación                                          |
| ------------------ | -------------------------------------------------- |
| `204 No Content`   | Jornada eliminada correctamente.                   |
| `401 Unauthorized` | Autenticación ausente o inválida.                  |
| `404 Not Found`    | No existe ninguna jornada con ese `numeroJornada`. |

## 6. Formato de errores

Toda respuesta de error sigue el mismo formato:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "El campo 'partidos' debe contener exactamente 15 elementos."
}
```

Ejemplo de error de autenticación:

```json
{
  "error": "UNAUTHORIZED",
  "message": "El token de autenticación es inválido o ha expirado."
}
```
