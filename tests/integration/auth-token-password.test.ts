import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createUser } from "../helpers/auth.js";
import { createUser as createUserInDb } from "../../src/modules/auth/auth.repository.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

describe("POST /api/v1/auth/token (grant_type=password)", () => {
    test("credenciales correctas -> 200 con tokens", async () => {
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .set("User-Agent", "vitest-test-agent")
            .send({ grant_type: "password", username: user.email, password: user.password });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ token_type: "Bearer" });
        expect(typeof response.body.access_token).toBe("string");
        expect(typeof response.body.refresh_token).toBe("string");
        expectMatchesOpenApiSchema({ path: "/auth/token", method: "post", status: 200, body: response.body });
    });

    test("contraseña incorrecta -> 401", async () => {
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "password", username: user.email, password: "esta-no-es-la-contraseña" });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("UNAUTHORIZED");
    });

    test("email no registrado -> 401 (mismo error que contraseña incorrecta)", async () => {
        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "password", username: "no-existe@test.local", password: "cualquier-cosa-123456" });

        expect(response.status).toBe(401);
        expect(response.body.error).toBe("UNAUTHORIZED");
    });

    test("usuario registrado solo por Google intenta login con contraseña -> 401", async () => {
        const user = await createUserInDb({
            email: "google-only@test.local",
            passwordHash: null,
            nombre: "Solo Google",
            role: "user",
        });

        const response = await request(app)
            .post("/api/v1/auth/token")
            .type("form")
            .send({ grant_type: "password", username: user.email, password: "cualquier-cosa-123456" });

        expect(response.status).toBe(401);
    });
});