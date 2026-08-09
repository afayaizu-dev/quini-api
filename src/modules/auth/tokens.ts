import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../../config/env.js";

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenSubject {
    id: string;
    email: string;
    role: string;
}

export interface AccessTokenPayload {
    userId: string;
    email: string;
    role: string;
}

export async function signAccessToken(user: AccessTokenSubject): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(env.ACCESS_TOKEN_TTL)
        .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    const { payload } = await jwtVerify<{ email: string; role: string }>(token, secret, {
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
        algorithms: ["HS256"],
    });

    if (typeof payload.sub !== "string") {
        throw new Error("Access token sin 'sub'.");
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
}

export function newRefreshToken(): string {
    return randomBytes(32).toString("base64url");
}

export function hashRefresh(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}