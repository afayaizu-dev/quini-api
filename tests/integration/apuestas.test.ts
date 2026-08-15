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

async function cerrarApuestas(header: Record<string, string>) {
    await request(app)
        .put("/api/v1/jornadas/1/fechas")
        .set(header)
        .send({
            fechaAperturaApuestas: "2020-01-01T00:00:00Z",
            fechaCierreApuestas: "2020-06-01T00:00:00Z",
            fechaCierreJornada: null,
        });
}

async function crearJornadaConApuestasAbiertas(header: Record<string, string>) {
    await crearJornadaLista(header);
    await abrirApuestas(header);
}

function apuestaBody(
    overrides: {
        numeroApuesta?: 1 | 2;
        partidos?: string[];
        sugerenciaPleno15?: string;
        usuarioId?: string;
    } = {},
) {
    return {
        numeroApuesta: overrides.numeroApuesta ?? 1,
        partidos: overrides.partidos ?? ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
        ...(overrides.sugerenciaPleno15 !== undefined ? { sugerenciaPleno15: overrides.sugerenciaPleno15 } : {}),
        ...(overrides.usuarioId !== undefined ? { usuarioId: overrides.usuarioId } : {}),
    };
}


function updateApuestaBody(
    overrides: { partidos?: string[]; sugerenciaPleno15?: string; usuarioId?: string } = {},
) {
    return {
        partidos: overrides.partidos ?? ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
        ...(overrides.sugerenciaPleno15 !== undefined ? { sugerenciaPleno15: overrides.sugerenciaPleno15 } : {}),
        ...(overrides.usuarioId !== undefined ? { usuarioId: overrides.usuarioId } : {}),
    };
}





describe("POST /api/v1/jornadas/:numeroJornada/apuestas", () => {
    test("válida, propia, ventana abierta -> 201 + Location + creadaPorElMismo: true", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe("/api/v1/jornadas/1/apuestas/1");
        expect(response.body.creadaPorElMismo).toBe(true);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/apuestas",
            method: "post",
            status: 201,
            body: response.body,
        });
    });

    test("usuarioId de otro, como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const user = await createUser();
        const otro = await createUser();
        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(await authHeader(user))
            .send(apuestaBody({ usuarioId: otro.id }));

        expect(response.status).toBe(403);
    });

    test("usuarioId de otro, como admin -> 201 + creadaPorElMismo: false", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const otro = await createUser();
        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ usuarioId: otro.id }));

        expect(response.status).toBe(201);
        expect(response.body.creadaPorElMismo).toBe(false);
        expect(response.body.usuarioId).toBe(otro.id);
    });

    test("usuarioId inexistente, como admin -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ usuarioId: "019ffc0e-0000-7c46-b05d-000000000000" }));

        expect(response.status).toBe(404);
    });

    test("repetida con el mismo numeroApuesta -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
    });

    test("numeroApuesta: 3 -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ numeroApuesta: 3 as never }));

        expect(response.status).toBe(400);
    });

    test("13 partidos -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ partidos: apuestaBody().partidos.slice(0, 13) }));

        expect(response.status).toBe(400);
    });

    test("un partido '3' -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const partidos = apuestaBody().partidos;
        partidos[0] = "3";
        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ partidos }));

        expect(response.status).toBe(400);
    });

    test("sugerenciaPleno15: '1-M' -> 201", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ sugerenciaPleno15: "1-M" }));

        expect(response.status).toBe(201);
        expect(response.body.sugerenciaPleno15).toBe("1-M");
    });

    test("sugerenciaPleno15: '5-0' -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ sugerenciaPleno15: "5-0" }));

        expect(response.status).toBe(400);
    });

    test("sin sugerenciaPleno15 -> 201 (es opcional)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(201);
        expect(response.body.sugerenciaPleno15).toBeNull();
    });

    test("sin fechas configuradas -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(409);
    });

    test("antes de la fecha de apertura -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2099-01-01T00:00:00Z",
                fechaCierreApuestas: "2099-06-01T00:00:00Z",
                fechaCierreJornada: null,
            });

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(409);
    });

    test("después del cierre -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await cerrarApuestas(header);

        const user = await createUser();
        const response = await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(await authHeader(user))
            .send(apuestaBody());

        expect(response.status).toBe(409);
    });

    test("después del cierre, como admin -> 409 (tampoco el admin)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await cerrarApuestas(header);

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(409);
    });

    test("jornada ya calculada -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaLista(header);
        await request(app)
            .put("/api/v1/jornadas/1/fechas")
            .set(header)
            .send({
                fechaAperturaApuestas: "2020-01-01T00:00:00Z",
                fechaCierreApuestas: "2020-06-01T00:00:00Z",
                fechaCierreJornada: "2020-06-02T00:00:00Z",
            });

        const response = await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        expect(response.status).toBe(409);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).post("/api/v1/jornadas/1/apuestas").send(apuestaBody());
        expect(response.status).toBe(401);
    });
});

