import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../core/errors.js";
import {
    createRefreshToken,
    findRefreshTokenByHash,
    findUserByEmail,
    findUserById,
    revokeAllUserTokens,
    revokeFamily,
    revokeRefreshToken,
} from "./auth.repository.js";
import type { TokenResponse } from "./auth.schemas.js";
import { hash, verify } from "./password.js";
import { hashRefresh, newRefreshToken, signAccessToken } from "./tokens.js";

const DUMMY_PASSWORD_HASH = await hash(randomBytes(32).toString("hex"));

interface RequestMeta {
    userAgent?: string;
    ip?: string;
}

function parseTtlToMs(ttl: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
    if (!match) {
        throw new Error(`TTL con formato no soportado: "${ttl}"`);
    }
    const [, amount, unit] = match;
    const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
    return Number(amount) * unitMs;
}

async function issueTokenPair(
    user: { id: string; email: string; role: string },
    meta: RequestMeta,
    familyId: string = randomUUID(),
): Promise<TokenResponse> {
    const accessToken = await signAccessToken(user);
    const refreshToken = newRefreshToken();
    const expiresAt = new Date(Date.now() + parseTtlToMs(env.REFRESH_TOKEN_TTL));

    await createRefreshToken({
        userId: user.id,
        tokenHash: hashRefresh(refreshToken),
        familyId,
        expiresAt,
        ...(meta.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
        ...(meta.ip !== undefined ? { ip: meta.ip } : {}),
    });

    return {
        access_token: accessToken,
        token_type: "Bearer",
        expires_in: Math.floor(parseTtlToMs(env.ACCESS_TOKEN_TTL) / 1000),
        refresh_token: refreshToken,
    };
}

export async function loginWithPassword(
    email: string,
    password: string,
    meta: RequestMeta,
): Promise<TokenResponse> {
    const user = await findUserByEmail(email);

    if (!user || user.passwordHash === null) {
        await verify(DUMMY_PASSWORD_HASH, password);
        throw new UnauthorizedError();
    }

    const passwordOk = await verify(user.passwordHash, password);
    if (!passwordOk) {
        throw new UnauthorizedError();
    }

    return issueTokenPair(user, meta);
}

export async function refresh(refreshToken: string, meta: RequestMeta): Promise<TokenResponse> {
    const stored = await findRefreshTokenByHash(hashRefresh(refreshToken));

    if (!stored) {
        throw new UnauthorizedError();
    }

    if (stored.revokedAt !== null) {
        await revokeFamily(stored.familyId);
        throw new UnauthorizedError();
    }

    if (stored.expiresAt < new Date()) {
        throw new UnauthorizedError();
    }

    const user = await findUserById(stored.userId);
    if (!user) {
        throw new UnauthorizedError();
    }

    await revokeRefreshToken(stored.id);

    return issueTokenPair(user, meta, stored.familyId);
}

export async function revoke(refreshToken: string): Promise<void> {
    const stored = await findRefreshTokenByHash(hashRefresh(refreshToken));
    if (stored && stored.revokedAt === null) {
        await revokeRefreshToken(stored.id);
    }
}

export async function logoutAll(userId: string): Promise<void> {
    await revokeAllUserTokens(userId);
}