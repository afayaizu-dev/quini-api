import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { db } from "../../src/db/index.js";
import { jornadas } from "../../src/db/schema/jornadas.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";
import * as temporadasService from "../../src/modules/temporadas/temporadas.service.js";

function temporadaBody(overrides: Partial<{ codigo: string; nombre: string; fechaInicio: string; fechaFin: string }> = {}) {
    return {
        codigo: overrides.codigo ?? "2026-27",
        nombre: overrides.nombre ?? "Temporada 2026/27",
        fechaInicio: overrides.fechaInicio ?? "2026-08-15",
        fechaFin: overrides.fechaFin ?? "2027-05-30",
    };
}

describe("POST /api/v1/temporadas", () => {
    test("temporada válida (admin) -> 201", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ codigo: "2026-27", activa: false });
        expectMatchesOpenApiSchema({ path: "/temporadas", method: "post", status: 201, body: response.body });
    });

    test("código duplicado -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());
        const response = await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("código con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/temporadas")
            .set(header)
            .send(temporadaBody({ codigo: "2026/27" }));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("fechaFin anterior a fechaInicio -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/temporadas")
            .set(header)
            .send(temporadaBody({ fechaInicio: "2027-05-30", fechaFin: "2026-08-15" }));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("como user -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("FORBIDDEN");
    });
});

describe("POST /api/v1/temporadas/:codigo/activar", () => {
    test("activar otra temporada deja solo una con activa=true", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody({ codigo: "2025-26" }));
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody({ codigo: "2026-27" }));

        const activateFirst = await request(app).post("/api/v1/temporadas/2025-26/activar").set(header);
        expect(activateFirst.status).toBe(200);
        expect(activateFirst.body.activa).toBe(true);

        const activateSecond = await request(app).post("/api/v1/temporadas/2026-27/activar").set(header);
        expect(activateSecond.status).toBe(200);
        expect(activateSecond.body.activa).toBe(true);

        const list = await request(app).get("/api/v1/temporadas").set(header);
        const activas = (list.body as Array<{ codigo: string; activa: boolean }>).filter((t) => t.activa);

        expect(activas).toHaveLength(1);
        expect(activas[0]?.codigo).toBe("2026-27");
        expectMatchesOpenApiSchema({ path: "/temporadas/{codigo}/activar", method: "post", status: 200, body: activateSecond.body });
    });
});

describe("GET /api/v1/temporadas", () => {
    test("lista de temporadas (user) -> 200", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(adminHeader).send(temporadaBody());

        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).get("/api/v1/temporadas").set(header);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expectMatchesOpenApiSchema({ path: "/temporadas", method: "get", status: 200, body: response.body });
    });
});

describe("GET /api/v1/temporadas/:codigo", () => {
    test("temporada inexistente -> 404", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).get("/api/v1/temporadas/2099-00").set(header);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });

    test("temporada existente -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        const response = await request(app).get("/api/v1/temporadas/2026-27").set(header);

        expect(response.status).toBe(200);
        expect(response.body.codigo).toBe("2026-27");
        expectMatchesOpenApiSchema({ path: "/temporadas/{codigo}", method: "get", status: 200, body: response.body });
    });
});


describe("DELETE /api/v1/temporadas/:codigo", () => {
    test("temporada con jornadas asociadas -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const created = await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());
        const temporadaId = created.body.id as string;

        await db.insert(jornadas).values({
            temporadaId,
            numeroJornada: 1,
            fecha: "2026-08-20",
            createdBy: admin.id,
        });

        const response = await request(app).delete(`/api/v1/temporadas/${temporadaBody().codigo}`).set(header);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("temporada vacía (admin) -> 204", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        const response = await request(app).delete(`/api/v1/temporadas/${temporadaBody().codigo}`).set(header);

        expect(response.status).toBe(204);
    });
});


describe("PUT /api/v1/temporadas/:codigo", () => {
    test("actualización válida (admin) -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        const response = await request(app)
            .put("/api/v1/temporadas/2026-27")
            .set(header)
            .send({ nombre: "Temporada 2026/27 (revisada)", fechaInicio: "2026-08-15", fechaFin: "2027-06-15" });

        expect(response.status).toBe(200);
        expect(response.body.nombre).toBe("Temporada 2026/27 (revisada)");
        expectMatchesOpenApiSchema({ path: "/temporadas/{codigo}", method: "put", status: 200, body: response.body });
    });

    test("fechaFin anterior a fechaInicio -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        const response = await request(app)
            .put("/api/v1/temporadas/2026-27")
            .set(header)
            .send({ nombre: "Temporada 2026/27", fechaInicio: "2027-06-15", fechaFin: "2026-08-15" });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("temporada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .put("/api/v1/temporadas/2099-00")
            .set(header)
            .send({ nombre: "No existe", fechaInicio: "2026-08-15", fechaFin: "2027-06-15" });

        expect(response.status).toBe(404);
    });

    test("como user -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .put("/api/v1/temporadas/2026-27")
            .set(header)
            .send({ nombre: "No debería poder", fechaInicio: "2026-08-15", fechaFin: "2027-06-15" });

        expect(response.status).toBe(403);
    });
});


describe("resolveTemporada sin código (unit, sin HTTP)", () => {
    test("hay una temporada activa -> la devuelve", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());
        await request(app).post("/api/v1/temporadas/2026-27/activar").set(header);

        const temporada = await temporadasService.resolveTemporada();

        expect(temporada.codigo).toBe("2026-27");
    });

    test("no hay ninguna temporada activa -> NotFoundError", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/temporadas").set(header).send(temporadaBody());

        await expect(temporadasService.resolveTemporada()).rejects.toThrow("No hay ninguna temporada activa.");
    });
});