describe("PUT /api/v1/jornadas/:numeroJornada/apuestas/:numeroApuesta", () => {
    test("propia, ventana abierta -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app)
            .put("/api/v1/jornadas/1/apuestas/1")
            .set(header)
            .send(updateApuestaBody({ sugerenciaPleno15: "2-2" }));

        expect(response.status).toBe(200);
        expect(response.body.sugerenciaPleno15).toBe("2-2");
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/apuestas/{numeroApuesta}",
            method: "put",
            status: 200,
            body: response.body,
        });
    });

    test("de otro, como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        const otro = await createUser();
        await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ usuarioId: otro.id }));

        const user = await createUser();
        const response = await request(app)
            .put("/api/v1/jornadas/1/apuestas/1")
            .set(await authHeader(user))
            .send(updateApuestaBody({ usuarioId: otro.id }));

        expect(response.status).toBe(403);
    });

    test("de otro, como admin -> 200", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        const otro = await createUser();
        await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(header)
            .send(apuestaBody({ usuarioId: otro.id }));

        const response = await request(app)
            .put("/api/v1/jornadas/1/apuestas/1")
            .set(header)
            .send(updateApuestaBody({ usuarioId: otro.id, sugerenciaPleno15: "0-0" }));

        expect(response.status).toBe(200);
    });

    test("después del cierre -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());
        await cerrarApuestas(header);

        const response = await request(app).put("/api/v1/jornadas/1/apuestas/1").set(header).send(updateApuestaBody());

        expect(response.status).toBe(409);
    });

    test("apuesta inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const response = await request(app).put("/api/v1/jornadas/1/apuestas/2").set(header).send(updateApuestaBody());

        expect(response.status).toBe(404);
    });
});

describe("DELETE /api/v1/jornadas/:numeroJornada/apuestas/:numeroApuesta", () => {
    test("propia, ventana abierta -> 204", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app).delete("/api/v1/jornadas/1/apuestas/1").set(header);
        expect(response.status).toBe(204);
    });

    test("después del cierre -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());
        await cerrarApuestas(header);

        const response = await request(app).delete("/api/v1/jornadas/1/apuestas/1").set(header);

        expect(response.status).toBe(409);
    });
});

describe("GET /api/v1/jornadas/:numeroJornada/apuestas", () => {
    test("como user, ventana abierta -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const user = await createUser();
        const response = await request(app).get("/api/v1/jornadas/1/apuestas").set(await authHeader(user));

        expect(response.status).toBe(403);
    });

    test("como user, ventana cerrada -> 200 con todas", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());
        await cerrarApuestas(header);

        const user = await createUser();
        const response = await request(app).get("/api/v1/jornadas/1/apuestas").set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/apuestas",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("como admin, ventana abierta -> 200 con todas", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app).get("/api/v1/jornadas/1/apuestas").set(header);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
    });
});

describe("GET /api/v1/jornadas/:numeroJornada/apuestas/mias", () => {
    test("solo las propias", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);

        const user = await createUser();
        const userHeader = await authHeader(user);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(userHeader).send(apuestaBody());
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody({ numeroApuesta: 2 }));

        const response = await request(app).get("/api/v1/jornadas/1/apuestas/mias").set(userHeader);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expectMatchesOpenApiSchema({
            path: "/jornadas/{numeroJornada}/apuestas/mias",
            method: "get",
            status: 200,
            body: response.body,
        });
    });
});

describe("PUT/DELETE /api/v1/jornadas/:numeroJornada con apuestas registradas", () => {
    test("PUT bloqueado -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app)
            .put("/api/v1/jornadas/1")
            .set(header)
            .send({ fecha: "2026-08-22", partidos: partidosValidos() });

        expect(response.status).toBe(409);
    });

    test("DELETE bloqueado -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearJornadaConApuestasAbiertas(header);
        await request(app).post("/api/v1/jornadas/1/apuestas").set(header).send(apuestaBody());

        const response = await request(app).delete("/api/v1/jornadas/1").set(header);

        expect(response.status).toBe(409);
    });
});