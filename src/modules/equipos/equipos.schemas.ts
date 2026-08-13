import { z } from "zod";

export const CreateEquipoSchema = z.object({
    nombreLargo: z.string().trim().min(1),
    nombreCorto: z.string().trim().min(1),
});

export type CreateEquipoInput = z.infer<typeof CreateEquipoSchema>;

export const UpdateEquipoSchema = z.object({
    nombreLargo: z.string().trim().min(1),
    nombreCorto: z.string().trim().min(1),
});

export type UpdateEquipoInput = z.infer<typeof UpdateEquipoSchema>;

export const EquipoIdParamSchema = z.object({
    id: z.uuid(),
});

export type EquipoIdParam = z.infer<typeof EquipoIdParamSchema>;

export const EquipoResponseSchema = z.object({
    id: z.uuid(),
    nombreLargo: z.string(),
    nombreCorto: z.string(),
    createdAt: z.iso.datetime(),
});

export type EquipoResponse = z.infer<typeof EquipoResponseSchema>;
