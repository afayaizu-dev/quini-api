import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import { CreatePagoSchema, PagoResponseSchema } from "./pagos.schemas.js";

const idParam = {
    name: "id",
    in: "path" as const,
    required: true,
    schema: { type: "string" as const, format: "uuid" },
};

const usuarioQueryParam = {
    name: "usuario",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, format: "uuid" },
};

const desdeQueryParam = {
    name: "desde",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, format: "date" },
    example: "2026-08-01",
};

const hastaQueryParam = {
    name: "hasta",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, format: "date" },
    example: "2026-08-31",
};

const createPagoEjemplo = {
    usuarioId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    importe: 50.0,
    fechaPago: "2026-09-01",
};

const pagoEjemplo = {
    id: "019ffc0e-bbbb-7c46-b05d-46bf7829c803",
    ...createPagoEjemplo,
    registradoPor: "019ff7eb-9999-7b8c-a948-6ca9a14625e6",
    createdAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/pagos", {
    post: {
        operationId: "pagosCreate",
        summary: "Registra un pago de un miembro",
        description: "Sube el crédito del miembro. No hay PUT: un pago mal apuntado se borra y se vuelve a crear.",
        tags: ["pagos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: { "application/json": { schema: CreatePagoSchema, example: createPagoEjemplo } },
        },
        responses: {
            "201": {
                description: "Pago registrado.",
                headers: { Location: { description: "/api/v1/pagos/{id}", schema: { type: "string" } } },
                content: { "application/json": { schema: PagoResponseSchema, example: pagoEjemplo } },
            },
            "400": { description: "importe <= 0, con más de 2 decimales, o fechaPago con formato inválido." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe el usuarioId indicado." },
        },
    },
    get: {
        operationId: "pagosFindAll",
        summary: "Lista los pagos, con filtros opcionales",
        description:
            "Filtra por usuario y/o por rango de fechaPago (desde/hasta, ambos inclusive). Disponible para cualquier usuario autenticado, como parte de la transparencia de la clasificación.",
        tags: ["pagos"],
        security: [{ bearerAuth: [] }],
        parameters: [usuarioQueryParam, desdeQueryParam, hastaQueryParam],
        responses: {
            "200": {
                description: "Lista de pagos.",
                content: { "application/json": { schema: z.array(PagoResponseSchema), example: [pagoEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/pagos/mios", {
    get: {
        operationId: "pagosFindMios",
        summary: "Lista los pagos propios",
        description: "Devuelve únicamente los pagos del usuario autenticado.",
        tags: ["pagos"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Pagos del usuario autenticado.",
                content: { "application/json": { schema: z.array(PagoResponseSchema), example: [pagoEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/pagos/{id}", {
    delete: {
        operationId: "pagosRemove",
        summary: "Elimina un pago",
        description: "Un pago mal apuntado se borra y se vuelve a crear; no existe PUT.",
        tags: ["pagos"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        responses: {
            "204": { description: "Pago eliminado." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe ese pago." },
        },
    },
});
