import { and, eq, isNull } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { refreshTokens } from "../../db/schema/refresh-tokens.js";
import { users } from "../../db/schema/users.js";

export async function findUserByEmail(email: string) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
}

export async function findUserById(id: string) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
}

export async function hasAdmin(): Promise<boolean> {
    const [admin] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.role, "admin"))
        .limit(1);
    return admin !== undefined;
}

interface CreateUserInput {
    email: string;
    passwordHash: string | null;
    nombre: string;
    role: "user" | "admin";
}

export async function createUser(input: CreateUserInput, tx: DbOrTx = db) {
    const [user] = await tx.insert(users).values(input).returning();
    if (!user) throw new Error("createUser: insert no devolvió ninguna fila");
    return user;
}

interface CreateRefreshTokenInput {
    userId: string;
    tokenHash: string;
    familyId: string;
    expiresAt: Date;
    userAgent?: string;
    ip?: string;
}

export async function createRefreshToken(input: CreateRefreshTokenInput) {
    const [token] = await db.insert(refreshTokens).values(input).returning();
    return token;
}

export async function findRefreshTokenByHash(tokenHash: string) {
    const [token] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    return token;
}

export async function revokeRefreshToken(id: string) {
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, id));
}

export async function revokeFamily(familyId: string) {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllUserTokens(userId: string) {
    await db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}