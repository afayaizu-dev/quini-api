import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";

import {
    CreateJornadaSchema,
    UpdateJornadaSchema,
    JornadaResponseSchema,
    FechasJornadaSchema,
    PlenoJornadaSchema,
} from "./jornadas.schemas.js";

const numeroJornadaParam = {
    name: "numeroJornada",
    in: "path" as const,
    required: true,
    schema: { type: "integer" as const, minimum: 1 },
    example: 1,
};

const temporadaQueryParam = {
    name: "temporada",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, pattern: "^\\d{4}-\\d{2}$" },
    example: "2026-27",
};

const partidosEjemplo = Array.from({ length: 15 }, (_, i) => ({
    orden: i + 1,
    equipoLocal: i === 0 ? "Real Madrid" : `Equipo Local ${i + 1}`,
    equipoVisitante: i === 0 ? "Barcelona" : `Equipo Visitante ${i + 1}`,
}));

const createJornadaEjemplo = {
    numeroJornada: 1,
    fecha: "2026-08-20",
    partidos: partidosEjemplo,
};


const jornadaEjemplo = {
    id: "019ffc0e-1234-7c46-b05d-46bf7829c803",
    temporada: "2026-27",
    numeroJornada: 1,
    fecha: "2026-08-20",
    fechaAperturaApuestas: null,
    fechaCierreApuestas: null,
    fechaCierreJornada: null,
    apuestaPleno15: null,
    apuestasAbiertas: false,
    partidos: partidosEjemplo.map((p, i) => ({
        id: `019ffc0e-8251-7c46-b05d-${(1000 + i).toString().padStart(12, "0")}`,
        orden: p.orden,
        equipoLocalId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
        equipoVisitanteId: "019ff7ec-47d1-75ea-abf9-a10ccae92634",
    })),
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
};


registerPath("/jornadas", {
    get: {
        operationId: "jornadasFindAll",
        summary: "Lista las jornadas de una temporada",
        description: "Sin '?temporada=', usa la temporada activa. Los partidos siempre vienen ordenados 1..15.",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        parameters: [temporadaQueryParam],
        responses: {
            "200": {
                description: "Lista de jornadas.",
                content: { "application/json": { schema: z.array(JornadaResponseSchema), example: [jornadaEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No hay temporada activa y no se especificó '?temporada='." },
        },
    },
    post: {
        operationId: "jornadasCreate",
        summary: "Crea una jornada con sus 15 partidos",
        description: "Resuelve equipoLocal/equipoVisitante contra el catálogo de equipos antes de guardar. Todo ocurre en una única transacción.",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: CreateJornadaSchema,
                    example: createJornadaEjemplo,
                },
            },
        },
        responses: {
            "201": {
                description: "Jornada creada.",
                headers: {
                    Location: {
                        description: "/api/v1/jornadas/{numeroJornada}, con '?temporada=' si no es la activa.",
                        schema: { type: "string" },
                    },
                },
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": {
                description: "Partidos inválidos (conteo, orden duplicado/con huecos), equipo en blanco, fecha inválida o numeroJornada <= 0.",
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "Temporada o algún equipo no existen; o no hay temporada activa y no se especificó ninguna." },
            "409": { description: "Ya existe esa jornada en la temporada." },
        },
    },
});

registerPath("/jornadas/{numeroJornada}", {
    get: {
        operationId: "jornadasFindByNumero",
        summary: "Consulta una jornada por su número",
        description: "Devuelve la jornada con sus 15 partidos, ordenados 1..15.",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Jornada encontrada.",
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": { description: "numeroJornada no es un entero positivo." },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
    put: {
        operationId: "jornadasReplace",
        summary: "Reemplaza la fecha y los 15 partidos de una jornada",
        description: "Reemplazo total: borra los partidos existentes e inserta los nuevos, en una única transacción.",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdateJornadaSchema,
                    example: { fecha: createJornadaEjemplo.fecha, partidos: createJornadaEjemplo.partidos },
                },
            },
        },
        responses: {
            "200": {
                description: "Jornada actualizada.",
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": { description: "Partidos inválidos (conteo, orden duplicado/con huecos), equipo en blanco o fecha inválida." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada, la temporada, o algún equipo." },
        },
    },
    delete: {
        operationId: "jornadasRemove",
        summary: "Elimina una jornada y sus partidos",
        description: "Los partidos se borran en cascada (ON DELETE CASCADE).",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "204": { description: "Jornada eliminada." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});


registerPath("/jornadas/{numeroJornada}/fechas", {
    put: {
        operationId: "jornadasUpdateFechas",
        summary: "Fija las fechas de apertura/cierre de apuestas y de cierre de la jornada",
        description: "Cualquiera de las 3 puede ir a null. Es también la vía para reabrir una jornada ya calculada (poniendo fechaCierreJornada a null).",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: FechasJornadaSchema,
                    example: {
                        fechaAperturaApuestas: "2026-09-01T10:00:00Z",
                        fechaCierreApuestas: "2026-09-05T20:00:00Z",
                        fechaCierreJornada: null,
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Jornada con las fechas actualizadas.",
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": { description: "fechaCierreApuestas no es posterior a fechaAperturaApuestas." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});

registerPath("/jornadas/{numeroJornada}/cerrar-apuestas", {
    post: {
        operationId: "jornadasCerrarApuestas",
        summary: "Cierra las apuestas de la jornada ahora mismo",
        description: "Atajo equivalente a poner fechaCierreApuestas = now() con PUT /fechas.",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Jornada con las apuestas cerradas.",
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});

registerPath("/jornadas/{numeroJornada}/pleno", {
    put: {
        operationId: "jornadasUpdatePleno",
        summary: "Fija la apuesta oficial de la peña al pleno al 15",
        description: "Una única apuesta oficial por jornada, con la forma 'n-n' (n en 0,1,2,M).",
        tags: ["jornadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: {
                "application/json": { schema: PlenoJornadaSchema, example: { apuestaPleno15: "1-M" } },
            },
        },
        responses: {
            "200": {
                description: "Jornada con el pleno oficial actualizado.",
                content: { "application/json": { schema: JornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": { description: "apuestaPleno15 no tiene la forma 'n-n' válida." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});