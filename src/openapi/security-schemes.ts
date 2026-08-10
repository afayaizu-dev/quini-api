import type { ZodOpenApiObject } from "zod-openapi";


type SecuritySchemes = NonNullable<NonNullable<ZodOpenApiObject["components"]>["securitySchemes"]>;

export const securitySchemes: SecuritySchemes = {
    bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
    },
    oauth2Password: {
        type: "oauth2",
        flows: {
            password: {
                tokenUrl: "/api/v1/auth/token",
                scopes: {},
            },
        },
    },
    oauth2Google: {
        type: "oauth2",
        flows: {
            authorizationCode: {
                authorizationUrl: "/api/v1/auth/google",
                tokenUrl: "/api/v1/auth/google/callback",
                scopes: {
                    openid: "Identificar al usuario",
                    email: "Leer el email",
                    profile: "Leer el nombre",
                },
            },
        },
    },
};
