import { registerPath } from "../../openapi/registry.js";
import { EnviarBoletinSchema, EnviarBoletinResponseSchema } from "./boletin.schemas.js";

registerPath("/boletin/enviar", {
    post: {
        operationId: "boletinEnviar",
        summary: "Envía el boletín de la jornada a todos los socios",
        description:
            "Solo un admin puede disparar el envío. El HTML ya viene renderizado por el cliente; este endpoint solo lo reenvía por correo a cada socio registrado.",
        tags: ["boletin"],
        security: [{ bearerAuth: [] }],
        "x-required-role": "admin",
        requestBody: {
            required: true,
            content: {
                "application/json": {
                    schema: EnviarBoletinSchema,
                    example: { subject: "Boletín — Jornada 6", html: "<p>Resumen de la jornada 6...</p>" },
                },
            },
        },
        responses: {
            "200": {
                description: "Envío procesado (puede incluir fallos individuales sin que el endpoint falle).",
                content: {
                    "application/json": {
                        schema: EnviarBoletinResponseSchema,
                        example: { enviados: 9, fallidos: [] },
                    },
                },
            },
            "400": { description: "El cuerpo de la petición no es válido." },
            "401": { description: "Sin access token válido." },
            "403": { description: "El usuario autenticado no es admin." },
        },
    },
});
