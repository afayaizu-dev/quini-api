import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { requestContext } from "../core/async-context.js";

const HEADER = "x-request-id";

export function requestId(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header(HEADER);
    const id = incoming && incoming.trim().length > 0 ? incoming : randomUUID();

    res.setHeader("X-Request-Id", id);
    requestContext.run({ requestId: id }, () => next());
}