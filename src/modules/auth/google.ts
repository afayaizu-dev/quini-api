import { randomBytes } from "node:crypto";
import { CodeChallengeMethod, OAuth2Client, type TokenPayload } from "google-auth-library";
import { env } from "../../config/env.js";
import { UnauthorizedError } from "../../core/errors.js";

interface GoogleConfig {
    client: OAuth2Client;
    clientId: string;
}

function requireGoogleConfig(): GoogleConfig {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const redirectUri = env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error("Faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI en .env");
    }

    return { client: new OAuth2Client({ clientId, clientSecret, redirectUri }), clientId };
}

export interface AuthorizationRequest {
    url: string;
    state: string;
    codeVerifier: string;
}

export async function createAuthorizationRequest(): Promise<AuthorizationRequest> {
    const { client } = requireGoogleConfig();
    const state = randomBytes(32).toString("base64url");
    const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();

    if (!codeChallenge) {
        throw new Error("No se pudo generar el code_challenge de PKCE.");
    }

    const url = client.generateAuthUrl({
        access_type: "online",
        // Sin esto Google entra en silencio con la cuenta activa del navegador,
        // que puede no ser la del socio cuando hay varias sesiones abiertas.
        prompt: "select_account",
        scope: ["openid", "email", "profile"],
        state,
        code_challenge: codeChallenge,
        code_challenge_method: CodeChallengeMethod.S256,
    });

    return { url, state, codeVerifier };
}

export interface GoogleProfile {
    providerUserId: string;
    email: string;
    name: string;
}

export function extractProfile(payload: TokenPayload): GoogleProfile {
    if (payload.email_verified !== true) {
        throw new UnauthorizedError("El email de Google no está verificado.");
    }
    if (!payload.email) {
        throw new UnauthorizedError("Google no devolvió un email.");
    }
    return { providerUserId: payload.sub, email: payload.email, name: payload.name ?? payload.email };
}

/* v8 ignore start -- @preserve */
export async function exchangeCodeForProfile(code: string, codeVerifier: string): Promise<GoogleProfile> {
    const { client, clientId } = requireGoogleConfig();

    let tokenResponse;
    try {
        tokenResponse = await client.getToken({ code, codeVerifier });
    } catch {
        throw new UnauthorizedError("Código de Google inválido o caducado.");
    }

    const idToken = tokenResponse.tokens.id_token;
    if (!idToken) {
        throw new UnauthorizedError("Google no devolvió un id_token.");
    }

    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload) {
        throw new UnauthorizedError("No se pudo verificar el id_token de Google.");
    }
    return extractProfile(payload);
}

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleProfile> {
    const { client, clientId } = requireGoogleConfig();
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload) {
        throw new UnauthorizedError("No se pudo verificar el id_token de Google.");
    }
    return extractProfile(payload);
}


/* v8 ignore stop -- @preserve */