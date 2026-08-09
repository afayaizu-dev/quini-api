
import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as authService from "./auth.service.js";
import type { RevokeRequest, RegisterRequest, TokenRequest } from "./auth.schemas.js";
import type { AccessTokenPayload } from "./tokens.js";

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

    const tokens =
        body.grant_type === "password"
            ? await authService.loginWithPassword(body.username, body.password, clientMeta(req))
            : await authService.refresh(body.refresh_token, clientMeta(req));

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