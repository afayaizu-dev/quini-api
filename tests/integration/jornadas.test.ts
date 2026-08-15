import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader, expiredToken } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";
import * as jornadasService from "../../src/modules/jornadas/jornadas.service.js";

const NOMBRES_EQUIPOS = ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal"];

async function crearJornadaLista(header: Record<string, string>) {
    await crearEquipos(header);
    await crearTemporada(header, "2026-27");
    const creada = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());
    return creada.body as { numeroJornada: number };
}

async function crearEquipos(header: Record<string, string>) {
    for (const nombre of NOMBRES_EQUIPOS) {
        await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send({ nombreLargo: nombre, nombreCorto: nombre.slice(0, 3).toUpperCase() });
    }
}

function partidosValidos() {
    return Array.from({ length: 15 }, (_, i) => ({
        orden: i + 1,
        equipoLocal: NOMBRES_EQUIPOS[i % NOMBRES_EQUIPOS.length],
        equipoVisitante: NOMBRES_EQUIPOS[(i + 1) % NOMBRES_EQUIPOS.length],
    }));
}

async function crearTemporada(header: Record<string, string>, codigo: string, activar = true) {
    await request(app)
        .post("/api/v1/temporadas")
        .set(header)
        .send({ codigo, nombre: `Temporada ${codigo}`, fechaInicio: "2026-08-15", fechaFin: "2027-05-30" });
    if (activar) {
        await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
    }
}

function jornadaBody(
    overrides: { temporada?: string; numeroJornada?: number; fecha?: string; partidos?: unknown[] } = {},
) {
    return {
        ...(overrides.temporada !== undefined ? { temporada: overrides.temporada } : {}),
        numeroJornada: overrides.numeroJornada ?? 1,
        fecha: overrides.fecha ?? "2026-08-20",
        partidos: overrides.partidos ?? partidosValidos(),
    };
}

describe("POST /api/v1/jornadas", () => {
    test("jornada válida (admin) -> 201 + Location + 15 partidos", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe("/api/v1/jornadas/1");
        expect(typeof response.body.id).toBe("string");
        expect(response.body.temporada).toBe("2026-27");
        expect(response.body.partidos).toHaveLength(15);
        expectMatchesOpenApiSchema({ path: "/jornadas", method: "post", status: 201, body: response.body });
    });

    test("mismo numeroJornada en la misma temporada -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());
        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("mismo numeroJornada en otra temporada -> 201 (no colisiona)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27", true);
        await crearTemporada(header, "2025-26", false);

        const primera = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());
        expect(primera.status).toBe(201);

        const segunda = await request(app)
            .post("/api/v1/jornadas")
            .set(header)
            .send(jornadaBody({ temporada: "2025-26" }));

        expect(segunda.status).toBe(201);
    });

    test("14 partidos -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .post("/api/v1/jornadas")
            .set(header)
            .send(jornadaBody({ partidos: partidosValidos().slice(0, 14) }));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("16 partidos -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const extra = [...partidosValidos(), { orden: 15, equipoLocal: "Real Madrid", equipoVisitante: "Barcelona" }];
        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ partidos: extra }));

        expect(response.status).toBe(400);
    });

    test("orden duplicado -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");


        const partidos = partidosValidos().map((p, i) => (i === 1 ? { ...p, orden: 1 } : p));

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ partidos }));

        expect(response.status).toBe(400);
    });

    test("hueco en orden -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const partidos = partidosValidos().map((p, i) => (i === 14 ? { ...p, orden: 16 } : p));

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ partidos }));

        expect(response.status).toBe(400);
    });

    test("equipoLocal en blanco -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const partidos = partidosValidos().map((p, i) => (i === 0 ? { ...p, equipoLocal: "   " } : p));

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ partidos }));

        expect(response.status).toBe(400);
    });

    test("equipoLocal que no existe en el catálogo -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const partidos = partidosValidos().map((p, i) => (i === 0 ? { ...p, equipoLocal: "Equipo Fantasma" } : p));

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ partidos }));

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });

    test("fecha con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .post("/api/v1/jornadas")
            .set(header)
            .send(jornadaBody({ fecha: "06-09-2026" }));

        expect(response.status).toBe(400);
    });

    test("numeroJornada 0 -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .post("/api/v1/jornadas")
            .set(header)
            .send(jornadaBody({ numeroJornada: 0 }));

        expect(response.status).toBe(400);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).post("/api/v1/jornadas").send(jornadaBody());
        expect(response.status).toBe(401);
    });

    test("token de user -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        expect(response.status).toBe(403);
    });

    test("sin temporada activa y sin temporada en el body -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27", false);

        const response = await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        expect(response.status).toBe(404);
    });

    test("token expirado -> 401", async () => {
        const admin = await createAdmin();
        const token = await expiredToken(admin);

        const response = await request(app)
            .post("/api/v1/jornadas")
            .set("Authorization", `Bearer ${token}`)
            .send(jornadaBody());

        expect(response.status).toBe(401);
    });
});

