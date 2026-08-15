import { registerPath } from "../../openapi/registry.js";
import { UpsertResultadosSchema, ResultadosResponseSchema } from "./resultados.schemas.js";

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

const upsertResultadosEjemplo = {
    resultados: ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
    resultado15: "1-M",
    premios: { "10": 15.5, "11": 30, "12": 60, "13": 150, "14": 1200, "15": 50000 },
};

const resultadosEjemplo = {
    id: "019ffc0e-9999-7c46-b05d-46bf7829c803",
    ...upsertResultadosEjemplo,
    createdAt: "2026-08-15T10:00:00.000Z",
    updatedAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/jornadas/{numeroJornada}/resultados", {
    get: {
        operationId: "resultadosFindByJornada",
        summary: "Consulta los resultados oficiales de una jornada",
        description: "Devuelve los 14 signos, el pleno al 15 y los premios por categoría, si ya están registrados.",
        tags: ["resultados"],
        security: [{ bearerAuth: [] }],
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Resultados encontrados.",
                content: { "application/json": { schema: ResultadosResponseSchema, example: resultadosEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe esa jornada, o no tiene resultados registrados." },
        },
    },
    put: {
        operationId: "resultadosUpsert",
        summary: "Registra o actualiza los resultados de una jornada",
        description: "Alta si no existían (201) o reemplazo total si ya existían (200), en una única operación.",
        tags: ["resultados"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        requestBody: {
            required: true,
            content: {
                "application/json": { schema: UpsertResultadosSchema, example: upsertResultadosEjemplo },
            },
        },
        responses: {
            "201": {
                description: "Resultados creados.",
                headers: {
                    Location: {
                        description: "/api/v1/jornadas/{numeroJornada}/resultados, con '?temporada=' si no es la activa.",
                        schema: { type: "string" },
                    },
                },
                content: { "application/json": { schema: ResultadosResponseSchema, example: resultadosEjemplo } },
            },
            "200": {
                description: "Resultados actualizados.",
                content: { "application/json": { schema: ResultadosResponseSchema, example: resultadosEjemplo } },
            },
            "400": { description: "Signos, pleno al 15 o importes inválidos." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
        },
    },
    delete: {
        operationId: "resultadosRemove",
        summary: "Elimina los resultados de una jornada",
        description: "Solo si la jornada no está ya calculada (fechaCierreJornada = null).",
        tags: ["resultados"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [numeroJornadaParam, temporadaQueryParam],
        responses: {
            "204": { description: "Resultados eliminados." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe esa jornada en la temporada." },
            "409": { description: "La jornada ya está calculada." },
        },
    },
});