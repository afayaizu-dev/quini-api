import { z } from "zod";
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";

const ORDEN_ESPERADO = Array.from({ length: 15 }, (_, i) => i + 1);

export const plenoAl15 = z.string().regex(/^[012M]-[012M]$/);

export const PartidoSchema = z.object({
    orden: z.number().int().min(1).max(15),
    equipoLocal: z.string().trim().min(1),
    equipoVisitante: z.string().trim().min(1),
});

export type PartidoInput = z.infer<typeof PartidoSchema>;

function ordenesCompletosYSinDuplicados(partidos: PartidoInput[]): boolean {
    const ordenes = new Set(partidos.map((p) => p.orden));
    if (ordenes.size !== partidos.length) return false;
    return ORDEN_ESPERADO.every((n) => ordenes.has(n));
}

export const CreateJornadaSchema = z
    .object({
        temporada: codigoTemporada.optional(),
        numeroJornada: z.number().int().positive(),
        fecha: z.iso.date(),
        partidos: z.array(PartidoSchema).length(15),
    })
    .refine((data) => ordenesCompletosYSinDuplicados(data.partidos), {
        message: "Los 15 partidos deben tener 'orden' de 1 a 15, sin duplicados ni huecos.",
        path: ["partidos"],
    });

export type CreateJornadaInput = z.infer<typeof CreateJornadaSchema>;

export const UpdateJornadaSchema = z
    .object({
        fecha: z.iso.date(),
        partidos: z.array(PartidoSchema).length(15),
    })
    .refine((data) => ordenesCompletosYSinDuplicados(data.partidos), {
        message: "Los 15 partidos deben tener 'orden' de 1 a 15, sin duplicados ni huecos.",
        path: ["partidos"],
    });

export type UpdateJornadaInput = z.infer<typeof UpdateJornadaSchema>;

export const JornadaNumeroParamSchema = z.object({
    numeroJornada: z.coerce.number().int().positive(),
});

export type JornadaNumeroParam = z.infer<typeof JornadaNumeroParamSchema>;

export const JornadaQuerySchema = z.object({
    temporada: codigoTemporada.optional(),
});

export type JornadaQuery = z.infer<typeof JornadaQuerySchema>;

export const FechasJornadaSchema = z
    .object({
        fechaAperturaApuestas: z.iso.datetime().nullable(),
        fechaCierreApuestas: z.iso.datetime().nullable(),
        fechaCierreJornada: z.iso.datetime().nullable(),
    })
    .refine(
        (data) =>
            data.fechaAperturaApuestas === null ||
            data.fechaCierreApuestas === null ||
            new Date(data.fechaCierreApuestas) > new Date(data.fechaAperturaApuestas),
        {
            message: "fechaCierreApuestas debe ser posterior a fechaAperturaApuestas.",
            path: ["fechaCierreApuestas"],
        },
    );

export type FechasJornadaInput = z.infer<typeof FechasJornadaSchema>;

export const PlenoJornadaSchema = z.object({
    apuestaPleno15: plenoAl15,
});

export type PlenoJornadaInput = z.infer<typeof PlenoJornadaSchema>;


export const PartidoResponseSchema = z.object({
    id: z.uuid(),
    orden: z.number(),
    equipoLocalId: z.uuid(),
    equipoVisitanteId: z.uuid(),
});

export const JornadaResponseSchema = z.object({
    id: z.uuid(),
    temporada: z.string(),
    numeroJornada: z.number(),
    fecha: z.iso.date(),
    fechaAperturaApuestas: z.iso.datetime().nullable(),
    fechaCierreApuestas: z.iso.datetime().nullable(),
    fechaCierreJornada: z.iso.datetime().nullable(),
    apuestaPleno15: plenoAl15.nullable(),
    apuestasAbiertas: z.boolean(),
    partidos: z.array(PartidoResponseSchema),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export type JornadaResponse = z.infer<typeof JornadaResponseSchema>;