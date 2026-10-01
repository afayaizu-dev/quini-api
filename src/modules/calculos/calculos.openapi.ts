import { registerPath } from "../../openapi/registry.js";
import { EjecutarCalculoSchema, CalculoResponseSchema } from "./calculos.schemas.js";

const jornadaQueryParam = {
    name: "jornada",
    in: "query" as const,
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

const miembroEjemplo = {
    usuarioId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    aciertosApuesta1: 8,
    aciertosApuesta2: 10,
    aciertosMax: 10,
    premioApuesta1: 0,
    premioApuesta2: 10.49,
    ranking: 1,
    escalon: 1,
    importeEscalon: 1.5,
    costeApuestas: 1.5,
    bote: 10.49,
};

const calculoEjemplo = {
    jornada: 1,
    temporada: "2026-27",
    miembros: [miembroEjemplo],
    boteTotal: 17.49,
    premiosTotal: 10.49,
    costeTotal: 15.0,
};

registerPath("/calculos", {
    post: {
        operationId: "calculosEjecutar",
        summary: "Ejecuta (o recalcula) la liquidación de una jornada",
        description: "Cruza apuestas y resultados, calcula aciertos, premios, escalón y bote por miembro, y cierra la jornada. Idempotente: se puede volver a ejecutar tras corregir un resultado.",
        tags: ["calculos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: { "application/json": { schema: EjecutarCalculoSchema, example: { jornada: 1 } } },
        },
        responses: {
            "200": {
                description: "Liquidación calculada.",
                content: { "application/json": { schema: CalculoResponseSchema, example: calculoEjemplo } },
            },
            "400": { description: "'jornada' no es un entero positivo, o 'temporada' no tiene el formato correcto." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "Temporada o jornada inexistentes; o no hay temporada activa y no se especificó ninguna." },
            "409": { description: "Temporada no activa (no se recalculan jornadas de temporadas cerradas: el bote heredado quedaría desfasado), apuestas todavía abiertas, sin resultados registrados, o sin ninguna apuesta." },
        },
    },
    get: {
        operationId: "calculosFindByJornada",
        summary: "Consulta la liquidación ya calculada de una jornada",
        description: "Devuelve la fila por miembro (ordenada por ranking) más los agregados de la jornada.",
        tags: ["calculos"],
        security: [{ bearerAuth: [] }],
        parameters: [jornadaQueryParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Liquidación encontrada.",
                content: { "application/json": { schema: CalculoResponseSchema, example: calculoEjemplo } },
            },
            "400": { description: "'jornada' no es un entero positivo." },
            "401": { description: "Sin access token válido." },
            "404": { description: "Jornada, temporada, o cálculo aún no ejecutado para esa jornada." },
        },
    },
});
