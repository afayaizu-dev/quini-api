import { z } from "zod";
import { importeEuros } from "../resultados/resultados.schemas.js";
import { codigoTemporada } from "../temporadas/temporadas.schemas.js";

export const CreatePagoSchema = z
    .object({
        usuarioId: z.uuid(),
        importe: importeEuros.refine((v) => v > 0, "El importe debe ser mayor que 0."),
        fechaPago: z.iso.date(),
    })
    .strict();

export type CreatePagoInput = z.infer<typeof CreatePagoSchema>;

export const PagosQuerySchema = z.object({
    usuario: z.uuid().optional(),
    temporada: codigoTemporada.optional(),
    desde: z.iso.date().optional(),
    hasta: z.iso.date().optional(),
});

export type PagosQuery = z.infer<typeof PagosQuerySchema>;

export const PagoIdParamSchema = z.object({
    id: z.uuid(),
});

export type PagoIdParam = z.infer<typeof PagoIdParamSchema>;

export const PagoResponseSchema = z.object({
    id: z.uuid(),
    usuarioId: z.uuid(),
    importe: importeEuros,
    fechaPago: z.iso.date(),
    registradoPor: z.uuid(),
    createdAt: z.iso.datetime(),
});

export type PagoResponse = z.infer<typeof PagoResponseSchema>;