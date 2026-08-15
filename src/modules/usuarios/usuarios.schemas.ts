import { z } from "zod";

export const UpdatePerfilSchema = z
    .object({
        nombre: z.string().trim().min(1).optional(),
        apellidos: z.string().trim().min(1).optional(),
        apodo: z.string().trim().min(1).optional(),
        telefono: z.string().trim().min(1).optional(),
    })
    .strict();

export type UpdatePerfilInput = z.infer<typeof UpdatePerfilSchema>;

export const UsuarioIdParamSchema = z.object({
    id: z.uuid(),
});

export type UsuarioIdParam = z.infer<typeof UsuarioIdParamSchema>;

export const UsuarioResponseSchema = z.object({
    id: z.uuid(),
    email: z.email(),
    nombre: z.string(),
    apellidos: z.string().nullable(),
    apodo: z.string().nullable(),
    telefono: z.string().nullable(),
    role: z.enum(["user", "admin"]),
    createdAt: z.iso.datetime(),
});

export type UsuarioResponse = z.infer<typeof UsuarioResponseSchema>;
