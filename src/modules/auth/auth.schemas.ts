import { z } from "zod";

export const TokenRequestSchema = z.discriminatedUnion("grant_type", [
    z.object({
        grant_type: z.literal("password"),
        username: z.string().trim().min(1),
        password: z.string().min(1),
    }),
    z.object({
        grant_type: z.literal("refresh_token"),
        refresh_token: z.string().min(1),
    }),
]);

export type TokenRequest = z.infer<typeof TokenRequestSchema>;

export const TokenResponseSchema = z.object({
    access_token: z.string(),
    token_type: z.literal("Bearer"),
    expires_in: z.number().int().positive(),
    refresh_token: z.string(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const RevokeRequestSchema = z.object({
    refresh_token: z.string().min(1),
});

export type RevokeRequest = z.infer<typeof RevokeRequestSchema>;


export const RegisterRequestSchema = z.object({
    token: z.string().min(1),
    password: z.string().min(12),
    nombre: z.string().trim().min(1),
});

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;