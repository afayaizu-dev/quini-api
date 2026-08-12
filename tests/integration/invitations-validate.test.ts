import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin, authHeader } from "../helpers/auth.js";
import { createInvitation, markInvitationAccepted } from "../../src/modules/invitations/invitations.repository.js";
import { hashInvitationToken, newInvitationToken } from "../../src/modules/invitations/invitations.service.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

describe("GET /api/v1/invitaciones/:token/validar", () => {
    test("token válido -> 200 con los datos de la invitación", async () => {
        const admin = await createAdmin();
        const token = newInvitationToken();

        await createInvitation({
            email: "invitado-validar@test.local",
            role: "user",
            tokenHash: hashInvitationToken(token),
            invitedBy: admin.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const response = await request(app).get(`/api/v1/invitaciones/${token}/validar`);

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ email: "invitado-validar@test.local", role: "user" });
        expectMatchesOpenApiSchema({
            path: "/invitaciones/{token}/validar",
            method: "get",
            status: 200,
            body: response.body,
        });
    });

    test("token inexistente -> 404", async () => {
        const response = await request(app).get("/api/v1/invitaciones/un-token-que-no-existe/validar");

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });

    test("token ya usado -> 410", async () => {
        const admin = await createAdmin();
        const token = newInvitationToken();

        const invitation = await createInvitation({
            email: "ya-usada@test.local",
            role: "user",
            tokenHash: hashInvitationToken(token),
            invitedBy: admin.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        await markInvitationAccepted(invitation.id);

        const response = await request(app).get(`/api/v1/invitaciones/${token}/validar`);

        expect(response.status).toBe(410);
    });
});

describe("POST /api/v1/invitaciones (conflicto)", () => {
    test("invitar dos veces al mismo email -> la segunda vez 409", async () => {
        const admin = await createAdmin();
        const header = await authHeader(admin);
        const body = { email: "duplicado@test.local", role: "user" };

        const first = await request(app).post("/api/v1/invitaciones").set(header).send(body);
        expect(first.status).toBe(201);

        const second = await request(app).post("/api/v1/invitaciones").set(header).send(body);
        expect(second.status).toBe(409);
        expect(second.body.error).toBe("CONFLICT");
    });
});
