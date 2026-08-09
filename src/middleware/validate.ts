import type { NextFunction, Request, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import type { ZodType } from "zod";

interface ValidateSchemas {
    body?: ZodType;
    params?: ZodType;
    query?: ZodType;
}

export function validate(schemas: ValidateSchemas) {
    return (req: Request, _res: Response, next: NextFunction): void => {
        try {
            if (schemas.body) req.body = schemas.body.parse(req.body);
            if (schemas.params) req.params = schemas.params.parse(req.params) as ParamsDictionary;
            if (schemas.query) req.query = schemas.query.parse(req.query) as ParsedQs;
            next();
        } catch (err) {
            next(err);
        }
    };
}