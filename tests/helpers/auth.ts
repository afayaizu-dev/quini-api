import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import request from "supertest";
import { env } from "../../src/config/env.js";
import { createApp } from "../../src/app.js";
import { createUser as createUserInDb } from "../../src/modules/auth/auth.repository.js";
import { hash } from "../../src/modules/auth/password.js";
import { signAccessToken } from "../../src/modules/auth/tokens.js";

export const app = createApp();

interface TestUserOverrides {
    email?: string;
    password?: string;
    nombre?: string;
    role?: "user" | "admin";
}

export async function createUser(overrides: TestUserOverrides = {}) {
    const password = overrides.password ?? "TestPass123456";
    const passwordHash = await hash(password);

    const user = await createUserInDb({
        email: overrides.email ?? `user-${randomUUID()}@test.local`,
        passwordHash,
        nombre: overrides.nombre ?? "Test User",
        role: overrides.role ?? "user",
    });

    return { ...user, password };
}

export async function createAdmin(overrides: Omit<TestUserOverrides, "role"> = {}) {
    return createUser({ ...overrides, role: "admin" });
}

export async function authHeader(user: { id: string; email: string; role: string }): Promise<{ Authorization: string }> {
    const token = await signAccessToken(user);
    return { Authorization: `Bearer ${token}` };
}

export async function loginAs(email: string, password: string) {
    const response = await request(app)
        .post("/api/v1/auth/token")
        .type("form")
        .send({ grant_type: "password", username: email, password });

    return response.body;
}

const secret = new TextEncoder().encode(env.JWT_SECRET);

export async function expiredToken(user: { id: string; email: string; role: string }): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
        .sign(secret);
}

export async function tokenSignedWithOtherKey(user: { id: string; email: string; role: string }): Promise<string> {
    const otherSecret = new TextEncoder().encode("clave-de-otro-servicio-que-nada-tiene-que-ver-12345");
    return new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(otherSecret);
}

export async function tokenWithWrongAudience(user: { id: string; email: string; role: string }): Promise<string> {
    return new SignJWT({ email: user.email, role: user.role })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(env.JWT_ISSUER)
        .setAudience("una-audiencia-que-no-es-la-nuestra")
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(secret);
}