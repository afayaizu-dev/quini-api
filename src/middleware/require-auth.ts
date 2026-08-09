import type { NextFunction, Request, Response } from "express";
import { UnauthorizedError } from "../core/errors.js";
import { verifyAccessToken, type AccessTokenPayload } from "../modules/auth/tokens.js";

declare module "express-serve-static-core" {
    interface Request {
        auth?: AccessTokenPayload;
    }
}

const BEARER_PREFIX = "Bearer ";

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const header = req.header("authorization");

    if (!header || !header.startsWith(BEARER_PREFIX)) {
        throw new UnauthorizedError();
    }

    const token = header.slice(BEARER_PREFIX.length);

    try {
        req.auth = await verifyAccessToken(token);
    } catch {
        throw new UnauthorizedError();
    }

    next();
}