import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env.js";
import { parseTtlToMs } from "../../core/ttl.js";
import { ConflictError, GoneError, NotFoundError } from "../../core/errors.js";
import { createInvitation, findInvitationByHash, markInvitationAccepted } from "./invitations.repository.js";
import { type DbOrTx } from "../../db/index.js";

export function newInvitationToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashInvitationToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

interface InvitationTicket {
    id: string;
    email: string;
    expiresAt: Date;
    token: string;
}

function isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export async function create(
    email: string,
    role: "user" | "admin",
    invitedBy: string,
): Promise<InvitationTicket> {
    const token = newInvitationToken();
    const expiresAt = new Date(Date.now() + parseTtlToMs(env.INVITATION_TTL));

    try {
        const invitation = await createInvitation({
            email,
            role,
            invitedBy,
            tokenHash: hashInvitationToken(token),
            expiresAt,
        });
        return { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt, token };
    } catch (err) {
        if (isUniqueViolation(err)) {
            throw new ConflictError("Ya existe una invitación pendiente para este email.");
        }
        throw err;
    }
}

interface InvitationDetails {
    email: string;
    role: "user" | "admin";
    expiresAt: Date;
}

function assertUsable(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }): void {
    if (invitation.acceptedAt !== null || invitation.revokedAt !== null || invitation.expiresAt < new Date()) {
        throw new GoneError("Esta invitación ya no es válida.");
    }
}

export async function validate(token: string): Promise<InvitationDetails> {
    const invitation = await findInvitationByHash(hashInvitationToken(token));

    if (!invitation) {
        throw new NotFoundError("Invitación no encontrada.");
    }
    assertUsable(invitation);

    return { email: invitation.email, role: invitation.role as "user" | "admin", expiresAt: invitation.expiresAt };
}

export async function consume(
    token: string,
    tx: DbOrTx,
): Promise<{ id: string; email: string; role: "user" | "admin" }> {
    const invitation = await findInvitationByHash(hashInvitationToken(token), tx);

    if (!invitation) {
        throw new NotFoundError("Invitación no encontrada.");
    }
    assertUsable(invitation);

    await markInvitationAccepted(invitation.id, tx);

    return { id: invitation.id, email: invitation.email, role: invitation.role as "user" | "admin" };
}