import { randomUUID } from "node:crypto";
import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createUser } from "../helpers/auth.js";
import { createRefreshToken } from "../../src/modules/auth/auth.repository.js";
import { hashRefresh, newRefreshToken } from "../../src/modules/auth/tokens.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

async function loginAndGetRefreshToken(email: string, password: string): Promise<string> {
    const response = await request(app)
        .post("/api/v1/auth/token")
        .type("form")
        .send({ grant_type: "password", username: email, password });
    return response.body.refresh_token;
}

describe("POST /api/v1/auth/token (grant_type=refresh_token)", () => {
    test("refresh token válido -> 200 con un par nuevo, y el usado queda invalidado", async () => {
        const user = await createUser();
        const refreshToken1 = await loginAndGetRefreshToken(user.email, user.password);

        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken1 });

        expect(response.status).toBe(200);
        expect(typeof response.body.refresh_token).toBe("string");
        expect(response.body.refresh_token).not.toBe(refreshToken1);
        expectMatchesOpenApiSchema({ path: "/auth/token", method: "post", status: 200, body: response.body });

        const reuseResponse = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken1 });

        expect(reuseResponse.status).toBe(401);
    });

    test("refresh token desconocido -> 401", async () => {
        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: "un-token-que-nunca-se-emitio" });

        expect(response.status).toBe(401);
    });

    test("refresh token expirado -> 401", async () => {
        const user = await createUser();
        const refreshToken = newRefreshToken();

        await createRefreshToken({
            userId: user.id,
            tokenHash: hashRefresh(refreshToken),
            familyId: randomUUID(),
            expiresAt: new Date(Date.now() - 1000),
        });

        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken });

        expect(response.status).toBe(401);
    });

    test("reusar un refresh token ya usado revoca toda la familia", async () => {
        const user = await createUser();
        const refreshToken1 = await loginAndGetRefreshToken(user.email, user.password);

        const firstRefresh = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken1 });

        const refreshToken2 = firstRefresh.body.refresh_token as string;

        await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken1 });

        const responseWithToken2 = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "refresh_token", refresh_token: refreshToken2 });

        expect(responseWithToken2.status).toBe(401);
    });
});