import { z } from "zod";
import { signoQuiniela, plenoAl15 } from "../resultados/resultados.schemas.js";

export { signoQuiniela, plenoAl15 };

export const CreateApuestaSchema = z
    .object({
        numeroApuesta: z.union([z.literal(1), z.literal(2)]),
        partidos: z.array(signoQuiniela).length(14),
        sugerenciaPleno15: plenoAl15.optional(),
        usuarioId: z.uuid().optional(),
    })
    .strict();

export type CreateApuestaInput = z.infer<typeof CreateApuestaSchema>;

export const UpdateApuestaSchema = z
    .object({
        partidos: z.array(signoQuiniela).length(14),
        sugerenciaPleno15: plenoAl15.optional(),
        usuarioId: z.uuid().optional(),
    })
    .strict();

export type UpdateApuestaInput = z.infer<typeof UpdateApuestaSchema>;

export const ApuestaNumeroParamSchema = z.object({
    numeroJornada: z.coerce.number().int().positive(),
    numeroApuesta: z.coerce.number().int().min(1).max(2),
});

export type ApuestaNumeroParam = z.infer<typeof ApuestaNumeroParamSchema>;

export const ApuestaResponseSchema = z.object({
    id: z.uuid(),
    numeroApuesta: z.union([z.literal(1), z.literal(2)]),
    partidos: z.array(signoQuiniela).length(14),
    sugerenciaPleno15: plenoAl15.nullable(),
    usuarioId: z.uuid(),
    creadaPorElMismo: z.boolean(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export type ApuestaResponse = z.infer<typeof ApuestaResponseSchema>;