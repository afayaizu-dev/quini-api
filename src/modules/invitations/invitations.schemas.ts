import { z } from "zod";

export const CreateInvitationSchema = z.object({
    email: z.email(),
    role: z.enum(["user", "admin"]),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;

export const InvitationResponseSchema = z.object({
    id: z.uuid(),
    email: z.email(),
    expiresAt: z.iso.datetime(),
    url: z.url(),
});

export type InvitationResponse = z.infer<typeof InvitationResponseSchema>;
