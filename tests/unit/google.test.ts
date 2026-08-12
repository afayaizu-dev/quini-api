import { describe, expect, test } from "vitest";
import type { TokenPayload } from "google-auth-library";
import { createAuthorizationRequest, extractProfile } from "../../src/modules/auth/google.js";
import { UnauthorizedError } from "../../src/core/errors.js";

function fakeTokenPayload(overrides: Partial<TokenPayload> = {}): TokenPayload {
    return {
        iss: "https://accounts.google.com",
        sub: "google-sub-123",
        aud: "test-google-client-id",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        email_verified: true,
        email: "usuario@test.local",
        name: "Usuario de Prueba",
        ...overrides,
    };
}

describe("createAuthorizationRequest", () => {
    test("genera una URL de autorización con PKCE y los parámetros esperados", async () => {
        const request = await createAuthorizationRequest();

        const url = new URL(request.url);
        expect(url.searchParams.get("client_id")).toBe("test-google-client-id");
        expect(url.searchParams.get("scope")).toContain("openid");
        expect(url.searchParams.get("code_challenge_method")).toBe("S256");
        expect(url.searchParams.get("code_challenge")).toBeTruthy();
        expect(url.searchParams.get("state")).toBe(request.state);
        expect(request.codeVerifier).toBeTruthy();
    });

    test("cada llamada genera un state y un codeVerifier distintos", async () => {
        const first = await createAuthorizationRequest();
        const second = await createAuthorizationRequest();

        expect(first.state).not.toBe(second.state);
        expect(first.codeVerifier).not.toBe(second.codeVerifier);
    });
});

describe("extractProfile", () => {
    test("payload válido -> mapea a GoogleProfile", () => {
        const profile = extractProfile(fakeTokenPayload());

        expect(profile).toEqual({
            providerUserId: "google-sub-123",
            email: "usuario@test.local",
            name: "Usuario de Prueba",
        });
    });

    test("sin email -> UnauthorizedError", () => {
        const { email: _email, ...withoutEmail } = fakeTokenPayload();
        expect(() => extractProfile(withoutEmail)).toThrow(UnauthorizedError);
    });

    test("sin nombre -> usa el email como nombre", () => {
        const { name: _name, ...withoutName } = fakeTokenPayload();
        const profile = extractProfile(withoutName);
        expect(profile.name).toBe("usuario@test.local");
    });
});