describe("GET /api/v1/jornadas", () => {
    test("lista (user) -> 200, solo la temporada activa, ordenada asc", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ numeroJornada: 2 }));
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ numeroJornada: 1 }));

        const user = await createUser();
        const userHeader = await authHeader(user);
        const response = await request(app).get("/api/v1/jornadas").set(userHeader);

        expect(response.status).toBe(200);
        expect(response.body.map((j: { numeroJornada: number }) => j.numeroJornada)).toEqual([1, 2]);
        expectMatchesOpenApiSchema({ path: "/jornadas", method: "get", status: 200, body: response.body });
    });

    test("lista ?temporada=2025-26 -> 200, solo esa temporada", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27", true);
        await crearTemporada(header, "2025-26", false);
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody({ temporada: "2025-26" }));

        const response = await request(app).get("/api/v1/jornadas?temporada=2025-26").set(header);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].temporada).toBe("2025-26");
    });
});

describe("GET /api/v1/jornadas/:numeroJornada", () => {
    test("existente -> 200, partidos ordenados 1..15", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        const response = await request(app).get("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(200);
        expect(response.body.partidos.map((p: { orden: number }) => p.orden)).toEqual(
            Array.from({ length: 15 }, (_, i) => i + 1),
        );
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app).get("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(404);
    });

    test("numeroJornada no numérico -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).get("/api/v1/jornadas/abc").set(header);

        expect(response.status).toBe(400);
    });
});

describe("PUT /api/v1/jornadas/:numeroJornada", () => {
    test("válido (admin) -> 200 con el recurso actualizado", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        const response = await request(app)
            .put("/api/v1/jornadas/1")
            .set(header)
            .send({ fecha: "2026-08-22", partidos: partidosValidos() });

        expect(response.status).toBe(200);
        expect(response.body.fecha).toBe("2026-08-22");
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}",
            method: "put",
            status: 200,
            body: response.body,
        });
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearEquipos(adminHeader);
        await crearTemporada(adminHeader, "2026-27");
        await request(app).post("/api/v1/jornadas").set(adminHeader).send(jornadaBody());

        const user = await createUser();
        const header = await authHeader(user);
        const response = await request(app)
            .put("/api/v1/jornadas/1")
            .set(header)
            .send({ fecha: "2026-08-22", partidos: partidosValidos() });

        expect(response.status).toBe(403);
    });

    test("inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .put("/api/v1/jornadas/1")
            .set(header)
            .send({ fecha: "2026-08-22", partidos: partidosValidos() });

        expect(response.status).toBe(404);
    });

    test("partidos inválidos -> 400 y la jornada original intacta", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        const partidosInvalidos = partidosValidos().slice(0, 14);
        const putResponse = await request(app)
            .put("/api/v1/jornadas/1")
            .set(header)
            .send({ fecha: "2026-08-22", partidos: partidosInvalidos });

        expect(putResponse.status).toBe(400);

        const getResponse = await request(app).get("/api/v1/jornadas/1").set(header);
        expect(getResponse.body.fecha).toBe("2026-08-20");
        expect(getResponse.body.partidos).toHaveLength(15);
    });
});

describe("DELETE /api/v1/jornadas/:numeroJornada", () => {
    test("existente (admin) -> 204, partidos borrados", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27");
        await request(app).post("/api/v1/jornadas").set(header).send(jornadaBody());

        const response = await request(app).delete("/api/v1/jornadas/1").set(header);
        expect(response.status).toBe(204);

        const getResponse = await request(app).get("/api/v1/jornadas/1").set(header);
        expect(getResponse.status).toBe(404);
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearEquipos(adminHeader);
        await crearTemporada(adminHeader, "2026-27");
        await request(app).post("/api/v1/jornadas").set(adminHeader).send(jornadaBody());

        const user = await createUser();
        const header = await authHeader(user);
        const response = await request(app).delete("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(403);
    });

    test("inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app).delete("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(404);
    });
});


test("temporada sin jornadas -> 200 con array vacío", async () => {
    const admin = await createAdmin();
    const header = await authHeader(admin);
    await crearTemporada(header, "2026-27");

    const response = await request(app).get("/api/v1/jornadas").set(header);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
});

