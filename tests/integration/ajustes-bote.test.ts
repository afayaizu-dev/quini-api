import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, createUser, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

function ajusteBoteBody(overrides: { importe?: number; motivo?: string; fecha?: string } = {}) {
    return {
        importe: overrides.importe ?? -25,
        motivo: overrides.motivo ?? "Corrección por error en el cálculo de la jornada 3",
        fecha: overrides.fecha ?? "2026-09-01",
    };
}

interface OpcionesTemporada {
    fechaInicio?: string;
    fechaFin?: string;
    activar?: boolean;
}

async function crearTemporada(
    header: Record<string, string>,
    codigo = "2026-27",
    opciones: OpcionesTemporada = {},
): Promise<string> {
    const creada = await request(app)
        .post("/api/v1/temporadas")
        .set(header)
        .send({
            codigo,
            nombre: `Temporada ${codigo}`,
            fechaInicio: opciones.fechaInicio ?? "2026-08-15",
            fechaFin: opciones.fechaFin ?? "2027-05-30",
        });
    if (opciones.activar ?? true) {
        await request(app).post(`/api/v1/temporadas/${codigo}/activar`).set(header);
    }
    return creada.body.id as string;
}

describe("POST /api/v1/ajustes-bote", () => {
    test("válido (admin), importe negativo -> 201 en la temporada activa", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const temporadaId = await crearTemporada(header);

        const response = await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());

        expect(response.status).toBe(201);
        expect(response.headers.location).toBe(`/api/v1/ajustes-bote/${response.body.id}`);
        expect(response.body.importe).toBe(-25);
        expect(response.body.registradoPor).toBe(admin.id);
        expect(response.body.temporadaId).toBe(temporadaId);
        expect(response.body.origenTemporadaId).toBeNull();
        expectMatchesOpenApiSchema({
            path: "/ajustes-bote",
            method: "post",
            status: 201,
            body: response.body,
        });
    });

    test("válido (admin), importe positivo -> 201", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header);

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ importe: 30 }));

        expect(response.status).toBe(201);
        expect(response.body.importe).toBe(30);
    });

    test("sin temporada activa -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27", { activar: false });

        const response = await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });

    test("como user -> 403", async () => {
        const user = await createUser();

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(await authHeader(user))
            .send(ajusteBoteBody());

        expect(response.status).toBe(403);
    });

    test("sin token -> 401", async () => {
        const response = await request(app).post("/api/v1/ajustes-bote").send(ajusteBoteBody());
        expect(response.status).toBe(401);
    });

    test("importe con más de 2 decimales -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ importe: 10.999 }));

        expect(response.status).toBe(400);
    });

    test("motivo vacío -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ motivo: "" }));

        expect(response.status).toBe(400);
    });

    test("fecha con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ fecha: "01-09-2026" }));

        expect(response.status).toBe(400);
    });
});

describe("GET /api/v1/ajustes-bote", () => {
    test("como user -> 200, transparencia total", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header);
        await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());
        await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ importe: 15 }));

        const user = await createUser();
        const response = await request(app)
            .get("/api/v1/ajustes-bote")
            .set(await authHeader(user));

        expect(response.status).toBe(200);
        expect(response.body).toHaveLength(2);
        expectMatchesOpenApiSchema({
            path: "/ajustes-bote",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("sin token -> 401", async () => {
        const response = await request(app).get("/api/v1/ajustes-bote");
        expect(response.status).toBe(401);
    });
});

