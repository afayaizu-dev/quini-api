import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

const NOMBRES_EQUIPOS = ["Real Madrid", "Barcelona", "Atletico Madrid", "Sevilla", "Valencia", "Villarreal"];
const RESULTADO_OFICIAL = ["1", "X", "2", "1", "1", "X", "2", "1", "X", "2", "1", "1", "X", "2"];

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
        resultados: RESULTADO_OFICIAL,
        resultado15: "1-M",
        premios: { "10": 0, "11": 0, "12": 0, "13": 0, "14": 0, "15": 0 },
    };
}

function partidosConAciertos(aciertos: number): string[] {
    return RESULTADO_OFICIAL.map((signo, i) => {
        if (i < aciertos) return signo;
        return signo === "1" ? "2" : "1";
    });
}

async function prepararJornadaConTresMiembros(
    adminHeader: Record<string, string>,
    headerA: Record<string, string>,
    headerB: Record<string, string>,
    headerC: Record<string, string>,
) {
    await crearJornadaLista(adminHeader);
    await abrirApuestas(adminHeader);
    await request(app)
        .post("/api/v1/jornadas/1/apuestas")
        .set(headerA)
        .send({ numeroApuesta: 1, partidos: partidosConAciertos(10) });
    await request(app)
        .post("/api/v1/jornadas/1/apuestas")
        .set(headerB)
        .send({ numeroApuesta: 1, partidos: partidosConAciertos(10) });
    await request(app)
        .post("/api/v1/jornadas/1/apuestas")
        .set(headerC)
        .send({ numeroApuesta: 1, partidos: partidosConAciertos(4) });
    await request(app).put("/api/v1/jornadas/1/resultados").set(adminHeader).send(resultadosBody());
    await cerrarVentanaApuestas(adminHeader);
    await request(app).post("/api/v1/calculos").set(adminHeader).send({ jornada: 1 });
}

describe("GET /api/v1/dashboard/miembro", () => {
    test("sin ?usuario= -> 200 con los datos del token", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");
        const user = await createUser();

        const response = await request(app).get("/api/v1/dashboard/miembro").set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body.usuarioId).toBe(user.id);
        expectMatchesOpenApiSchema({ path: "/dashboard/miembro", method: "get", status: 200, body: response.body });
    });

    test("?usuario={otro} como user -> 200, transparencia total de la clasificación", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");
        const user = await createUser();
        const otro = await createUser();

        const response = await request(app)
            .get(`/api/v1/dashboard/miembro?usuario=${otro.id}`)
            .set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body.usuarioId).toBe(otro.id);
    });

    test("?usuario={otro} como admin -> 200", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");
        const otro = await createUser();

        const response = await request(app).get(`/api/v1/dashboard/miembro?usuario=${otro.id}`).set(adminHeader);

        expect(response.status).toBe(200);
        expect(response.body.usuarioId).toBe(otro.id);
    });

    test("?usuario={inexistente} -> 404", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");
        const user = await createUser();

        const response = await request(app)
            .get("/api/v1/dashboard/miembro?usuario=019ff7eb-0000-7000-8000-000000000000")
            .set(await authHeader(user));

        expect(response.status).toBe(404);
    });

    test("sin jornadas calculadas -> 200 con null/0, no 500, y porcentaje sin división por cero", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");
        const user = await createUser();

        const response = await request(app).get("/api/v1/dashboard/miembro").set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body.pagosTotales).toBe(0);
        expect(response.body.ingresosTotales).toBe(0);
        expect(response.body.credito).toBe(0);
        expect(response.body.mediaAciertos).toBeNull();
        expect(response.body.maxAciertos).toBeNull();
        expect(response.body.minAciertos).toBeNull();
        expect(response.body.maxPremio).toBeNull();
        expect(response.body.porcentajeApuestasPropias).toBe(0);
    });
});

