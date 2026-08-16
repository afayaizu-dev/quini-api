import { z } from "zod";
import { registerPath } from "../../openapi/registry.js";
import { UpdatePerfilSchema, UsuarioResponseSchema } from "./usuarios.schemas.js";

const idParam = {
    name: "id",
    in: "path" as const,
    required: true,
    schema: { type: "string" as const, format: "uuid" },
    example: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
};

const usuarioEjemplo = {
    id: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    email: "jota@quini.local",
    nombre: "José",
    apellidos: "Fernández López",
    apodo: "Jota",
    telefono: "600123456",
    role: "user",
    credito: 12.5,
    createdAt: "2026-08-15T10:00:00.000Z",
};

registerPath("/usuarios/me", {
    get: {
        operationId: "usuariosGetMe",
        summary: "Consulta el perfil propio",
        description: "Devuelve el perfil completo del usuario autenticado. Distinto de /auth/me, que solo comprueba el token.",
        tags: ["usuarios"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Perfil del usuario autenticado.",
                content: { "application/json": { schema: UsuarioResponseSchema, example: usuarioEjemplo } },
            },
            "401": { description: "Sin access token válido." },
        },
    },
    put: {
        operationId: "usuariosUpdateMe",
        summary: "Actualiza el perfil propio",
        description: "Actualiza nombre, apellidos, apodo y/o teléfono del usuario autenticado. Nunca email ni role: mandarlos da 400.",
        tags: ["usuarios"],
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdatePerfilSchema,
                    example: { apellidos: "Fernández López", apodo: "Jota", telefono: "600123456" },
                },
            },
        },
        responses: {
            "200": {
                description: "Perfil actualizado.",
                content: { "application/json": { schema: UsuarioResponseSchema, example: usuarioEjemplo } },
            },
            "400": { description: "Datos inválidos, o se ha mandado role/email (rechazados por .strict())." },
            "401": { description: "Sin access token válido." },
            "409": { description: "Ya existe otro miembro con ese apodo." },
        },
    },
});

registerPath("/usuarios", {
    get: {
        operationId: "usuariosFindAll",
        summary: "Lista todos los miembros",
        description: "Solo un admin puede ver el listado completo de miembros (incluye a los propios admins).",
        tags: ["usuarios"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        responses: {
            "200": {
                description: "Lista de miembros.",
                content: { "application/json": { schema: z.array(UsuarioResponseSchema), example: [usuarioEjemplo] } },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
        },
    },
});

registerPath("/usuarios/{id}", {
    get: {
        operationId: "usuariosFindById",
        summary: "Consulta el perfil de un miembro",
        description: "Solo un admin puede consultar el perfil de otro miembro.",
        tags: ["usuarios"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        responses: {
            "200": {
                description: "Perfil del miembro.",
                content: { "application/json": { schema: UsuarioResponseSchema, example: usuarioEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe un usuario con ese id." },
        },
    },
    put: {
        operationId: "usuariosUpdate",
        summary: "Actualiza el perfil de un miembro",
        description: "Solo un admin puede actualizar el perfil de otro miembro. Mismo contrato que PUT /usuarios/me.",
        tags: ["usuarios"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        parameters: [idParam],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: UpdatePerfilSchema,
                    example: { apellidos: "Fernández López", apodo: "Jota", telefono: "600123456" },
                },
            },
        },
        responses: {
            "200": {
                description: "Perfil actualizado.",
                content: { "application/json": { schema: UsuarioResponseSchema, example: usuarioEjemplo } },
            },
            "400": { description: "Datos inválidos, o se ha mandado role/email (rechazados por .strict())." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "404": { description: "No existe un usuario con ese id." },
            "409": { description: "Ya existe otro miembro con ese apodo." },
        },
    },
});