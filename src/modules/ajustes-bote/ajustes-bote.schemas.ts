import { z } from "zod";
import { importeConSigno } from "../resultados/resultados.schemas.js";
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";

export const CreateAjusteBoteSchema = z
    .object({
        importe: importeConSigno,
        motivo: z.string().min(1, "El motivo no puede estar vacío."),
        fecha: z.iso.date(),
        temporada: codigoTemporada.optional(),
    })
    .strict();

export type CreateAjusteBoteInput = z.infer<typeof CreateAjusteBoteSchema>;

export const AjusteBoteIdParamSchema = z.object({
    id: z.uuid(),
});

export type AjusteBoteIdParam = z.infer<typeof AjusteBoteIdParamSchema>;

export const AjustesBoteQuerySchema = z.object({
    temporada: codigoTemporada.optional(),
});

export type AjustesBoteQuery = z.infer<typeof AjustesBoteQuerySchema>;

export const AjusteBoteResponseSchema = z.object({
    id: z.uuid(),
    temporadaId: z.uuid(),
    origenTemporadaId: z.uuid().nullable(),
    importe: importeConSigno,
    motivo: z.string(),
    fecha: z.iso.date(),
    registradoPor: z.uuid(),
    createdAt: z.iso.datetime(),
});

export type AjusteBoteResponse = z.infer<typeof AjusteBoteResponseSchema>;
