import { rateLimit } from "express-rate-limit";
import { getRequestId } from "../core/async-context.js";

function createRateLimit(limit: number) {
    return rateLimit({
        windowMs: 15 * 60 * 1000,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        handler: (_req, res) => {
            res.status(429).json({
                error: "TOO_MANY_REQUESTS",
                message: "Demasiados intentos. Inténtalo de nuevo en unos minutos.",
                requestId: getRequestId(),
            });
        },
    });
}

export const authRateLimit = createRateLimit(10);
export const invitationRateLimit = createRateLimit(10);