describe("DELETE /api/v1/ajustes-bote/:id", () => {
    test("(admin) -> 204", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header);
        const creado = await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());

        const response = await request(app).delete(`/api/v1/ajustes-bote/${creado.body.id}`).set(header);
        expect(response.status).toBe(204);

        const lista = await request(app).get("/api/v1/ajustes-bote").set(header);
        expect(lista.body).toHaveLength(0);
    });

    test("como user -> 403", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header);
        const creado = await request(app).post("/api/v1/ajustes-bote").set(header).send(ajusteBoteBody());

        const user = await createUser();
        const response = await request(app)
            .delete(`/api/v1/ajustes-bote/${creado.body.id}`)
            .set(await authHeader(user));

        expect(response.status).toBe(403);
    });

    test("inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .delete("/api/v1/ajustes-bote/019ffc0e-0000-7c46-b05d-000000000000")
            .set(header);

        expect(response.status).toBe(404);
    });
});


describe("Ajustes de bote por temporada", () => {
    // 2025-26 empieza antes que 2026-27: activarla después NO genera bote heredado,
    // así estos tests no dependen de la lógica de herencia (Task 5).
    async function dosTemporadasConAjustes(header: Record<string, string>) {
        await crearTemporada(header, "2026-27");
        await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ importe: 15, fecha: "2026-09-01" }));
        await crearTemporada(header, "2025-26", { fechaInicio: "2025-08-15", fechaFin: "2026-05-30" });
        await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send(ajusteBoteBody({ importe: -25, fecha: "2025-09-01" }));
    }

    test("GET sin ?temporada -> solo los ajustes de la temporada activa", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await dosTemporadasConAjustes(header);

        const response = await request(app).get("/api/v1/ajustes-bote").set(header);

        expect(response.status).toBe(200);
        expect(response.body.map((a: { importe: number }) => a.importe)).toEqual([-25]);
    });

    test("GET ?temporada=2026-27 -> los de esa temporada aunque no esté activa", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await dosTemporadasConAjustes(header);

        const response = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);

        expect(response.status).toBe(200);
        expect(response.body.map((a: { importe: number }) => a.importe)).toEqual([15]);
        expectMatchesOpenApiSchema({
            path: "/ajustes-bote",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("GET ?temporada con formato inválido -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).get("/api/v1/ajustes-bote?temporada=2026").set(header);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe("VALIDATION_ERROR");
    });

    test("GET ?temporada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).get("/api/v1/ajustes-bote?temporada=2030-31").set(header);

        expect(response.status).toBe(404);
    });

    test("GET sin temporada activa -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27", { activar: false });

        const response = await request(app).get("/api/v1/ajustes-bote").set(header);

        expect(response.status).toBe(404);
    });

    test("POST con la temporada activa explícita -> 201 en esa temporada", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const temporadaId = await crearTemporada(header, "2026-27");

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send({ ...ajusteBoteBody(), temporada: "2026-27" });

        expect(response.status).toBe(201);
        expect(response.body.temporadaId).toBe(temporadaId);
    });

    test("POST con una temporada no activa -> 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await dosTemporadasConAjustes(header);

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send({ ...ajusteBoteBody(), temporada: "2026-27" });

        expect(response.status).toBe(409);
        expect(response.body.error).toBe("CONFLICT");
        expect(response.body.message).toBe(
            "La temporada '2026-27' no está activa: solo se registran ajustes de bote en la temporada activa.",
        );
    });

    test("POST con una temporada inexistente -> 404", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await crearTemporada(header, "2026-27");

        const response = await request(app)
            .post("/api/v1/ajustes-bote")
            .set(header)
            .send({ ...ajusteBoteBody(), temporada: "2030-31" });

        expect(response.status).toBe(404);
    });

    test("DELETE de un ajuste de una temporada no activa -> 409 y el ajuste sigue", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        await dosTemporadasConAjustes(header);
        const lista = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);
        const id = lista.body[0].id as string;

        const response = await request(app).delete(`/api/v1/ajustes-bote/${id}`).set(header);

        expect(response.status).toBe(409);
        expect(response.body.message).toBe("Solo se pueden borrar ajustes de bote de la temporada activa.");
        const despues = await request(app).get("/api/v1/ajustes-bote?temporada=2026-27").set(header);
        expect(despues.body).toHaveLength(1);
    });
});
