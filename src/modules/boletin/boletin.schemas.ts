import { z } from "zod";

export const EnviarBoletinSchema = z.object({
    subject: z.string().min(1).max(200),
    html: z.string().min(1),
});
export type EnviarBoletinInput = z.infer<typeof EnviarBoletinSchema>;

export const EnviarBoletinResponseSchema = z.object({
    enviados: z.number().int().nonnegative(),
    fallidos: z.array(z.email()),
});
export type EnviarBoletinResponse = z.infer<typeof EnviarBoletinResponseSchema>;
