import type { NextFunction, Request, Response } from "express";
import { ForbiddenError } from "../core/errors.js";

export function requireRole(role: "user" | "admin") {
    return (req: Request, _res: Response, next: NextFunction): void => {
        if (req.auth?.role !== role) {
            throw new ForbiddenError();
        }
        next();
    };
}