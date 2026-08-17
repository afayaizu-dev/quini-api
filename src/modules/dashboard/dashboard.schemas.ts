import { z } from "zod";
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";
import { importeEuros, importeConSigno } from "../resultados/resultados.schemas.js";
import { LiquidacionMiembroResponseSchema } from "../calculos/calculos.schemas.js";

export const DashboardMiembroQuerySchema = z.object({
    temporada: codigoTemporada.optional(),
    usuario: z.uuid().optional(),
});

export type DashboardMiembroQuery = z.infer<typeof DashboardMiembroQuerySchema>;

export const DashboardJornadaQuerySchema = z.object({
    jornada: z.coerce.number().int().positive(),
    temporada: codigoTemporada.optional(),
});

export type DashboardJornadaQuery = z.infer<typeof DashboardJornadaQuerySchema>;

export const DashboardTemporadaQuerySchema = z.object({
    temporada: codigoTemporada.optional(),
});

export type DashboardTemporadaQuery = z.infer<typeof DashboardTemporadaQuerySchema>;

export const DashboardMiembroResponseSchema = z.object({
    usuarioId: z.uuid(),
    temporada: z.string(),
    pagosTotales: importeEuros,
    ingresosTotales: importeEuros,
    credito: importeConSigno,
    mediaAciertos: z.number().min(0).max(14).nullable(),
    maxAciertos: z.number().int().min(0).max(14).nullable(),
    minAciertos: z.number().int().min(0).max(14).nullable(),
    maxPremio: importeEuros.nullable(),
    premiosTotales: importeEuros,
    porcentajeApuestasPropias: z.number().min(0).max(100),
});

export type DashboardMiembroResponse = z.infer<typeof DashboardMiembroResponseSchema>;

export const DashboardJornadaResponseSchema = z.object({
    jornada: z.number().int(),
    temporada: z.string(),
    pagosJornada: importeEuros,
    boteJornada: importeEuros,
    premiosTotales: importeEuros,
    mediaAciertosDosApuestas: z.number().min(0).max(14).nullable(),
    mediaAciertosMaximos: z.number().min(0).max(14).nullable(),
    clasificacion: z.array(LiquidacionMiembroResponseSchema),
});

export type DashboardJornadaResponse = z.infer<typeof DashboardJornadaResponseSchema>;

export const DashboardTemporadaResponseSchema = z.object({
    temporada: z.string(),
    maxAciertos: z.number().int().min(0).max(14).nullable(),
    usuariosMaxAciertos: z.array(z.uuid()),
    minAciertos: z.number().int().min(0).max(14).nullable(),
    usuariosMinAciertos: z.array(z.uuid()),
    premiosTotales: importeEuros,
    pagosTotales: importeEuros,
    boteTotal: importeEuros,
    jornadasCalculadas: z.number().int().min(0),
});