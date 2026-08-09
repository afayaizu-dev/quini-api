import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../core/errors.js";
import { getRequestId } from "../core/async-context.js";

export function errorHandler(
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const requestId = getRequestId();

    if (err instanceof AppError) {
        res.status(err.status).json({
            error: err.code,
            message: err.message,
            ...(err.details ? { details: err.details } : {}),
            requestId,
        });
        return;
    }

    if (err instanceof ZodError) {
        res.status(400).json({
            error: "VALIDATION_ERROR",
            message: "Los datos enviados no son válidos.",
            details: err.issues.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
            requestId,
        });
        return;
    }

    // JSON malformado: body-parser lanza SyntaxError con status 400
    if (err instanceof SyntaxError && (err as { status?: number }).status === 400) {
        res.status(400).json({
            error: "VALIDATION_ERROR",
            message: "El cuerpo de la petición no es JSON válido.",
            requestId,
        });
        return;
    }

    req.log?.error({ err }, "Error inesperado");
    res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Ha ocurrido un error inesperado.",
        requestId,
    });
}