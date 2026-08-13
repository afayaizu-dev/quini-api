import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import {
    CreateEquipoSchema,
    UpdateEquipoSchema,
    EquipoResponseSchema,
} from "./equipos.schemas.js";

const idParam = {
    name: "id",
    in: "path" as const,
    required: true,
    schema: { type: "string" as const, format: "uuid" },
    example: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
};

const equipoEjemplo = {
    id: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    nombreLargo: "Real Madrid",
    nombreCorto: "RM",
    createdAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/equipos", {
    get: {
        operationId: "equiposFindAll",
        summary: "Lista todos los equipos",
        description: "Cualquier usuario autenticado puede consultar el catálogo completo de equipos.",
        tags: ["equipos"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Lista de equipos.",
                content: {
                    "application/json": {
                        schema: z.array(EquipoResponseSchema),
                        example: [equipoEjemplo],
                    },
                },
            },
            "401": { description: "Sin access token válido." },
        },
    },
    post: {
        operationId: "equiposCreate",
        summary: "Crea un equipo",
        description: "Solo un admin puede añadir equipos al catálogo.",
        tags: ["equipos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: CreateEquipoSchema,
                    example: { nombreLargo: "Real Madrid", nombreCorto: "RM" },
                },
            },
        },
        responses: {
            "201": {
                description: "Equipo creado.",
                content: { "application/json": { schema: EquipoResponseSchema, example: equipoEjemplo } },
            },
            "400": { description: "nombreLargo o nombreCorto vacíos." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "409": { description: "Ya existe un equipo con ese nombreLargo." },
        },
    },
});

registerPath("/equipos/{id}", {
    get: {
        operationId: "equiposFindById",
        summary: "Consulta un equipo por su id",
        description: "Devuelve los datos de un equipo concreto a partir de su id.",
        tags: ["equipos"],
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
            "200": {
                description: "Equipo encontrado.",
                content: { "application/json": { schema: EquipoResponseSchema, example: equipoEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe un equipo con ese id." },
        },
    },
    put: {
        operationId: "equiposUpdate",
        summary: "Actualiza un equipo",
        description: "Actualiza el nombreLargo y/o nombreCorto de un equipo existente.",
        tags: ["equipos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdateEquipoSchema,
                    example: { nombreLargo: "Real Madrid CF", nombreCorto: "RMA" },
                },
            },
        },
        responses: {
            "200": {
                description: "Equipo actualizado.",
                content: { "application/json": { schema: EquipoResponseSchema, example: equipoEjemplo } },
            },
            "400": { description: "nombreLargo o nombreCorto vacíos." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe un equipo con ese id." },
            "409": { description: "Ya existe otro equipo con ese nombreLargo." },
        },
    },
    delete: {
        operationId: "equiposRemove",
        summary: "Elimina un equipo",
        description: "Solo se puede borrar si no tiene partidos asociados (restricción RESTRICT en BD).",
        tags: ["equipos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        responses: {
            "204": { description: "Equipo eliminado." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe un equipo con ese id." },
            "409": { description: "El equipo tiene partidos asociados (RESTRICT)." },
        },
    },
});
