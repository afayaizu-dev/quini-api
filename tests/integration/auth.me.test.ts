import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createUser, authHeader, expiredToken, tokenSignedWithOtherKey, tokenWithWrongAudience } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

describe("GET /api/v1/auth/me", () => {
    test("sin cabecera Authorization -> 401", async () => {
        const response = await request(app).get("/api/v1/auth/me");

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("UNAUTHORIZED");
    });

    test("Bearer basura -> 401", async () => {
        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", "Bearer esto-no-es-un-jwt");

        expect(response.status).toBe(401);
    });

    test("token expirado -> 401", async () => {
        const user = await createUser();
        const token = await expiredToken(user);

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(401);
    });

    test("token firmado con otra clave -> 401", async () => {
        const user = await createUser();
        const token = await tokenSignedWithOtherKey(user);

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(401);
    });

    test("token con audiencia incorrecta -> 401", async () => {
        const user = await createUser();
        const token = await tokenWithWrongAudience(user);

        const response = await request(app)
            .get("/api/v1/auth/me")
            .set("Authorization", `Bearer ${token}`);

        expect(response.status).toBe(401);
    });

    test("token válido -> 200 con el payload del token", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).get("/api/v1/auth/me").set(header);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        expectMatchesOpenApiSchema({ path: "/auth/me", method: "get", status: 200, body: response.body });
    });
});