import { describe, expect, test } from "vitest";
import { loginWithGoogle } from "../../src/modules/auth/auth.service.js";
import { createUser, createOAuthAccount } from "../../src/modules/auth/auth.repository.js";
import { createInvitation } from "../../src/modules/invitations/invitations.repository.js";
import { hashInvitationToken, newInvitationToken } from "../../src/modules/invitations/invitations.service.js";
import { createAdmin } from "../helpers/auth.js";
import { RegistrationNotAllowedError } from "../../src/core/errors.js";

describe("loginWithGoogle (unit, sin HTTP)", () => {
    test("cuenta de Google ya vinculada -> emite tokens para el usuario existente", async () => {
        const user = await createUser({
            email: "ya-vinculado@test.local",
            passwordHash: null,
            nombre: "Ya Vinculado",
            role: "user",
        });
        await createOAuthAccount({
            userId: user.id,
            provider: "google",
            providerUserId: "google-sub-123",
            email: user.email,
        });

        const tokens = await loginWithGoogle(
            { providerUserId: "google-sub-123", email: user.email, name: user.nombre },
            {},
        );

        expect(typeof tokens.access_token).toBe("string");
    });

    test("el email ya existe sin cuenta de Google vinculada -> vincula y emite tokens", async () => {
        const user = await createUser({
            email: "solo-password@test.local",
            passwordHash: null,
            nombre: "Solo Password",
            role: "user",
        });

        const tokens = await loginWithGoogle(
            { providerUserId: "google-sub-456", email: user.email, name: "Nombre de Google" },
            {},
        );

        expect(typeof tokens.access_token).toBe("string");
    });

    test("usuario nuevo con invitación válida -> crea usuario con el rol de la invitación y emite tokens", async () => {
        const admin = await createAdmin();
        const token = newInvitationToken();

        await createInvitation({
            email: "nuevo-por-google@test.local",
            role: "admin",
            tokenHash: hashInvitationToken(token),
            invitedBy: admin.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const tokens = await loginWithGoogle(
            { providerUserId: "google-sub-789", email: "nuevo-por-google@test.local", name: "Nuevo por Google" },
            {},
        );

        expect(typeof tokens.access_token).toBe("string");
    });

    test("usuario nuevo sin invitación -> RegistrationNotAllowedError", async () => {
        await expect(
            loginWithGoogle(
                { providerUserId: "google-sub-000", email: "sin-invitacion@test.local", name: "Nadie" },
                {},
            ),
        ).rejects.toThrow(RegistrationNotAllowedError);
    });
});
