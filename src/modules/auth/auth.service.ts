import { randomBytes, randomUUID } from "node:crypto";
import { env } from "../../config/env.js";
import { RegistrationNotAllowedError, UnauthorizedError } from "../../core/errors.js";
import {
    createOAuthAccount,
    createRefreshToken,
    createUser,
    findOAuthAccount,
    findRefreshTokenByHash,
    findUserByEmail,
    findUserById,
    revokeAllUserTokens,
    revokeFamily,
    revokeRefreshToken,
} from "./auth.repository.js";
import type { TokenResponse } from "./auth.schemas.js";
import { consumeHandoffCode } from "./google-handoff.js";
import { hash, verify } from "./password.js";
import { hashRefresh, newRefreshToken, signAccessToken } from "./tokens.js";
import { parseTtlToMs } from "../../core/ttl.js";
import { db } from "../../db/index.js";
import * as invitationsService from "../invitations/invitations.service.js";

const DUMMY_PASSWORD_HASH = await hash(randomBytes(32).toString("hex"));

interface RequestMeta {
    userAgent?: string;
    ip?: string;
}


interface GoogleProfile {
    providerUserId: string;
    email: string;
    name: string;
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
    /* v8 ignore next -- @preserve */
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


export async function registerWithInvitation(
    input: { token: string; password: string; nombre: string },
    meta: RequestMeta,
): Promise<TokenResponse> {
    const passwordHash = await hash(input.password);

    const user = await db.transaction(async (tx) => {
        const invitation = await invitationsService.consume(input.token, tx);
        return createUser({ email: invitation.email, passwordHash, nombre: input.nombre, role: invitation.role }, tx);
    });

    return issueTokenPair(user, meta);
}


export async function loginWithGoogle(profile: GoogleProfile, meta: RequestMeta): Promise<TokenResponse> {
    const existingAccount = await findOAuthAccount("google", profile.providerUserId);
    if (existingAccount) {
        const user = await findUserById(existingAccount.userId);
        /* v8 ignore next -- @preserve */
        if (!user) throw new UnauthorizedError();
        return issueTokenPair(user, meta);
    }

    const existingUser = await findUserByEmail(profile.email);
    if (existingUser) {
        await createOAuthAccount({
            userId: existingUser.id,
            provider: "google",
            providerUserId: profile.providerUserId,
            email: profile.email,
        });
        return issueTokenPair(existingUser, meta);
    }

    const user = await db.transaction(async (tx) => {
        const invitation = await invitationsService.consumeByEmail(profile.email, tx);
        if (!invitation) {
            throw new RegistrationNotAllowedError();
        }

        const newUser = await createUser(
            { email: profile.email, passwordHash: null, nombre: profile.name, role: invitation.role },
            tx,
        );
        await createOAuthAccount(
            { userId: newUser.id, provider: "google", providerUserId: profile.providerUserId, email: profile.email },
            tx,
        );
        return newUser;
    });

    return issueTokenPair(user, meta);
}

export async function exchangeGoogleCode(code: string): Promise<TokenResponse> {
    const tokens = consumeHandoffCode(code);
    if (!tokens) {
        throw new UnauthorizedError("Código de login con Google inválido o caducado.");
    }
    return tokens;
}