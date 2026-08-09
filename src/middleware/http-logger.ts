import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";
import { getRequestId } from "../core/async-context.js";

export const httpLogger = pinoHttp({
    level: env.LOG_LEVEL,
    genReqId: () => getRequestId() ?? randomUUID(),
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "req.body.password",
            "req.body.token",
            "res.headers['set-cookie']",
        ],
        censor: "[REDACTED]",
    },
    ...(env.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
});