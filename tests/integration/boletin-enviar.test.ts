import { describe, expect, test, vi } from "vitest";
import request from "supertest";
import { app, createUser, createAdmin, authHeader } from "../helpers/auth.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

vi.mock("../../src/modules/mail/gmail.js", () => ({ sendMail: vi.fn() }));

import { sendMail } from "../../src/modules/mail/gmail.js";

const sendMailMock = vi.mocked(sendMail);

describe("POST /api/v1/boletin/enviar", () => {
    const validBody = { subject: "Boletín — Jornada 6", html: "<p>Resumen</p>" };

    test("sin cabecera Authorization -> 401", async () => {
        const response = await request(app).post("/api/v1/boletin/enviar").send(validBody);

        expect(response.status).toBe(401);
    });

    test("token de user en endpoint de admin -> 403", async () => {
        const user = await createUser();
        const header = await authHeader(user);

        const response = await request(app).post("/api/v1/boletin/enviar").set(header).send(validBody);

        expect(response.status).toBe(403);
        expect(response.body.error).toBe("FORBIDDEN");
    });

    test("token de admin con body inválido (sin html) -> 400", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);

        const response = await request(app)
            .post("/api/v1/boletin/enviar")
            .set(header)
            .send({ subject: "Boletín" });

        expect(response.status).toBe(400);
    });

    test("token de admin con body válido -> 200, envía a todos los usuarios", async () => {
        sendMailMock.mockReset().mockResolvedValue(undefined);

        const admin = await createAdmin();
        await createUser();
        await createUser();
        const header = await authHeader(admin);

        const response = await request(app).post("/api/v1/boletin/enviar").set(header).send(validBody);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ enviados: 3, fallidos: [] });
        expect(sendMailMock).toHaveBeenCalledTimes(3);
        expectMatchesOpenApiSchema({ path: "/boletin/enviar", method: "post", status: 200, body: response.body });
    });

    test("un destinatario falla -> sigue con el resto, 200 con ese email en fallidos", async () => {
        const admin = await createAdmin();
        const fallido = await createUser();
        await createUser();
        const header = await authHeader(admin);

        sendMailMock.mockReset().mockImplementation(async ({ to }) => {
            if (to === fallido.email) {
                throw new Error("Gmail API devolvió 500");
            }
        });

        const response = await request(app).post("/api/v1/boletin/enviar").set(header).send(validBody);

        expect(response.status).toBe(200);
        expect(response.body.enviados).toBe(2);
        expect(response.body.fallidos).toEqual([fallido.email]);
        expect(sendMailMock).toHaveBeenCalledTimes(3);
    });
});