describe("PUT /api/v1/jornadas/:numeroJornada/fechas", () => {
    test("fechas válidas (admin) -> 200 y apuestasAbiertas coherente", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2020-01-01T00:00:00Z",
                fechaCierreApuestas: "2099-01-01T00:00:00Z",
                fechaCierreJornada: null,
            });

        expect(response.status).toBe(200);
        expect(response.body.apuestasAbiertas).toBe(true);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/fechas",
            method: "put",
            status: 200,
            body: response.body,
        });
    });

    test("cierre anterior a la apertura -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2099-01-01T00:00:00Z",
                fechaCierreApuestas: "2020-01-01T00:00:00Z",
                fechaCierreJornada: null,
            });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("las 3 fechas a null -> 200, apuestasAbiertas: false", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({ fechaAperturaApuestas: null, fechaCierreApuestas: null, fechaCierreJornada: null });

        expect(response.status).toBe(200);
        expect(response.body.apuestasAbiertas).toBe(false);
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(await authHeader(user))
            .send({ fechaAperturaApuestas: null, fechaCierreApuestas: null, fechaCierreJornada: null });

        expect(response.status).toBe(403);
    });

    test("jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .put("/api/v1/jornadas/99/fechas")
            .set(header)
            .send({ fechaAperturaApuestas: null, fechaCierreApuestas: null, fechaCierreJornada: null });

        expect(response.status).toBe(404);
    });
});

describe("POST /api/v1/jornadas/:numeroJornada/cerrar-apuestas", () => {
    test("admin -> 200, apuestasAbiertas: false", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2020-01-01T00:00:00Z",
                fechaCierreApuestas: "2099-01-01T00:00:00Z",
                fechaCierreJornada: null,
            });

        const response = await request(app).post("/api/v1/jornadas/1/cerrar-apuestas").set(header);

        expect(response.status).toBe(200);
        expect(response.body.apuestasAbiertas).toBe(false);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/cerrar-apuestas",
            method: "post",
            status: 200,
            body: response.body,
        });
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const user = await createUser();
        const response = await request(app).post("/api/v1/jornadas/1/cerrar-apuestas").set(await authHeader(user));

        expect(response.status).toBe(403);
    });
});

describe("PUT /api/v1/jornadas/:numeroJornada/pleno", () => {
    test("'1-2' -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/pleno")
            .set(header)
            .send({ apuestaPleno15: "1-2" });

        expect(response.status).toBe(200);
        expect(response.body.apuestaPleno15).toBe("1-2");
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/pleno",
            method: "put",
            status: 200,
            body: response.body,
        });
    });

    test("'M-M' -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/pleno")
            .set(header)
            .send({ apuestaPleno15: "M-M" });

        expect(response.status).toBe(200);
    });

    test("'3-0' -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/pleno")
            .set(header)
            .send({ apuestaPleno15: "3-0" });

        expect(response.status).toBe(400);
    });

    test("'1 - 2' (con espacios) -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/pleno")
            .set(header)
            .send({ apuestaPleno15: "1 - 2" });

        expect(response.status).toBe(400);
    });
});

describe("GET /api/v1/jornadas/:numeroJornada (apuestasAbiertas)", () => {
    test("sin fechas configuradas -> apuestasAbiertas: false", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app).get("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(200);
        expect(response.body.apuestasAbiertas).toBe(false);
    });

    test("con la ventana abierta -> apuestasAbiertas: true", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2020-01-01T00:00:00Z",
                fechaCierreApuestas: "2099-01-01T00:00:00Z",
                fechaCierreJornada: null,
            });

        const response = await request(app).get("/api/v1/jornadas/1").set(header);

        expect(response.body.apuestasAbiertas).toBe(true);
    });

    test("con fechaCierreJornada puesta -> apuestasAbiertas: false", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2020-01-01T00:00:00Z",
                fechaCierreApuestas: "2099-01-01T00:00:00Z",
                fechaCierreJornada: "2020-06-01T00:00:00Z",
            });

        const response = await request(app).get("/api/v1/jornadas/1").set(header);

        expect(response.body.apuestasAbiertas).toBe(false);
    });
});


describe("apuestasAbiertas / assertApuestasAbiertas (unit, sin HTTP)", () => {
    test("sin fechas -> false, y assert lanza ConflictError", () => {
        const jornada = { fechaAperturaApuestas: null, fechaCierreApuestas: null, fechaCierreJornada: null };

        expect(jornadasService.apuestasAbiertas(jornada)).toBe(false);
        expect(() => jornadasService.assertApuestasAbiertas(jornada)).toThrow(
            "Las apuestas de esta jornada están cerradas.",
        );
    });

    test("con la ventana abierta -> true, y assert no lanza", () => {
        const jornada = {
            fechaAperturaApuestas: new Date("2020-01-01T00:00:00Z"),
            fechaCierreApuestas: new Date("2099-01-01T00:00:00Z"),
            fechaCierreJornada: null,
        };

        expect(jornadasService.apuestasAbiertas(jornada)).toBe(true);
        expect(() => jornadasService.assertApuestasAbiertas(jornada)).not.toThrow();
    });

    test("con fechaCierreJornada puesta -> false aunque la ventana temporal esté abierta", () => {
        const jornada = {
            fechaAperturaApuestas: new Date("2020-01-01T00:00:00Z"),
            fechaCierreApuestas: new Date("2099-01-01T00:00:00Z"),
            fechaCierreJornada: new Date("2020-06-01T00:00:00Z"),
        };

        expect(jornadasService.apuestasAbiertas(jornada)).toBe(false);
    });
});