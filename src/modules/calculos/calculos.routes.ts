import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { ejecutar, findByJornada } from "./calculos.controller.js";
import { EjecutarCalculoSchema, CalculoQuerySchema } from "./calculos.schemas.js";

export const calculosRouter = Router();

calculosRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: EjecutarCalculoSchema }),
    ejecutar,
);

calculosRouter.get(
    "/",
    requireAuth,
    validate({ query: CalculoQuerySchema }),
    findByJornada,
);
