import { registerPath } from "../../openapi/registry.js";
import { CreateInvitationSchema, InvitationResponseSchema, InvitationValidationSchema } from "./invitations.schemas.js";

registerPath("/invitaciones", {
    post: {
        operationId: "invitationsCreate",
        summary: "Crea una invitación de un solo uso",
        description: "Solo un admin puede invitar. El token en claro se devuelve una sola vez en la respuesta; después es irrecuperable.",
        tags: ["invitaciones"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: CreateInvitationSchema,
                    example: { email: "pepe@example.com", role: "user" },
                },
            },
        },
        responses: {
            "201": {
                description: "Invitación creada.",
                content: {
                    "application/json": {
                        schema: InvitationResponseSchema,
                        example: {
                            id: "019fe8c3-a54e-7b7f-8c8f-e57f0da23eba",
                            email: "pepe@example.com",
                            expiresAt: "2026-08-16T23:02:43.782Z",
                            url: "http://localhost:5173/registro?token=5rJnTHUDGC2bHp0KgNbp5Z0aeIlJWTTKWZ9wQcGlImQ",
                        },
                    },
                },
            },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
            "409": { description: "Ya existe una invitación pendiente para ese email." },
        },
    },
});

registerPath("/invitaciones/{token}/validar", {
    get: {
        operationId: "invitationsValidate",
        summary: "Comprueba si un token de invitación sigue siendo válido",
        description: "Endpoint público (sin autenticación), pensado para que el frontend valide el link antes de mostrar el formulario de registro.",
        tags: ["invitaciones"],
        parameters: [{ name: "token", in: "path", required: true, schema: { type: "string" } }],
        responses: {
            "200": {
                description: "Invitación usable.",
                content: {
                    "application/json": {
                        schema: InvitationValidationSchema,
                        example: { email: "pepe@example.com", role: "user", expiresAt: "2026-08-16T23:02:43.782Z" },
                    },
                },
            },
            "404": { description: "El token no existe." },
            "410": { description: "La invitación ya fue usada, revocada o caducó." },
            "429": { description: "Demasiados intentos fallidos (rate limit)." },
        },
    },
});
