import { describe, expect, test, vi } from "vitest";
import request from "supertest";
import { app, createUser, createAdmin, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

vi.mock("../../src/modules/mail/index.js", () => ({ sendMail: vi.fn() }));

import { sendMail } from "../../src/modules/mail/index.js";

const sendMailMock = vi.mocked(sendMail);

describe("POST /api/v1/boletin/prueba", () => {
    const validBody = { subject: "Boletín — Jornada 6", html: "<p>Resumen</p>" };

    test("sin cabecera Authorization -> 401", async () => {
        const response = await request(app).post("/api/v1/boletin/prueba").send(validBody);

        expect(response.status).toBe(401);
    });

    test("token de user en endpoint de admin -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).post("/api/v1/boletin/prueba").set(header).send(validBody);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("FORBIDDEN");
    });

    test("token de admin con body inválido (sin html) -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/boletin/prueba")
            .set(header)
            .send({ subject: "Boletín" });

        expect(response.status).toBe(400);
    });

    test("token de admin con body válido -> 200, envía solo al admin autenticado", async () => {
        sendMailMock.mockReset().mockResolvedValue(undefined);

        const admin = await createAdmin();
        await createUser();
        await createUser();
        const header = await authHeader(admin);

        const response = await request(app).post("/api/v1/boletin/prueba").set(header).send(validBody);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ enviadoA: admin.email });
        expect(sendMailMock).toHaveBeenCalledTimes(1);
        expect(sendMailMock).toHaveBeenCalledWith({ to: admin.email, ...validBody });
        expectMatchesOpenApiSchema({ path: "/boletin/prueba", method: "post", status: 200, body: response.body });
    });

    test("el envío falla -> error, no responde 200", async () => {
        sendMailMock.mockReset().mockRejectedValue(new Error("Gmail API devolvió 500"));

        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app).post("/api/v1/boletin/prueba").set(header).send(validBody);

        expect(response.status).toBe(500);
    });
});
