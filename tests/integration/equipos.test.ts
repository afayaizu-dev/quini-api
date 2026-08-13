import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";
import { db } from "../../src/db/index.js";
import { jornadas, partidos } from "../../src/db/schema/jornadas.js";
import * as equiposService from "../../src/modules/equipos/equipos.service.js";

function equipoBody(overrides: Partial<{ nombreLargo: string; nombreCorto: string }> = {}) {
    return {
        nombreLargo: overrides.nombreLargo ?? "Real Madrid",
        nombreCorto: overrides.nombreCorto ?? "RM",
    };
}

describe("POST /api/v1/equipos", () => {
    test("equipo válido (admin) -> 201", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).post("/api/v1/equipos").set(header).send(equipoBody());

        expect(response.status).toBe(201);
        expect(response.body).toMatchObject({ nombreLargo: "Real Madrid", nombreCorto: "RM" });
        expectMatchesOpenApiSchema({ path: "/equipos", method: "post", status: 201, body: response.body });
    });

    test("nombreLargo duplicado (otra capitalización) -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        await request(app).post("/api/v1/equipos").set(header).send(equipoBody({ nombreLargo: "Real Madrid" }));
        const response = await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreLargo: "REAL MADRID", nombreCorto: "RMA" }));

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("nombreCorto en blanco -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreCorto: "   " }));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("como user -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).post("/api/v1/equipos").set(header).send(equipoBody());

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("FORBIDDEN");
    });
});

describe("GET /api/v1/equipos", () => {
    test("lista de equipos (user) -> 200", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await request(app).post("/api/v1/equipos").set(adminHeader).send(equipoBody());

        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).get("/api/v1/equipos").set(header);

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expectMatchesOpenApiSchema({ path: "/equipos", method: "get", status: 200, body: response.body });
    });
});

describe("GET /api/v1/equipos/:id", () => {
    test("equipo existente -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const created = await request(app).post("/api/v1/equipos").set(header).send(equipoBody());

        const response = await request(app).get(`/api/v1/equipos/${created.body.id}`).set(header);

        expect(response.status).toBe(200);
        expect(response.body.nombreLargo).toBe("Real Madrid");
        expectMatchesOpenApiSchema({ path: "/equipos/{id}", method: "get", status: 200, body: response.body });
    });

    test("equipo inexistente -> 404", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .get("/api/v1/equipos/00000000-0000-0000-0000-000000000000")
            .set(header);

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });
});

describe("PUT /api/v1/equipos/:id", () => {
    test("actualización válida (admin) -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const created = await request(app).post("/api/v1/equipos").set(header).send(equipoBody());

        const response = await request(app)
            .put(`/api/v1/equipos/${created.body.id}`)
            .set(header)
            .send({ nombreLargo: "Real Madrid CF", nombreCorto: "RMA" });

        expect(response.status).toBe(200);
        expect(response.body.nombreLargo).toBe("Real Madrid CF");
        expectMatchesOpenApiSchema({ path: "/equipos/{id}", method: "put", status: 200, body: response.body });
    });

    test("nombreLargo duplicado -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreLargo: "Barcelona", nombreCorto: "BAR" }));
        const created = await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreLargo: "Real Madrid" }));

        const response = await request(app)
            .put(`/api/v1/equipos/${created.body.id}`)
            .set(header)
            .send({ nombreLargo: "Barcelona", nombreCorto: "RM" });

        expect(response.status).toBe(409);
    });

    test("equipo inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .put("/api/v1/equipos/00000000-0000-0000-0000-000000000000")
            .set(header)
            .send({ nombreLargo: "No existe", nombreCorto: "NE" });

        expect(response.status).toBe(404);
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const created = await request(app).post("/api/v1/equipos").set(adminHeader).send(equipoBody());

        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app)
            .put(`/api/v1/equipos/${created.body.id}`)
            .set(header)
            .send({ nombreLargo: "No debería", nombreCorto: "ND" });

        expect(response.status).toBe(403);
    });
});

describe("DELETE /api/v1/equipos/:id", () => {
    test("equipo con partidos asociados -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const temporada = await request(app)
            .post("/api/v1/temporadas")
            .set(header)
            .send({ codigo: "2026-27", nombre: "Temporada 2026/27", fechaInicio: "2026-08-15", fechaFin: "2027-05-30" });

        const local = await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreLargo: "Real Madrid", nombreCorto: "RM" }));
        const visitante = await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send(equipoBody({ nombreLargo: "Barcelona", nombreCorto: "BAR" }));

        const [jornada] = await db
            .insert(jornadas)
            .values({
                temporadaId: temporada.body.id,
                numeroJornada: 1,
                fecha: "2026-08-20",
                createdBy: admin.id,
            })
            .returning();

        if (!jornada) throw new Error("No se pudo crear la jornada de prueba");

        await db.insert(partidos).values({
            jornadaId: jornada.id,
            orden: 1,
            equipoLocalId: local.body.id,
            equipoVisitanteId: visitante.body.id,
        });

        const response = await request(app).delete(`/api/v1/equipos/${local.body.id}`).set(header);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("equipo sin uso (admin) -> 204", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const created = await request(app).post("/api/v1/equipos").set(header).send(equipoBody());

        const response = await request(app).delete(`/api/v1/equipos/${created.body.id}`).set(header);

        expect(response.status).toBe(204);
    });
});

describe("resolveEquipo (unit, sin HTTP)", () => {
    test("equipo existente -> lo devuelve", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await request(app).post("/api/v1/equipos").set(header).send(equipoBody({ nombreLargo: "Real Madrid" }));

        const equipo = await equiposService.resolveEquipo("Real Madrid");

        expect(equipo.nombreLargo).toBe("Real Madrid");
    });

    test("equipo inexistente -> NotFoundError", async () => {
        await expect(equiposService.resolveEquipo("No existe")).rejects.toThrow("No existe el equipo 'No existe'.");
    });
});
