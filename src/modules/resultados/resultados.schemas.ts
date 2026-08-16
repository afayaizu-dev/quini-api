import { z } from "zod";
import { plenoAl15 } from "../jornadas/jornadas.schemas.js";

export { plenoAl15 };

export const signoQuiniela = z.enum(["1", "X", "2"]);

export const importeEuros = z
    .number()
    .nonnegative()
    .refine((v) => Number(v.toFixed(2)) === v, "Máximo 2 decimales.");

export const importeConSigno = z
    .number()
    .refine((v) => Number(v.toFixed(2)) === v, "Máximo 2 decimales.");

const PremiosSchema = z.object({
    "10": importeEuros,
    "11": importeEuros,
    "12": importeEuros,
    "13": importeEuros,
    "14": importeEuros,
    "15": importeEuros,
});

export const UpsertResultadosSchema = z.object({
    resultados: z.array(signoQuiniela).length(14),
    resultado15: plenoAl15,
    premios: PremiosSchema,
});

export type UpsertResultadosInput = z.infer<typeof UpsertResultadosSchema>;

export const ResultadosResponseSchema = z.object({
    id: z.uuid(),
    resultados: z.array(signoQuiniela).length(14),
    resultado15: plenoAl15,
    premios: PremiosSchema,
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
});

export type ResultadosResponse = z.infer<typeof ResultadosResponseSchema>;

