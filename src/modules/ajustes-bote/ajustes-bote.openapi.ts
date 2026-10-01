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
                description: "No existe esa temporada, o no hay temporada activa y no se especificó ninguna.",
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
                description: "No existe esa temporada, o no hay temporada activa y no se especificó ninguna.",
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
            "409": { description: "El ajuste es un bote heredado, o pertenece a una temporada que no es la activa." },
        },
    },
});