describe("GET /api/v1/dashboard/jornada", () => {
    test("calculada -> 200 con la clasificación ordenada por ranking", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const userA = await createUser();
        const userB = await createUser();
        const userC = await createUser();
        await prepararJornadaConTresMiembros(
            adminHeader,
            await authHeader(userA),
            await authHeader(userB),
            await authHeader(userC),
        );

        const response = await request(app).get("/api/v1/dashboard/jornada?jornada=1").set(adminHeader);

        expect(response.status).toBe(200);
        expect(response.body.clasificacion).toHaveLength(3);
        const rankings = response.body.clasificacion.map((m: { ranking: number }) => m.ranking);
        expect(rankings).toEqual([...rankings].sort((a: number, b: number) => a - b));
        expect(Number.isNaN(response.body.mediaAciertosMaximos)).toBe(false);
        expect(Number.isNaN(response.body.mediaAciertosDosApuestas)).toBe(false);
        expectMatchesOpenApiSchema({ path: "/dashboard/jornada", method: "get", status: 200, body: response.body });
    });

    test("de jornada sin calcular -> 404", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearJornadaLista(adminHeader);

        const response = await request(app).get("/api/v1/dashboard/jornada?jornada=1").set(adminHeader);

        expect(response.status).toBe(404);
    });

    test("de jornada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");

        const response = await request(app).get("/api/v1/dashboard/jornada?jornada=99").set(adminHeader);

        expect(response.status).toBe(404);
    });
});

describe("GET /api/v1/dashboard/temporada", () => {
    test("200 con máximos, mínimos y sus usuarios; máximo compartido -> los dos aparecen", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        const userA = await createUser();
        const userB = await createUser();
        const userC = await createUser();
        await prepararJornadaConTresMiembros(
            adminHeader,
            await authHeader(userA),
            await authHeader(userB),
            await authHeader(userC),
        );

        const response = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

        expect(response.status).toBe(200);
        expect(response.body.maxAciertos).toBe(10);
        expect(response.body.usuariosMaxAciertos.sort()).toEqual([userA.id, userB.id].sort());
        expect(response.body.minAciertos).toBe(4);
        expect(response.body.usuariosMinAciertos).toEqual([userC.id]);
        expect(response.body.jornadasCalculadas).toBe(1);
        expectMatchesOpenApiSchema({ path: "/dashboard/temporada", method: "get", status: 200, body: response.body });
    });

    test("con una apuesta propia y otra creada por el admin -> 50%", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearJornadaLista(adminHeader);
        await abrirApuestas(adminHeader);
        const user = await createUser();
        const userHeader = await authHeader(user);

        await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(userHeader)
            .send({ numeroApuesta: 1, partidos: partidosConAciertos(5) });
        await request(app)
            .post("/api/v1/jornadas/1/apuestas")
            .set(adminHeader)
            .send({ numeroApuesta: 2, usuarioId: user.id, partidos: partidosConAciertos(5) });

        const response = await request(app).get("/api/v1/dashboard/miembro").set(userHeader);

        expect(response.status).toBe(200);
        expect(response.body.porcentajeApuestasPropias).toBe(50);
    });

    test("temporada activa sin ninguna jornada calculada -> usuarios[] vacíos, sin error", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27");

        const response = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

        expect(response.status).toBe(200);
        expect(response.body.maxAciertos).toBeNull();
        expect(response.body.usuariosMaxAciertos).toEqual([]);
        expect(response.body.minAciertos).toBeNull();
        expect(response.body.usuariosMinAciertos).toEqual([]);
        expect(response.body.jornadasCalculadas).toBe(0);
    });


    test("sin temporada activa -> 404", async () => {
        const admin = await createAdmin();
        const adminHeader = await authHeader(admin);
        await crearTemporada(adminHeader, "2026-27", false);

        const response = await request(app).get("/api/v1/dashboard/temporada").set(adminHeader);

        expect(response.status).toBe(404);
    });
});

describe("Autenticación", () => {
    test("cualquiera de las 3 rutas sin token -> 401", async () => {
        const miembro = await request(app).get("/api/v1/dashboard/miembro");
        const jornada = await request(app).get("/api/v1/dashboard/jornada?jornada=1");
        const temporada = await request(app).get("/api/v1/dashboard/temporada");

        expect(miembro.status).toBe(401);
        expect(jornada.status).toBe(401);
        expect(temporada.status).toBe(401);
    });
});