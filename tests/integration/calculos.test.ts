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

async function crearTemporada(header: Record<string, string>, codigo: string, activar = true) {
    await request(app)
        .post("/api/v1/temporadas")
        .set(header)
        .send({ codigo, nombre: `Temporada ${codigo}`, fechaInicio: "2026-08-15", fechaFin: "2027-05-30" });
    if (activar) {
        await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
    }
}

function partidosValidos() {
    return Array.from({ length: 15 }, (_, i) => ({
        orden: i + 1,
        equipoLocal: NOMBRES_EQUIPOS[i % NOMBRES_EQUIPOS.length],
        equipoVisitante: NOMBRES_EQUIPOS[(i + 1) % NOMBRES_EQUIPOS.length],
    }));
}

async function crearJornadaLista(header: Record<string, string>, temporada = "2026-27") {
    await crearEquipos(header);
    await crearTemporada(header, temporada);
    await request(app)
        .post("/api/v1/jornadas")
        .set(header)
        .send({ numeroJornada: 1, fecha: "2026-08-20", partidos: partidosValidos() });
}

async function abrirApuestas(header: Record<string, string>) {
    await request(app)
        .put("/api/v1/jornadas/1/fechas")
        .set(header)
        .send({
            fechaAperturaApuestas: "2020-01-01T00:00:00Z",
            fechaCierreApuestas: "2099-01-01T00:00:00Z",
            fechaCierreJornada: null,
        });
}

async function cerrarVentanaApuestas(header: Record<string, string>) {
    await request(app)
        .put("/api/v1/jornadas/1/fechas")
        .set(header)
        .send({
            fechaAperturaApuestas: "2020-01-01T00:00:00Z",
            fechaCierreApuestas: "2020-06-01T00:00:00Z",
            fechaCierreJornada: null,
        });
}

function resultadosBody(overrides: { premios?: Record<string, number> } = {}) {
    return {
        resultados: ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
        resultado15: "1-M",
        premios: overrides.premios ?? { "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 },
    };
}

function apuestaBody() {
    return {
        numeroApuesta: 1 as const,
        partidos: ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
    };
}

async function prepararJornadaCalculable(adminHeader: Record<string, string>) {
    await crearJornadaLista(adminHeader);
    await abrirApuestas(adminHeader);
    await request(app).post("/api/v1/jornadas/1/apuestas").set(adminHeader).send(apuestaBody());
    await request(app).put("/api/v1/jornadas/1/resultados").set(adminHeader).send(resultadosBody());
    await cerrarVentanaApuestas(adminHeader);
}

describe("POST /api/v1/calculos", () => {
    test("todo en orden (admin) -> 200 y la jornada queda cerrada", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(200);
        expect(response.body.miembros).toHaveLength(1);
        expectMatchesOpenApiSchema({ path: "/calculos", method: "post", status: 200, body: response.body });

        const jornada = await request(app).get("/api/v1/jornadas/1").set(header);
        expect(jornada.body.fechaCierreJornada).not.toBeNull();
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);

        const user = await createUser();
        const response = await request(app)
            .post("/api/v1/calculos")
            .set(await authHeader(user))
            .send({ jornada: 1 });

        expect(response.status).toBe(403);
    });

    test("sin resultados registrados -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await abrirApuestas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());
        await cerrarVentanaApuestas(header);

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("sin ninguna apuesta -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await abrirApuestas(header);
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());
        await cerrarVentanaApuestas(header);

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(409);
    });

    test("con las apuestas todavía abiertas -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await abrirApuestas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());
        await request(app).put("/api/v1/jornadas/1/resultados").set(header).send(resultadosBody());

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(409);
    });

    test("sobre jornada de temporada no activa -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);
        await crearTemporada(header, "2025-26", true);

        const response = await request(app)
            .post("/api/v1/calculos")
            .set(header)
            .send({ jornada: 1, temporada: "2026-27" });

        expect(response.status).toBe(409);
    });

    test("recalcular una jornada de una temporada ya no activa -> 409 explícito y no toca la liquidación", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);
        const primero = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });
        expect(primero.status).toBe(200);
        await crearTemporada(header, "2025-26", true);

        const response = await request(app)
            .post("/api/v1/calculos")
            .set(header)
            .send({ jornada: 1, temporada: "2026-27" });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
        expect(response.body.message).toBe(
            "La temporada '2026-27' no está activa: no se pueden recalcular sus jornadas.",
        );
        const guardado = await request(app).get("/api/v1/calculos?jornada=1&temporada=2026-27").set(header);
        expect(guardado.body).toEqual(primero.body);
    });

    test("sin temporada activa y sin temporada en el body -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearEquipos(header);
        await crearTemporada(header, "2026-27", false);
        await request(app)
            .post("/api/v1/jornadas")
            .set(header)
            .send({ temporada: "2026-27", numeroJornada: 1, fecha: "2026-08-20", partidos: partidosValidos() });

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(404);
    });


    test("jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 99 });

        expect(response.status).toBe(404);
    });

    test("dos veces -> mismo resultado, sin filas duplicadas (idempotente)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);

        const primera = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });
        const segunda = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(primera.status).toBe(200);
        expect(segunda.status).toBe(200);
        expect(segunda.body.miembros).toHaveLength(1);
        expect(segunda.body).toEqual(primera.body);
    });

    test("corregir un resultado y volver a ejecutar -> cifras actualizadas", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);
        await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        await request(app)
            .put("/api/v1/jornadas/1/resultados")
            .set(header)
            .send(resultadosBody({ premios: { "10": 5, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 } }));

        const response = await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        expect(response.status).toBe(200);
        expect(response.body.miembros).toHaveLength(1);
    });
});

describe("GET /api/v1/calculos", () => {
    test("?jornada=1 -> 200 ordenado por ranking ascendente", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararJornadaCalculable(header);
        await request(app).post("/api/v1/calculos").set(header).send({ jornada: 1 });

        const response = await request(app).get("/api/v1/calculos?jornada=1").set(header);

        expect(response.status).toBe(200);
        const rankings = response.body.miembros.map((m: { ranking: number }) => m.ranking);
        expect(rankings).toEqual([...rankings].sort((a, b) => a - b));
        expectMatchesOpenApiSchema({ path: "/calculos", method: "get", status: 200, body: response.body });
    });

    test("de jornada sin calcular -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app).get("/api/v1/calculos?jornada=1").set(header);

        expect(response.status).toBe(404);
    });
});