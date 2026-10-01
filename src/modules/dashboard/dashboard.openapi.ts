

import { registerPath } from "../../openapi/registry.js";
import {
    DashboardMiembroResponseSchema,
    DashboardJornadaResponseSchema,
    DashboardTemporadaResponseSchema,
} from "./dashboard.schemas.js";

const temporadaQueryParam = {
    name: "temporada",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, pattern: "^\\d{4}-\\d{2}$" },
    example: "2026-27",
};

const usuarioQueryParam = {
    name: "usuario",
    in: "query" as const,
    required: false,
    schema: { type: "string" as const, format: "uuid" },
};

const jornadaQueryParam = {
    name: "jornada",
    in: "query" as const,
    required: true,
    schema: { type: "integer" as const, minimum: 1 },
    example: 1,
};

const miembroEjemplo = {
    usuarioId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    temporada: "2026-27",
    pagosTotales: 22.0,
    ingresosTotales: 50.0,
    credito: 28.0,
    mediaAciertos: 7.5,
    maxAciertos: 10,
    minAciertos: 4,
    maxPremio: 10.49,
    premiosTotales: 10.49,
    porcentajeApuestasPropias: 85.5,
};

const liquidacionEjemplo = {
    usuarioId: "019ff7eb-22ae-7b8c-a948-6ca9a14625e6",
    aciertosApuesta1: 8,
    aciertosApuesta2: 10,
    aciertosMax: 10,
    premioApuesta1: 0,
    premioApuesta2: 10.49,
    ranking: 1,
    escalon: 1,
    importeEscalon: 1.5,
    costeApuestas: 1.5,
    bote: 10.49,
};

const jornadaEjemplo = {
    jornada: 1,
    temporada: "2026-27",
    pagosJornada: 22.0,
    boteJornada: 17.49,
    boteJornadaAjustado: 140.94,
    premiosTotales: 10.49,
    mediaAciertosDosApuestas: 7.2,
    mediaAciertosMaximos: 8.4,
    clasificacion: [liquidacionEjemplo],
};

const temporadaEjemplo = {
    temporada: "2026-27",
    maxAciertos: 10,
    usuariosMaxAciertos: ["019ff7eb-22ae-7b8c-a948-6ca9a14625e6"],
    minAciertos: 4,
    usuariosMinAciertos: ["019ff7eb-9999-7b8c-a948-6ca9a14625e6"],
    premiosTotales: 10.49,
    pagosTotales: 22.0,
    boteTotal: 17.49,
    jornadasCalculadas: 1,
};

registerPath("/dashboard/miembro", {
    get: {
        operationId: "dashboardMiembro",
        summary: "Agregados de un miembro",
        description:
            "Sin '?usuario=', devuelve los datos del usuario autenticado. Cualquier usuario autenticado puede consultar los de cualquier miembro, como parte de la transparencia de la clasificación.",
        tags: ["dashboard"],
        security: [{ bearerAuth: [] }],
        parameters: [temporadaQueryParam, usuarioQueryParam],
        responses: {
            "200": {
                description: "Agregados del miembro en la temporada.",
                content: { "application/json": { schema: DashboardMiembroResponseSchema, example: miembroEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "Temporada o usuario inexistentes; o no hay temporada activa y no se especificó ninguna." },
        },
    },
});

registerPath("/dashboard/jornada", {
    get: {
        operationId: "dashboardJornada",
        summary: "Agregados y clasificación de una jornada",
        description:
            "Solo disponible una vez la jornada tiene un cálculo ejecutado (POST /calculos). 'boteJornada' es el bote generado solo en esta jornada; 'boteJornadaAjustado' es el bote acumulado de la temporada hasta esta jornada: ajustes con fecha <= fecha de la jornada (el bote heredado cuenta siempre) más el bote de las jornadas con número <= este. En la última jornada coincide con 'boteTotal' de /dashboard/temporada salvo ajustes posteriores a ella.",
        tags: ["dashboard"],
        security: [{ bearerAuth: [] }],
        parameters: [jornadaQueryParam, temporadaQueryParam],
        responses: {
            "200": {
                description: "Agregados de la jornada, con la clasificación ordenada por ranking.",
                content: { "application/json": { schema: DashboardJornadaResponseSchema, example: jornadaEjemplo } },
            },
            "400": { description: "'jornada' no es un entero positivo." },
            "401": { description: "Sin access token válido." },
            "404": { description: "Jornada o temporada inexistentes, o la jornada aún no tiene cálculo ejecutado." },
        },
    },
});

registerPath("/dashboard/temporada", {
    get: {
        operationId: "dashboardTemporada",
        summary: "Agregados de una temporada completa",
        description:
            "Máximos y mínimos de aciertos con quiénes los lograron (pueden ser varios), y los totales de premios, pagos y bote. 'boteTotal' = ajustes de bote de esta temporada (incluido el heredado) + bote de sus jornadas calculadas.",
        tags: ["dashboard"],
        security: [{ bearerAuth: [] }],
        parameters: [temporadaQueryParam],
        responses: {
            "200": {
                description: "Agregados de la temporada.",
                content: { "application/json": { schema: DashboardTemporadaResponseSchema, example: temporadaEjemplo } },
            },
            "401": { description: "Sin access token válido." },
            "404": { description: "No existe esa temporada, o no hay temporada activa y no se especificó ninguna." },
        },
    },
});