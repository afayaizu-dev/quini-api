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

function resultadosBody() {
    return {
        resultados: ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
        resultado15: "1-M",
        premios: { "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 },
    };
}

function apuestaBody() {
    return {
        numeroApuesta: 1 as const,
        partidos: ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"],
    };
}

async function calcularJornadaParaUsuario(adminHeader: Record<string, string>, userHeader: Record<string, string>) {
    await crearJornadaLista(adminHeader);
    await abrirApuestas(adminHeader);
    await request(app).post("/api/v1/jornadas/1/apuestas").set(userHeader).send(apuestaBody());
    await request(app).put("/api/v1/jornadas/1/resultados").set(adminHeader).send(resultadosBody());
    await cerrarVentanaApuestas(adminHeader);
    await request(app).post("/api/v1/calculos").set(adminHeader).send({ jornada: 1 });
}

function pagoBody(usuarioId: string, overrides: { importe?: number; fechaPago?: string } = {}) {
    return {
        usuarioId,
        importe: overrides.importe ?? 50,
        fechaPago: overrides.fechaPago ?? "2026-09-01",
    };
}

describe("POST /api/v1/pagos", () => {
    test("válido (admin) -> 201 y el crédito del miembro sube", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();

        const response = await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user.id));

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(`/api/v1/pagos/${response.body.id}`);
        expectMatchesOpenApiSchema({ path: "/pagos", method: "post", status: 201, body: response.body });

        const perfil = await request(app).get("/api/v1/usuarios/me").set(await authHeader(user));
        expect(perfil.body.credito).toBe(50);
    });

    test("como user -> 403", async () => {
        const user = await createUser();
        const otro = await createUser();

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(await authHeader(user))
            .send(pagoBody(otro.id));

        expect(response.status).toBe(403);
    });

    test("importe: 0 -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(header)
            .send(pagoBody(user.id, { importe: 0 }));

        expect(response.status).toBe(400);
    });

    test("importe: -10 -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(header)
            .send(pagoBody(user.id, { importe: -10 }));

        expect(response.status).toBe(400);
    });

    test("importe: 10.999 -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(header)
            .send(pagoBody(user.id, { importe: 10.999 }));

        expect(response.status).toBe(400);
    });

    test("usuarioId inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(header)
            .send(pagoBody("019ffc0e-0000-7c46-b05d-000000000000"));

        expect(response.status).toBe(404);
    });

    test("fechaPago con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/pagos")
            .set(header)
            .send(pagoBody(user.id, { fechaPago: "01-09-2026" }));

        expect(response.status).toBe(400);
    });
});

describe("GET /api/v1/pagos", () => {
    test("como user -> 200, transparencia total de la clasificación", async () => {
        const user = await createUser();
        const response = await request(app).get("/api/v1/pagos").set(await authHeader(user));
        expect(response.status).toBe(200);
    });

    test("?usuario={id} como user -> 200 filtrado (ve los pagos de cualquier miembro)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user1 = await createUser();
        const user2 = await createUser();
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user1.id));
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user2.id));

        const response = await request(app).get(`/api/v1/pagos?usuario=${user1.id}`).set(await authHeader(user2));

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].usuarioId).toBe(user1.id);
        expectMatchesOpenApiSchema({ path: "/pagos", method: "get", status: 200, body: response.body });
    });

    test("?desde=&hasta= -> 200 en el rango", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user.id, { fechaPago: "2026-01-01" }));
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user.id, { fechaPago: "2026-09-01" }));

        const response = await request(app).get("/api/v1/pagos?desde=2026-08-01&hasta=2026-10-01").set(header);

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].fechaPago).toBe("2026-09-01");
    });
});

describe("GET /api/v1/pagos/mios", () => {
    test("200 solo los propios", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();
        const otro = await createUser();
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user.id));
        await request(app).post("/api/v1/pagos").set(header).send(pagoBody(otro.id));

        const response = await request(app)
            .get("/api/v1/pagos/mios")
            .set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(1);
        expect(response.body[0].usuarioId).toBe(user.id);
        expectMatchesOpenApiSchema({ path: "/pagos/mios", method: "get", status: 200, body: response.body });
    });
});

describe("DELETE /api/v1/pagos/:id", () => {
    test("(admin) -> 204 y el crédito baja", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const user = await createUser();
        const creado = await request(app).post("/api/v1/pagos").set(header).send(pagoBody(user.id));

        const response = await request(app).delete(`/api/v1/pagos/${creado.body.id}`).set(header);
        expect(response.status).toBe(204);

        const perfil = await request(app)
            .get("/api/v1/usuarios/me")
            .set(await authHeader(user));
        expect(perfil.body.credito).toBe(0);
    });

    test("inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .delete("/api/v1/pagos/019ffc0e-0000-7c46-b05d-000000000000")
            .set(header);

        expect(response.status).toBe(404);
    });
});

describe("Crédito calculado (usuarios/me)", () => {
    test("tras un pago y una jornada calculada -> credito = pago - importeEscalon", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const user = await createUser();
        const userHeader = await authHeader(user);

        await calcularJornadaParaUsuario(adminHeader, userHeader);
        await request(app).post("/api/v1/pagos").set(adminHeader).send(pagoBody(user.id, { importe: 10 }));

        const perfil = await request(app).get("/api/v1/usuarios/me").set(userHeader);
        expect(perfil.body.credito).toBe(8.5);
    });

    test("crédito negativo (debe con la peña) -> se muestra en negativo, sin error", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const user = await createUser();
        const userHeader = await authHeader(user);

        await calcularJornadaParaUsuario(adminHeader, userHeader);
        await request(app).post("/api/v1/pagos").set(adminHeader).send(pagoBody(user.id, { importe: 1 }));

        const perfil = await request(app).get("/api/v1/usuarios/me").set(userHeader);
        expect(perfil.status).toBe(200);
        expect(perfil.body.credito).toBe(-0.5);
    });

    test("recalcular una jornada no altera el crédito de forma inesperada", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const user = await createUser();
        const userHeader = await authHeader(user);

        await calcularJornadaParaUsuario(adminHeader, userHeader);
        await request(app).post("/api/v1/pagos").set(adminHeader).send(pagoBody(user.id, { importe: 10 }));
        await request(app).post("/api/v1/calculos").set(adminHeader).send({ jornada: 1 });

        const perfil = await request(app).get("/api/v1/usuarios/me").set(userHeader);
        expect(perfil.body.credito).toBe(8.5);
    });
});