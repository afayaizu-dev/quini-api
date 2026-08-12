import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";
import request from "supertest";
import { app, createAdmin } from "../helpers/auth.js";
import { createInvitation, markInvitationAccepted } from "../../src/modules/invitations/invitations.repository.js";
import { hashInvitationToken, newInvitationToken } from "../../src/modules/invitations/invitations.service.js";
import { db } from "../../src/db/index.js";
import { invitations } from "../../src/db/schema/invitations.js";
import { expectMatchesOpenApiSchema } from "../helpers/openapi.js";

async function createInvitationFixture(overrides: { email?: string; role?: "user" | "admin"; expiresAt?: Date } = {}) {
    const admin = await createAdmin();
    const token = newInvitationToken();

    const invitation = await createInvitation({
        email: overrides.email ?? `invitado-${Date.now()}@test.local`,
        role: overrides.role ?? "user",
        tokenHash: hashInvitationToken(token),
        invitedBy: admin.id,
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return { token, invitation };
}

describe("POST /api/v1/auth/register", () => {
    test("token de invitación válido -> 201 con tokens, usuario creado con el rol de la invitación", async () => {
        const { token } = await createInvitationFixture({ role: "admin" });

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ token, password: "una-contraseña-larga-123456", nombre: "Nuevo Usuario" });

        expect(response.status).toBe(201);
        expect(typeof response.body.access_token).toBe("string");
        expectMatchesOpenApiSchema({ path: "/auth/register", method: "post", status: 201, body: response.body });
    });

    test("token de invitación inexistente -> 404", async () => {
        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ token: "un-token-que-no-existe", password: "una-contraseña-larga-123456", nombre: "Nadie" });

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("NOT_FOUND");
    });

    test("token de invitación ya usada -> 410", async () => {
        const { token, invitation } = await createInvitationFixture();
        await markInvitationAccepted(invitation.id);

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ token, password: "una-contraseña-larga-123456", nombre: "Tarde" });

        expect(response.status).toBe(410);
        expect(response.body.error).toBe("GONE");
    });

    test("token de invitación revocada -> 410", async () => {
        const { token, invitation } = await createInvitationFixture();
        await db.update(invitations).set({ revokedAt: new Date() }).where(eq(invitations.id, invitation.id));

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ token, password: "una-contraseña-larga-123456", nombre: "Revocado" });

        expect(response.status).toBe(410);
    });

    test("token de invitación expirada -> 410", async () => {
        const { token } = await createInvitationFixture({ expiresAt: new Date(Date.now() - 1000) });

        const response = await request(app)
            .post("/api/v1/auth/register")
            .send({ token, password: "una-contraseña-larga-123456", nombre: "Tarde" });

        expect(response.status).toBe(410);
    });
});