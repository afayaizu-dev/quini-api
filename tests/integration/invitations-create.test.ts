import { describe, expect, test } from "vitest";
import request from "supertest";
import {
    app,
    createUser,
    createAdmin,
    authHeader,
    expiredToken,
    tokenSignedWithOtherKey,
    tokenWithWrongAudience,
} from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

describe("POST /api/v1/invitaciones", () => {
    const validBody = { email: "invitado@test.local", role: "user" };

    test("sin cabecera Authorization -> 401", async () => {
        const response = await request(app).post("/api/v1/invitaciones").send(validBody);

        expect(response.status).toBe(401);
    });

    test("Bearer basura -> 401", async () => {
        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set("Authorization", "Bearer esto-no-es-un-jwt")
            .send(validBody);

        expect(response.status).toBe(401);
    });

    test("token expirado -> 401", async () => {
        const admin = await createAdmin();
        const token = await expiredToken(admin);

        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set("Authorization", `Bearer ${token}`)
            .send(validBody);

        expect(response.status).toBe(401);
    });

    test("token firmado con otra clave -> 401", async () => {
        const admin = await createAdmin();
        const token = await tokenSignedWithOtherKey(admin);

        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set("Authorization", `Bearer ${token}`)
            .send(validBody);

        expect(response.status).toBe(401);
    });

    test("token con audiencia incorrecta -> 401", async () => {
        const admin = await createAdmin();
        const token = await tokenWithWrongAudience(admin);

        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set("Authorization", `Bearer ${token}`)
            .send(validBody);

        expect(response.status).toBe(401);
    });

    test("token de user en endpoint de admin -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set(header)
            .send(validBody);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("FORBIDDEN");
    });

    test("token de admin correcto -> 201", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/invitaciones")
            .set(header)
            .send(validBody);

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ email: validBody.email });
        expectMatchesOpenApiSchema({ path: "/invitaciones", method: "post", status: 201, body: response.body });
    });
});