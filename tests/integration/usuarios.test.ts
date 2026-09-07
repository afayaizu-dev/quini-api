import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

describe("GET /api/v1/usuarios/me", () => {
    test("sin token -> 401", async () => {
        const response = await request(app).get("/api/v1/usuarios/me");
        expect(response.status).toBe(401);
    });

    test("con token -> 200 con el perfil", async () => {
        const user = await createUser({ nombre: "José" });
        const header = await authHeader(user);

        const response = await request(app).get("/api/v1/usuarios/me").set(header);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            id: user.id,
            email: user.email,
            nombre: "José",
            apellidos: null,
            apodo: null,
            telefono: null,
        });
        expectMatchesOpenApiSchema({ path: "/usuarios/me", method: "get", status: 200, body: response.body });
    });
});

describe("PUT /api/v1/usuarios/me", () => {
    test("actualización válida -> 200", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .put("/api/v1/usuarios/me")
            .set(header)
            .send({ apellidos: "Fernández López", apodo: "Jota", telefono: "600123456" });

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({
            apellidos: "Fernández López",
            apodo: "Jota",
            telefono: "600123456",
        });
        expectMatchesOpenApiSchema({ path: "/usuarios/me", method: "put", status: 200, body: response.body });
    });

    test("apodo de otro miembro -> 409", async () => {
        const otro = await createUser();
        await request(app).put("/api/v1/usuarios/me").set(await authHeader(otro)).send({ apodo: "Jota" });

        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/usuarios/me")
            .set(await authHeader(user))
            .send({ apodo: "Jota" });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("apodo en otra capitalización -> 409 (es citext)", async () => {
        const otro = await createUser();
        await request(app).put("/api/v1/usuarios/me").set(await authHeader(otro)).send({ apodo: "Jota" });

        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/usuarios/me")
            .set(await authHeader(user))
            .send({ apodo: "JOTA" });

        expect(response.status).toBe(409);
    });

    test("mandando role -> 400 (por .strict())", async () => {
        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/usuarios/me")
            .set(await authHeader(user))
            .send({ role: "admin" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("telefono en blanco -> 400", async () => {
        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/usuarios/me")
            .set(await authHeader(user))
            .send({ telefono: "  " });

        expect(response.status).toBe(400);
    });
});

describe("GET /api/v1/usuarios", () => {
    test("sin token -> 401", async () => {
        const response = await request(app).get("/api/v1/usuarios");
        expect(response.status).toBe(401);
    });

    test("como user -> 200", async () => {
        const user = await createUser();
        const response = await request(app).get("/api/v1/usuarios").set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expectMatchesOpenApiSchema({ path: "/usuarios", method: "get", status: 200, body: response.body });
    });

    test("como admin -> 200", async () => {
        const admin = await createAdmin();
        const response = await request(app).get("/api/v1/usuarios").set(await authHeader(admin));

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expectMatchesOpenApiSchema({ path: "/usuarios", method: "get", status: 200, body: response.body });
    });
});

describe("GET /api/v1/usuarios/:id", () => {
    test("inexistente (admin) -> 404", async () => {
        const admin = await createAdmin();
        const response = await request(app)
            .get("/api/v1/usuarios/00000000-0000-0000-0000-000000000000")
            .set(await authHeader(admin));

        expect(response.status).toBe(404);
    });

    test("id no UUID -> 400", async () => {
        const admin = await createAdmin();
        const response = await request(app).get("/api/v1/usuarios/no-es-un-uuid").set(await authHeader(admin));

        expect(response.status).toBe(400);
    });

    test("existente (admin) -> 200", async () => {
        const admin = await createAdmin();
        const user = await createUser({ nombre: "Ana" });

        const response = await request(app).get(`/api/v1/usuarios/${user.id}`).set(await authHeader(admin));

        expect(response.status).toBe(200);
        expect(response.body.nombre).toBe("Ana");
        expectMatchesOpenApiSchema({ path: "/usuarios/{id}", method: "get", status: 200, body: response.body });
    });
});

describe("PUT /api/v1/usuarios/:id", () => {
    test("como user -> 403", async () => {
        const user = await createUser();
        const otro = await createUser();

        const response = await request(app)
            .put(`/api/v1/usuarios/${otro.id}`)
            .set(await authHeader(user))
            .send({ nombre: "No debería" });

        expect(response.status).toBe(403);
    });

    test("como admin -> 200", async () => {
        const admin = await createAdmin();
        const user = await createUser();

        const response = await request(app)
            .put(`/api/v1/usuarios/${user.id}`)
            .set(await authHeader(admin))
            .send({ nombre: "Actualizado por admin" });

        expect(response.status).toBe(200);
        expect(response.body.nombre).toBe("Actualizado por admin");
        expectMatchesOpenApiSchema({ path: "/usuarios/{id}", method: "put", status: 200, body: response.body });
    });

    test("inexistente (admin) -> 404", async () => {
        const admin = await createAdmin();

        const response = await request(app)
            .put("/api/v1/usuarios/00000000-0000-0000-0000-000000000000")
            .set(await authHeader(admin))
            .send({ nombre: "No existe" });

        expect(response.status).toBe(404);
    });
});

describe("passwordHash nunca se expone", () => {
    test("ninguna respuesta incluye passwordHash", async () => {
        const admin = await createAdmin();

        const me = await request(app).get("/api/v1/usuarios/me").set(await authHeader(admin));
        const lista = await request(app).get("/api/v1/usuarios").set(await authHeader(admin));

        expect(me.body.passwordHash).toBeUndefined();
        expect(me.body.password_hash).toBeUndefined();
        (lista.body as Record<string, unknown>[]).forEach((u) => {
            expect(u.passwordHash).toBeUndefined();
        });
    });
});