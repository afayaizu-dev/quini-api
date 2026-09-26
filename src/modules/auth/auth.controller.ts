
import type { Request, Response } from "express";
import { RegistrationNotAllowedError, UnauthorizedError } from "../../core/errors.js";
import * as authService from "./auth.service.js";
import type { RevokeRequest, RegisterRequest, TokenRequest } from "./auth.schemas.js";
import type { AccessTokenPayload } from "./tokens.js";
import { env } from "../../config/env.js";
import * as googleAuth from "./google.js";
import { createHandoffCode } from "./google-handoff.js";
import type { GoogleIdTokenRequest } from "./auth.schemas.js";



const GOOGLE_STATE_COOKIE = "google_oauth";
const GOOGLE_STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

function clientMeta(req: Request): { userAgent?: string; ip?: string } {
    const userAgent = req.header("user-agent");
    return {
        ...(userAgent !== undefined ? { userAgent } : {}),
        ...(req.ip !== undefined ? { ip: req.ip } : {}),
    };
}

function requireAuthContext(req: Request): AccessTokenPayload {
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function token(req: Request, res: Response): Promise<void> {
    const body = req.body as TokenRequest;

    let tokens;
    if (body.grant_type === "password") {
        tokens = await authService.loginWithPassword(body.username, body.password, clientMeta(req));
    } else if (body.grant_type === "refresh_token") {
        tokens = await authService.refresh(body.refresh_token, clientMeta(req));
    } else {
        tokens = await authService.exchangeGoogleCode(body.code);
    }

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(tokens);
}

export async function revoke(req: Request, res: Response): Promise<void> {
    const body = req.body as RevokeRequest;
    await authService.revoke(body.refresh_token);
    res.status(204).end();
}

export async function logout(req: Request, res: Response): Promise<void> {
    const auth = requireAuthContext(req);
    await authService.logoutAll(auth.userId);
    res.status(204).end();
}

export function me(req: Request, res: Response): void {
    const auth = requireAuthContext(req);
    res.status(200).json(auth);
}

export async function register(req: Request, res: Response): Promise<void> {
    const body = req.body as RegisterRequest;
    const tokens = await authService.registerWithInvitation(body, clientMeta(req));
    res.setHeader("Cache-Control", "no-store");
    res.status(201).json(tokens);
}


/* v8 ignore start -- @preserve */
export async function googleAuthorize(_req: Request, res: Response): Promise<void> {
    const { url, state, codeVerifier } = await googleAuth.createAuthorizationRequest();

    res.cookie(GOOGLE_STATE_COOKIE, JSON.stringify({ state, codeVerifier }), {
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        signed: true,
        maxAge: GOOGLE_STATE_COOKIE_MAX_AGE_MS,
    });

    res.redirect(url);
}

export async function googleCallback(req: Request, res: Response): Promise<void> {
    const { code, state } = req.query as { code?: string; state?: string };
    const stored = req.signedCookies[GOOGLE_STATE_COOKIE] as string | undefined;

    res.clearCookie(GOOGLE_STATE_COOKIE);

    if (!code || !state || !stored) {
        res.redirect(`${env.PUBLIC_APP_URL}/login?google_error=invalid_request`);
        return;
    }

    const { state: storedState, codeVerifier } = JSON.parse(stored) as { state: string; codeVerifier: string };

    if (state !== storedState) {
        res.redirect(`${env.PUBLIC_APP_URL}/login?google_error=invalid_request`);
        return;
    }

    try {
        const profile = await googleAuth.exchangeCodeForProfile(code, codeVerifier);
        const tokens = await authService.loginWithGoogle(profile, clientMeta(req));

        const handoffCode = createHandoffCode(tokens);
        res.redirect(`${env.PUBLIC_APP_URL}/login?google_code=${handoffCode}`);
    } catch (error) {
        if (error instanceof RegistrationNotAllowedError) {
            res.redirect(`${env.PUBLIC_APP_URL}/login?google_error=registration_not_allowed`);
            return;
        }
        res.redirect(`${env.PUBLIC_APP_URL}/login?google_error=google_auth_failed`);
    }
}

export async function googleIdToken(req: Request, res: Response): Promise<void> {
    const body = req.body as GoogleIdTokenRequest;
    const profile = await googleAuth.verifyGoogleIdToken(body.id_token);
    const tokens = await authService.loginWithGoogle(profile, clientMeta(req));

    res.setHeader("Cache-Control", "no-store");
    res.status(200).json(tokens);
}
/* v8 ignore stop -- @preserve */