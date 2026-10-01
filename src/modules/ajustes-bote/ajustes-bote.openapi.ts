import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import { CreateAjusteBoteSchema, AjusteBoteResponseSchema } from "./ajustes-bote.schemas.js";

const idParam = {
    name: "id",
    in: "path" as const,
    required: true,
    schema: { type: "string" as const, format: "uuid" },
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

registerPath("/ajustes-bote", {
    post: {
        operationId: "ajustesBoteCreate",
        summary: "Registra un ajuste manual del bote",
        description:
            "Ajuste manual que suma o resta al bote de la temporada activa. El importe admite valores negativos.",
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
                description: "importe con más de 2 decimales, motivo vacío, o fecha con formato inválido.",
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No hay ninguna temporada activa." },
        },
    },
    get: {
        operationId: "ajustesBoteFindAll",
        summary: "Lista todos los ajustes de bote",
        description:
            "Lista global de ajustes, sin filtrar por temporada. Disponible para cualquier usuario autenticado, como parte de la transparencia de la clasificación.",
        tags: ["ajustes-bote"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Lista de ajustes de bote.",
                content: {
                    "application/json": {
                        schema: z.array(AjusteBoteResponseSchema),
                        example: [ajusteBoteEjemplo],
                    },
                },
            },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/ajustes-bote/{id}", {
    delete: {
        operationId: "ajustesBoteRemove",
        summary: "Elimina un ajuste de bote",
        description: "Un ajuste mal apuntado se borra y se vuelve a crear; no existe PUT.",
        tags: ["ajustes-bote"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        responses: {
            "204": { description: "Ajuste de bote eliminado." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe ese ajuste de bote." },
        },
    },
});
