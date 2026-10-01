import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import {
    CreateTemporadaSchema,
    UpdateTemporadaSchema,
    TemporadaResponseSchema,
} from "./temporadas.schemas.js";

const codigoParam = {
    name: "codigo",
    in: "path" as const,
    required: true,
    schema: { type: "string" as const, pattern: "^\\d{4}-\\d{2}$" },
    example: "2026-27",
};

const temporadaEjemplo = {
    id: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    codigo: "2026-27",
    nombre: "Temporada 2026/27",
    fechaInicio: "2026-08-15",
    fechaFin: "2027-05-30",
    activa: false,
    createdAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/temporadas", {
    get: {
        operationId: "temporadasFindAll",
        summary: "Lista todas las temporadas",
        description: "Cualquier usuario autenticado puede consultar la lista completa.",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Lista de temporadas.",
                content: {
                    "application/json": {
                        schema: z.array(TemporadaResponseSchema),
                        example: [temporadaEjemplo],
                    },
                },
            },
            "401": { description: "Sin access token válido." },
        },
    },
    post: {
        operationId: "temporadasCreate",
        summary: "Crea una temporada",
        description: "Solo un admin puede crear temporadas. El código es inmutable tras crearse.",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: CreateTemporadaSchema,
                    example: {
                        codigo: "2026-27",
                        nombre: "Temporada 2026/27",
                        fechaInicio: "2026-08-15",
                        fechaFin: "2027-05-30",
                    },
                },
            },
        },
        responses: {
            "201": {
                description: "Temporada creada.",
                content: {
                    "application/json": { schema: TemporadaResponseSchema, example: temporadaEjemplo },
                },
            },
            "400": { description: "Código con formato inválido, o fechaFin no posterior a fechaInicio." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "409": { description: "Ya existe una temporada con ese código." },
        },
    },
});

registerPath("/temporadas/{codigo}", {
    get: {
        operationId: "temporadasFindByCodigo",
        summary: "Consulta una temporada por su código",
        description: "Cualquier usuario autenticado puede consultar una temporada concreta.",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        parameters: [codigoParam],
        responses: {
            "200": {
                description: "Temporada encontrada.",
                content: { "application/json": { schema: TemporadaResponseSchema, example: temporadaEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe una temporada con ese código." },
        },
    },
    put: {
        operationId: "temporadasUpdate",
        summary: "Actualiza el nombre y las fechas de una temporada",
        description: "El código no se puede cambiar tras la creación (no aparece en este esquema).",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [codigoParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdateTemporadaSchema,
                    example: {
                        nombre: "Temporada 2026/27 (revisada)",
                        fechaInicio: "2026-08-15",
                        fechaFin: "2027-06-15",
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Temporada actualizada.",
                content: { "application/json": { schema: TemporadaResponseSchema, example: temporadaEjemplo } },
            },
            "400": { description: "fechaFin no posterior a fechaInicio." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe una temporada con ese código." },
        },
    },
    delete: {
        operationId: "temporadasRemove",
        summary: "Elimina una temporada",
        description:
            "Solo se puede borrar si no tiene jornadas ni ajustes de bote manuales y no es el origen del bote heredado de otra temporada (RESTRICT en BD). Su propio bote heredado se borra con ella.",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [codigoParam],
        responses: {
            "204": { description: "Temporada eliminada." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe una temporada con ese código." },
            "409": { description: "La temporada tiene jornadas o ajustes de bote asociados, o es origen de un bote heredado (RESTRICT)." },
        },
    },
});

registerPath("/temporadas/{codigo}/activar", {
    post: {
        operationId: "temporadasActivate",
        summary: "Marca una temporada como la activa",
        description:
            "Desactiva cualquier otra temporada activa y activa esta, en una única transacción (garantizado además por un índice único parcial en BD). Si la temporada que estaba activa empezó antes que esta, en la misma transacción se crea (o se recalcula, si ya existía) en esta un ajuste 'Bote heredado de <código anterior>' con el bote final de la anterior y fecha = fechaInicio. Re-activar la misma temporada o una más antigua no toca ningún bote heredado.",
        tags: ["temporadas"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [codigoParam],
        responses: {
            "200": {
                description: "Temporada activada.",
                content: {
                    "application/json": {
                        schema: TemporadaResponseSchema,
                        example: { ...temporadaEjemplo, activa: true },
                    },
                },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe una temporada con ese código." },
        },
    },
});