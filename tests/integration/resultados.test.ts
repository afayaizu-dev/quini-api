import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

const NOMBRES_EQUIPOS = ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal"];

async function crearEquipos(header: Record<string, string>) {
    for (const nombre of NOMBRES_EQUIPOS) {
        await request(app)
            .post("/api/v1/equipos")
            .set(header)
            .send({ nombreLargo: nombre, nombreCorto: nombre.slice(0, 3).toUpperCase() });
    }
}

async function crearTemporada(header: Record<string, string>, codigo: string) {
    await request(app)
        .post("/api/v1/temporadas")
        .set(header)
        .send({ codigo, nombre: `Temporada ${codigo}`, fechaInicio: "2026-08-15", fechaFin: "2027-05-30" });
    await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
}

function partidosValidos() {
    return Array.from({ length: 15 }, (_, i) => ({
        orden: i + 1,
        equipoLocal: NOMBRES_EQUIPOS[i % NOMBRES_EQUIPOS.length],
        equipoVisitante: NOMBRES_EQUIPOS[(i + 1) % NOMBRES_EQUIPOS.length],
    }));
}

async function crearJornadaLista(header: Record<string, string>) {
    await crearEquipos(header);
    await crearTemporada(header, "2026-27");
    await request(app)
        .post("/api/v1/jornadas")
        .set(header)
        .send({ numeroJornada: 1, fecha: "2026-08-20", partidos: partidosValidos() });
}

function resultadosBody(
    overrides: { resultados?: string[]; resultado15?: string; premios?: Record<string, number> } = {},
) {
    return {
        resultados: overrides.resultados ?? ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
        resultado15: overrides.resultado15 ?? "1-M",
        premios: overrides.premios ?? { "10": 15.5, "11": 30, "12": 60, "13": 150, "14": 1200, "15": 50000 },
    };
}

describe("PUT /api/v1/jornadas/:numeroJornada/resultados", () => {
    test("primera vez (admin) -> 201 + Location", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody());

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe("/api/v1/jornadas/1/resultados");
        expect(response.body.resultado15).toBe("1-M");
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/resultados",
            method: "put",
            status: 201,
            body: response.body,
        });
    });

    test("segunda vez, mismos datos distintos -> 200 (actualiza)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ resultado15: "2-2" }));

        expect(response.status).toBe(200);
        expect(response.body.resultado15).toBe("2-2");
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/resultados",
            method: "put",
            status: 200,
            body: response.body,
        });
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(await authHeader(user))
            .send(resultadosBody());

        expect(response.status).toBe(403);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).put("/api/v1/jornadas/1/resultados").send(resultadosBody());
        expect(response.status).toBe(401);
    });

    test("jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .put("/api/v1/jornadas/99/resultados")
            .set(header)
            .send(resultadosBody());

        expect(response.status).toBe(404);
    });

    test("signo inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const resultados = resultadosBody().resultados;
        resultados[0] = "3";
        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ resultados }));

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("13 resultados (falta uno) -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ resultados: resultadosBody().resultados.slice(0, 13) }));

        expect(response.status).toBe(400);
    });

    test("resultado15 con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ resultado15: "3-0" }));

        expect(response.status).toBe(400);
    });

    test("premio negativo -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ premios: { ...resultadosBody().premios, "10": -5 } }));

        expect(response.status).toBe(400);
    });

    test("premio con más de 2 decimales -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ premios: { ...resultadosBody().premios, "10": 15.555 } }));

        expect(response.status).toBe(400);
    });
});

describe("GET /api/v1/jornadas/:numeroJornada/resultados", () => {
    test("existente -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());

        const response = await request(app).get("/api/v1/jornadas/1/resultados").set(header);

        expect(response.status).toBe(200);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/resultados",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("jornada sin resultados registrados -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app).get("/api/v1/jornadas/1/resultados").set(header);

        expect(response.status).toBe(404);
    });

    test("jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app).get("/api/v1/jornadas/1/resultados").set(header);

        expect(response.status).toBe(404);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).get("/api/v1/jornadas/1/resultados");
        expect(response.status).toBe(401);
    });
});

describe("DELETE /api/v1/jornadas/:numeroJornada/resultados", () => {
    test("existente, jornada no calculada (admin) -> 204", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());

        const response = await request(app).delete("/api/v1/jornadas/1/resultados").set(header);
        expect(response.status).toBe(204);

        const getResponse = await request(app).get("/api/v1/jornadas/1/resultados").set(header);
        expect(getResponse.status).toBe(404);
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());

        const user = await createUser();
        const response = await request(app).delete("/api/v1/jornadas/1/resultados").set(await authHeader(user));

        expect(response.status).toBe(403);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).delete("/api/v1/jornadas/1/resultados");
        expect(response.status).toBe(401);
    });

    test("jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app).delete("/api/v1/jornadas/99/resultados").set(header);

        expect(response.status).toBe(404);
    });

    test("jornada ya calculada -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({ fechaAperturaApuestas: null, fechaCierreApuestas: null, fechaCierreJornada: "2026-08-21T00:00:00Z" });

        const response = await request(app).delete("/api/v1/jornadas/1/resultados").set(header);

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });
});