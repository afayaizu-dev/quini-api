import { z } from "zod";

const CODIGO_TEMPORADA_REGEX = /^\d{4}-\d{2}$/;
const codigoTemporada = z.string().regex(
    CODIGO_TEMPORADA_REGEX,
    "El código debe tener el formato AAAA-AA (p. ej. 2026-27)",
);

export const CreateTemporadaSchema = z
    .object({
        codigo: codigoTemporada,
        nombre: z.string().trim().min(1),
        fechaInicio: z.iso.date(),
        fechaFin: z.iso.date(),
    })
    .refine((data) => data.fechaFin > data.fechaInicio, {
        message: "fechaFin debe ser posterior a fechaInicio",
        path: ["fechaFin"],
    });

export type CreateTemporadaInput = z.infer<typeof CreateTemporadaSchema>;

export const UpdateTemporadaSchema = z
    .object({
        nombre: z.string().trim().min(1),
        fechaInicio: z.iso.date(),
        fechaFin: z.iso.date(),
    })
    .refine((data) => data.fechaFin > data.fechaInicio, {
        message: "fechaFin debe ser posterior a fechaInicio",
        path: ["fechaFin"],
    });

export type UpdateTemporadaInput = z.infer<typeof UpdateTemporadaSchema>;

export const TemporadaCodigoParamSchema = z.object({
    codigo: codigoTemporada,
});

export type TemporadaCodigoParam = z.infer<typeof TemporadaCodigoParamSchema>;

export const TemporadaResponseSchema = z.object({
    id: z.uuid(),
    codigo: z.string(),
    nombre: z.string(),
    fechaInicio: z.iso.date(),
    fechaFin: z.iso.date(),
    activa: z.boolean(),
    createdAt: z.iso.datetime(),
});

export type TemporadaResponse = z.infer<typeof TemporadaResponseSchema>;
