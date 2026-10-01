import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { db } from "../../src/db/index.js";
import { jornadas } from "../../src/db/schema/jornadas.js";
import { resultadosMiembro } from "../../src/db/schema/resultados_miembro.js";
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

const TEMPORADA_A = {
    codigo: "2025-26",
    nombre: "Temporada 2025/26",
    fechaInicio: "2025-08-15",
    fechaFin: "2026-05-30",
};
const TEMPORADA_B = {
    codigo: "2026-27",
    nombre: "Temporada 2026/27",
    fechaInicio: "2026-08-15",
    fechaFin: "2027-05-30",
};

interface AjusteRespuesta {
    id: string;
    importe: number;
    motivo: string;
    fecha: string;
    temporadaId: string;
    origenTemporadaId: string | null;
    registradoPor: string;
}

async function crearTemporadaHttp(
    header: Record<string, string>,
    datos: typeof TEMPORADA_A,
): Promise<string> {
    const response = await request(app)
        .post("/api/v1/temporadas")
        .set(header)
        .send(temporadaBody(datos));
    return response.body.id as string;
}

async function activar(header: Record<string, string>, codigo: string) {
    const response = await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
    expect(response.status).toBe(200);
}

async function sembrarJornadaCalculada(
    temporadaId: string,
    numeroJornada: number,
    fecha: string,
    usuarioId: string,
    bote: number,
) {
    const [jornada] = await db
        .insert(jornadas)
        .values({ temporadaId, numeroJornada, fecha, createdBy: usuarioId })
        .returning();
    if (!jornada) throw new Error("No se pudo sembrar la jornada");
    await db.insert(resultadosMiembro).values({
        jornadaId: jornada.id,
        usuarioId,
        aciertosMax: 10,
        ranking: 1,
        escalon: 1,
        importeEscalon: 1.5,
        bote,
    });
}

async function ajustesDe(
    header: Record<string, string>,
    codigo: string,
): Promise<AjusteRespuesta[]> {
    const response = await request(app).get(`/api/v1/ajustes-bote?temporada=${codigo}`).set(header);
    expect(response.status).toBe(200);
    return response.body as AjusteRespuesta[];
}

async function boteTotalDe(header: Record<string, string>, codigo: string): Promise<number> {
    const response = await request(app)
        .get(`/api/v1/dashboard/temporada?temporada=${codigo}`)
        .set(header);
    expect(response.status).toBe(200);
    return response.body.boteTotal as number;
}

// A activa con bote final 12.30 = ajustes (10.10 - 2.05) + jornadas (3.35 + 0.90). B creada sin activar.
async function prepararTemporadaAConBote(header: Record<string, string>, adminId: string) {
    const idA = await crearTemporadaHttp(header, TEMPORADA_A);
    const idB = await crearTemporadaHttp(header, TEMPORADA_B);
    await activar(header, TEMPORADA_A.codigo);
    await request(app)
        .post("/api/v1/ajustes-bote")
        .set(header)
        .send({ importe: 10.1, motivo: "Bote inicial", fecha: "2025-08-15" });
    await request(app)
        .post("/api/v1/ajustes-bote")
        .set(header)
        .send({ importe: -2.05, motivo: "Gastos", fecha: "2025-09-01" });
    await sembrarJornadaCalculada(idA, 1, "2025-08-20", adminId, 3.35);
    await sembrarJornadaCalculada(idA, 2, "2025-08-27", adminId, 0.9);
    return { idA, idB };
}

describe("Bote heredado al activar una temporada", () => {
    test("sin temporada activa previa -> no se crea bote heredado", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporadaHttp(header, TEMPORADA_A);

        await activar(header, TEMPORADA_A.codigo);

        expect(await ajustesDe(header, TEMPORADA_A.codigo)).toEqual([]);
    });

    test("activar una temporada posterior hereda el bote final de la anterior (ajustes + jornadas)", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const { idA, idB } = await prepararTemporadaAConBote(header, admin.id);

        await activar(header, TEMPORADA_B.codigo);

        const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
        expect(ajustesB).toHaveLength(1);
        expect(ajustesB[0]).toMatchObject({
            importe: 12.3,
            motivo: "Bote heredado de 2025-26",
            fecha: TEMPORADA_B.fechaInicio,
            temporadaId: idB,
            origenTemporadaId: idA,
            registradoPor: admin.id,
        });
        expect(await boteTotalDe(header, TEMPORADA_A.codigo)).toBe(12.3);
        expect(await boteTotalDe(header, TEMPORADA_B.codigo)).toBe(12.3);
    });

    test("activar otra vez la temporada ya activa no duplica ni recalcula el heredado", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararTemporadaAConBote(header, admin.id);
        await activar(header, TEMPORADA_B.codigo);
        const antes = await ajustesDe(header, TEMPORADA_B.codigo);
        expect(antes).toHaveLength(1);

        await activar(header, TEMPORADA_B.codigo);

        expect(await ajustesDe(header, TEMPORADA_B.codigo)).toEqual(antes);
    });

    test("reactivar una temporada más antigua no le crea heredado y la nueva conserva el suyo", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararTemporadaAConBote(header, admin.id);
        await activar(header, TEMPORADA_B.codigo);

        await activar(header, TEMPORADA_A.codigo);

        const ajustesA = await ajustesDe(header, TEMPORADA_A.codigo);
        expect(ajustesA).toHaveLength(2);
        expect(ajustesA.every((a) => a.origenTemporadaId === null)).toBe(true);
        const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
        expect(ajustesB).toHaveLength(1);
        expect(ajustesB[0]?.importe).toBe(12.3);
    });

    test("volver a activar la nueva tras corregir la antigua recalcula su heredado sin duplicarlo", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await prepararTemporadaAConBote(header, admin.id);
        await activar(header, TEMPORADA_B.codigo);
        const [heredadoInicial] = await ajustesDe(header, TEMPORADA_B.codigo);
        await activar(header, TEMPORADA_A.codigo);
        await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send({ importe: 5, motivo: "Corrección tardía", fecha: "2026-05-01" });

        await activar(header, TEMPORADA_B.codigo);

        const ajustesB = await ajustesDe(header, TEMPORADA_B.codigo);
        expect(ajustesB).toHaveLength(1);
        expect(ajustesB[0]?.id).toBe(heredadoInicial?.id);
        expect(ajustesB[0]?.importe).toBe(17.3);
        expect(await boteTotalDe(header, TEMPORADA_B.codigo)).toBe(17.3);
    });

    test("el heredado cuenta en boteJornadaAjustado aunque la jornada sea anterior a fechaInicio", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const { idB } = await prepararTemporadaAConBote(header, admin.id);
        await activar(header, TEMPORADA_B.codigo);
        await sembrarJornadaCalculada(idB, 1, "2026-08-10", admin.id, 1.5);

        const response = await request(app).get("/api/v1/dashboard/jornada?jornada=1").set(header);

        expect(response.status).toBe(200);
        expect(response.body.boteJornadaAjustado).toBe(13.8);
    });
});
