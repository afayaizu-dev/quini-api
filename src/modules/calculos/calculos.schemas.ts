import { z } from "zod";
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";
import { importeEuros } from "../resultados/resultados.schemas.js";

export const EjecutarCalculoSchema = z.object({
    jornada: z.number().int().positive(),
    temporada: codigoTemporada.optional(),
});

export type EjecutarCalculoInput = z.infer<typeof EjecutarCalculoSchema>;

export const CalculoQuerySchema = z.object({
    jornada: z.coerce.number().int().positive(),
    temporada: codigoTemporada.optional(),
});

export type CalculoQuery = z.infer<typeof CalculoQuerySchema>;

export const LiquidacionMiembroResponseSchema = z.object({
    usuarioId: z.uuid(),
    aciertosApuesta1: z.number().int().min(0).max(14).nullable(),
    aciertosApuesta2: z.number().int().min(0).max(14).nullable(),
    aciertosMax: z.number().int().min(0).max(14),
    premioApuesta1: importeEuros,
    premioApuesta2: importeEuros,
    ranking: z.number().int().min(1),
    escalon: z.number().int().min(1).max(10),
    importeEscalon: importeEuros,
    costeApuestas: importeEuros,
    bote: importeEuros,
});

export const CalculoResponseSchema = z.object({
    jornada: z.number().int(),
    temporada: z.string(),
    miembros: z.array(LiquidacionMiembroResponseSchema),
    boteTotal: importeEuros,
    premiosTotal: importeEuros,
    costeTotal: importeEuros,
});

export type CalculoResponse = z.infer<typeof CalculoResponseSchema>;