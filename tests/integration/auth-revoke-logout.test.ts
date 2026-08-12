import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createUser, authHeader } from "../helpers/auth.js";

async function login(email: string, password: string) {
    const response = await request(app)
        .post("/api/v1/auth/token")
        .type("form")
        .send({ grant_type: "password", username: email, password });
    return response.body as { access_token: string; refresh_token: string };
}

describe("POST /api/v1/auth/revoke", () => {
    test("revoca un refresh token válido -> 204, y deja de servir para refrescar", async () => {
        const user = await createUser();
        const { refresh_token } = await login(user.email, user.password);
        const header = await authHeader(user);

        const revokeResponse = await request(app)
            .post("/api/v1/auth/revoke")
            .set(header)
            .send({ refresh_token });

        expect(revokeResponse.status).toBe(204);

        const refreshAttempt = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token });

        expect(refreshAttempt.status).toBe(401);
    });

    test("revocar un refresh token inexistente sigue devolviendo 204 (no revela si existía)", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .post("/api/v1/auth/revoke")
            .set(header)
            .send({ refresh_token: "esto-nunca-se-emitio" });

        expect(response.status).toBe(204);
    });

    test("revocar un refresh token ya revocado sigue devolviendo 204 (idempotente)", async () => {
        const user = await createUser();
        const { refresh_token } = await login(user.email, user.password);
        const header = await authHeader(user);

        await request(app).post("/api/v1/auth/revoke").set(header).send({ refresh_token });

        const secondRevoke = await request(app)
            .post("/api/v1/auth/revoke")
            .set(header)
            .send({ refresh_token });

        expect(secondRevoke.status).toBe(204);
    });
});

describe("POST /api/v1/auth/logout", () => {
    test("revoca todos los refresh tokens del usuario -> 204", async () => {
        const user = await createUser();
        const { refresh_token: refreshTokenA } = await login(user.email, user.password);
        const { refresh_token: refreshTokenB } = await login(user.email, user.password);
        const header = await authHeader(user);

        const logoutResponse = await request(app).post("/api/v1/auth/logout").set(header);
        expect(logoutResponse.status).toBe(204);

        const attemptA = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshTokenA });
        const attemptB = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshTokenB });

        expect(attemptA.status).toBe(401);
        expect(attemptB.status).toBe(401);
    });
});
