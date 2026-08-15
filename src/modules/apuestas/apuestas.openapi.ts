import { z } from "zod"
import { registerPath } from "../../openapi/registry.js";
import { CreateApuestaSchema, UpdateApuestaSchema, ApuestaResponseSchema } from "./apuestas.schemas.js";

const numeroJornadaParam = {
    name: "numeroJornada",
    in: "path" as const,
    required: true,
    schema: { type: "integer" as const, minimum: 1 },
    example: 1,
};

const numeroApuestaParam = {
    name: "numeroApuesta",
    in: "path" as const,
    required: true,
    schema: { type: "integer" as const, minimum: 1, maximum: 2 },
    example: 1,
};

const temporadaQueryParam = {
    name: "temporada",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, pattern: "^\\d{4}-\\d{2}$" },
    example: "2026-27",
};

const partidosEjemplo = ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"];

const createApuestaEjemplo = {
    numeroApuesta: 1,
    partidos: partidosEjemplo,
    sugerenciaPleno15: "1-M",
};

const apuestaEjemplo = {
    id: "019ffc0e-aaaa-7c46-b05d-46bf7829c803",
    numeroApuesta: 1,
    partidos: partidosEjemplo,
    sugerenciaPleno15: "1-M",
    usuarioId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    creadaPorElMismo: true,
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/jornadas/{numeroJornada}/apuestas", {
    post: {
        operationId: "apuestasCreate",
        summary: "Registra una apuesta (1 o 2) para una jornada",
        description: "El usuario apuesta para sí mismo. Un admin puede apostar por otro pasando 'usuarioId' en el body.",
        tags: ["apuestas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: { "application/json": { schema: CreateApuestaSchema, example: createApuestaEjemplo } },
        },
        responses: {
            "201": {
                description: "Apuesta creada.",
                headers: {
                    Location: {
                        description: "/api/v1/jornadas/{numeroJornada}/apuestas/{numeroApuesta}",
                        schema: { type: "string" },
                    },
                },
                content: { "application/json": { schema: ApuestaResponseSchema, example: apuestaEjemplo } },
            },
            "400": { description: "numeroApuesta, partidos o sugerenciaPleno15 inválidos." },
            "401": { description: "Sin access token válido." },
            "403": { description: "'usuarioId' informado por un usuario que no es admin." },
            "404": { description: "Jornada, temporada o 'usuarioId' inexistentes." },
            "409": { description: "Apuestas cerradas, jornada calculada, o ya existe esa apuesta para ese usuario." },
        },
    },
    get: {
        operationId: "apuestasFindByJornada",
        summary: "Lista las apuestas de una jornada",
        description: "Un admin las ve siempre; el resto de usuarios solo cuando las apuestas están cerradas.",
        tags: ["apuestas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Lista de apuestas.",
                content: { "application/json": { schema: z.array(ApuestaResponseSchema), example: [apuestaEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "Apuestas todavía abiertas y el usuario no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});

registerPath("/jornadas/{numeroJornada}/apuestas/mias", {
    get: {
        operationId: "apuestasFindMias",
        summary: "Lista las apuestas propias de una jornada",
        description: "Devuelve solo las apuestas del usuario autenticado, sin importar si las apuestas están abiertas o cerradas.",
        tags: ["apuestas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Apuestas del usuario autenticado.",
                content: { "application/json": { schema: z.array(ApuestaResponseSchema), example: [apuestaEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
});

registerPath("/jornadas/{numeroJornada}/apuestas/{numeroApuesta}", {
    put: {
        operationId: "apuestasReplace",
        summary: "Reemplaza los 14 signos de una apuesta",
        description: "El propio usuario, o un admin sobre la de otro pasando 'usuarioId' en el body.",
        tags: ["apuestas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, numeroApuestaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdateApuestaSchema,
                    example: { partidos: partidosEjemplo, sugerenciaPleno15: "1-M" },
                },
            },
        },
        responses: {
            "200": {
                description: "Apuesta actualizada.",
                content: { "application/json": { schema: ApuestaResponseSchema, example: apuestaEjemplo } },
            },
            "400": { description: "Partidos o sugerenciaPleno15 inválidos." },
            "401": { description: "Sin access token válido." },
            "403": { description: "'usuarioId' de otro miembro, informado por un usuario que no es admin." },
            "404": { description: "Jornada, temporada, 'usuarioId' o la apuesta no existen." },
            "409": { description: "Las apuestas de esta jornada están cerradas." },
        },
    },
    delete: {
        operationId: "apuestasRemove",
        summary: "Elimina una apuesta propia",
        description: "Solo se puede borrar la propia apuesta del usuario autenticado, y solo mientras las apuestas estén abiertas.",
        tags: ["apuestas"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, numeroApuestaParam, temporadaQueryParam],
        responses: {
            "204": { description: "Apuesta eliminada." },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe esa apuesta para el usuario autenticado en esa jornada." },
            "409": { description: "Las apuestas de esta jornada están cerradas." },
        },
    },
});
