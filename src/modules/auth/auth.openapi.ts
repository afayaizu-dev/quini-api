import { registerPath } from "../../openapi/registry.js";


import { z } from "zod";
import {
    GoogleIdTokenRequestSchema,
    RegisterRequestSchema,
    RevokeRequestSchema,
    TokenRequestSchema,
    TokenResponseSchema,
} from "./auth.schemas.js";


registerPath("/auth/token", {
    post: {
        operationId: "authToken",
        summary: "Obtiene tokens (password grant o refresh_token grant)",
        description:
            "Compatible en forma con el password grant de OAuth2 (RFC 6749). También acepta grant_type=refresh_token para rotar el refresh token, con detección de reuso. Ver docs/02-Autenticacion.md.",
        tags: ["auth"],
        requestBody: {
            required: true,
            content: {
                "application/x-www-form-urlencoded": {
                    schema: TokenRequestSchema,
                    examples: {
                        password: {
                            summary: "Login con contraseña",
                            value: { grant_type: "password", username: "admin@quini.local", password: "TuPass123456" },
                        },
                        refresh: {
                            summary: "Renovar con refresh_token",
                            value: { grant_type: "refresh_token", refresh_token: "kUyRts-..." },
                        },
                        google_code: {
                            summary: "Canjear código de login con Google",
                            value: { grant_type: "google_code", code: "Lo7AsDGYplMii2-i3Xml36UyAULZ5FHiOcD03CDF5N0" },
                        },
                    },
                },
            },
        },
        responses: {
            "200": {
                description: "Tokens emitidos correctamente.",
                content: {
                    "application/json": {
                        schema: TokenResponseSchema,
                        example: {
                            access_token: "eyJhbGciOiJIUzI1NiJ9...",
                            token_type: "Bearer",
                            expires_in: 900,
                            refresh_token: "kUyRts-...",
                        },
                    },
                },
            },
            "400": { description: "Body mal formado o campos faltantes." },
            "401": { description: "Credenciales incorrectas o refresh token inválido/reutilizado." },
            "429": { description: "Demasiados intentos fallidos (rate limit)." },
        },
    },
});


const MeResponseSchema = z.object({
    userId: z.uuid(),
    email: z.email(),
    role: z.enum(["user", "admin"]),
});

registerPath("/auth/revoke", {
    post: {
        operationId: "authRevoke",
        summary: "Revoca un refresh token concreto",
        description: "Cierra sesión en un solo dispositivo/sesión. Si el token ya no existe o ya estaba revocado, no falla (operación idempotente).",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: RevokeRequestSchema,
                    example: { refresh_token: "kUyRts-..." },
                },
            },
        },
        responses: {
            "204": { description: "Revocado (o ya lo estaba)." },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/auth/logout", {
    post: {
        operationId: "authLogout",
        summary: "Revoca todos los refresh tokens del usuario autenticado",
        description: "Cierra sesión en todos los dispositivos.",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        responses: {
            "204": { description: "Todas las sesiones cerradas." },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/auth/me", {
    get: {
        operationId: "authMe",
        summary: "Devuelve la identidad del usuario autenticado",
        description: "Lee el payload del access token ya verificado por requireAuth — no consulta la base de datos.",
        tags: ["auth"],
        security: [{ bearerAuth: [] }],
        responses: {
            "200": {
                description: "Payload del access token.",
                content: {
                    "application/json": {
                        schema: MeResponseSchema,
                        example: { userId: "019fe824-d230-782b-9157-e345641ed2f9", email: "admin@quini.local", role: "admin" },
                    },
                },
            },
            "401": { description: "Sin access token válido." },
        },
    },
});

registerPath("/auth/register", {
    post: {
        operationId: "authRegister",
        summary: "Completa el registro a partir de una invitación",
        description: "Consume una invitación de un solo uso (por token) y crea el usuario con el rol de la invitación, en una transacción. Ver docs/02-Autenticacion.md.",
        tags: ["auth"],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: RegisterRequestSchema,
                    example: { token: "5rJnTHUDGC2bHp0KgNbp5Z0aeIlJWTTKWZ9wQcGlImQ", password: "OtraPass123456", nombre: "Pepe" },
                },
            },
        },
        responses: {
            "201": {
                description: "Usuario creado y tokens emitidos.",
                content: {
                    "application/json": {
                        schema: TokenResponseSchema,
                        example: { access_token: "eyJhbGciOiJIUzI1NiJ9...", token_type: "Bearer", expires_in: 900, refresh_token: "kUyRts-..." },
                    },
                },
            },
            "404": { description: "El token de invitación no existe." },
            "410": { description: "La invitación ya fue usada, revocada o caducó." },
            "429": { description: "Demasiados intentos fallidos (rate limit)." },
        },
    },
});

registerPath("/auth/google", {
    get: {
        operationId: "authGoogleAuthorize",
        summary: "Inicia el login con Google (Authorization Code + PKCE)",
        description: "Redirige a Google. Ver docs/02-Autenticacion.md.",
        tags: ["auth"],
        security: [{ oauth2Google: [] }],
        responses: {
            "302": { description: "Redirección a la pantalla de consentimiento de Google." },
        },
    },
});

registerPath("/auth/google/callback", {
    get: {
        operationId: "authGoogleCallback",
        summary: "Callback de Google tras el consentimiento",
        description: "Google redirige aquí tras el consentimiento. Verifica state (CSRF) y canjea el code por el id_token.",
        tags: ["auth"],
        parameters: [
            { name: "code", in: "query", required: true, schema: { type: "string" } },
            { name: "state", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: {
            "302": {
                description:
                    "Redirección a `PUBLIC_APP_URL`/login con un parámetro de query. En éxito, `google_code` (código de un solo uso, caduca en 60s; el cliente debe canjearlo con POST /auth/token usando grant_type=google_code para obtener el par de tokens). En error, `google_error` con uno de: invalid_request | registration_not_allowed | google_auth_failed.",
            },
        },
    },
});

registerPath("/auth/google/id-token", {
    post: {
        operationId: "authGoogleIdToken",
        summary: "Login con Google a partir de un id_token ya obtenido por el frontend",
        description: "Mismo camino de verificación que /auth/google/callback, sin redirecciones ni PKCE.",
        tags: ["auth"],
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: GoogleIdTokenRequestSchema,
                    example: { id_token: "eyJhbGciOiJSUzI1NiIsImtpZCI6..." },
                },
            },
        },
        responses: {
            "200": {
                description: "Tokens emitidos.",
                content: {
                    "application/json": {
                        schema: TokenResponseSchema,
                        example: { access_token: "eyJhbGciOiJIUzI1NiJ9...", token_type: "Bearer", expires_in: 900, refresh_token: "kUyRts-..." },
                    },
                },
            },
            "401": { description: "id_token inválido o email no verificado." },
            "403": { description: "No existe usuario ni invitación válida para ese email." },
        },
    },
});

