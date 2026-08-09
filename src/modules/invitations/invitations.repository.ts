import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { invitations } from "../../db/schema/invitations.js";

interface CreateInvitationInput {
    email: string;
    role: "user" | "admin";
    tokenHash: string;
    invitedBy: string;
    expiresAt: Date;
}

export async function createInvitation(input: CreateInvitationInput) {
    const [invitation] = await db.insert(invitations).values(input).returning();
    if (!invitation) throw new Error("createInvitation: insert no devolvió ninguna fila");
    return invitation;
}

export async function findInvitationByHash(tokenHash: string, tx: DbOrTx = db) {
    const [invitation] = await tx.select().from(invitations).where(eq(invitations.tokenHash, tokenHash));
    return invitation;
}

export async function markInvitationAccepted(id: string, tx: DbOrTx = db): Promise<void> {
    await tx.update(invitations).set({ acceptedAt: new Date() }).where(eq(invitations.id, id));
}