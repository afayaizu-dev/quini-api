import { describe, expect, test } from "vitest";
import { exchangeGoogleCode, loginWithGoogle } from "../../src/modules/auth/auth.service.js";
import { createUser, createOAuthAccount } from "../../src/modules/auth/auth.repository.js";
import { createInvitation } from "../../src/modules/invitations/invitations.repository.js";
import { hashInvitationToken, newInvitationToken } from "../../src/modules/invitations/invitations.service.js";
import { createAdmin } from "../helpers/auth.js";
import { RegistrationNotAllowedError, UnauthorizedError } from "../../src/core/errors.js";
import { createHandoffCode } from "../../src/modules/auth/google-handoff.js";

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

describe("exchangeGoogleCode (unit, sin HTTP)", () => {
    test("código de handoff válido -> resuelve a los mismos tokens", async () => {
        const tokens = {
            access_token: "access-token",
            token_type: "Bearer" as const,
            expires_in: 900,
            refresh_token: "refresh-token",
        };
        const code = createHandoffCode(tokens);

        await expect(exchangeGoogleCode(code)).resolves.toEqual(tokens);
    });

    test("código de handoff inválido -> UnauthorizedError", async () => {
        await expect(exchangeGoogleCode("codigo-invalido")).rejects.toThrow(UnauthorizedError);
    });
});
