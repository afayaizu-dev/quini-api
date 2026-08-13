import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, findAll, findByNumero, replace, remove } from "./jornadas.controller.js";
import {
    CreateJornadaSchema,
    UpdateJornadaSchema,
    JornadaNumeroParamSchema,
    JornadaQuerySchema,
} from "./jornadas.schemas.js";

export const jornadasRouter = Router();

jornadasRouter.get(
    "/",
    requireAuth,
    validate({ query: JornadaQuerySchema }),
    findAll,
);

jornadasRouter.get(
    "/:numeroJornada",
    requireAuth,
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    findByNumero,
);

jornadasRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: CreateJornadaSchema }),
    create,
);

jornadasRouter.put(
    "/:numeroJornada",
    requireAuth,
    requireRole("admin"),
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema, body: UpdateJornadaSchema }),
    replace,
);

jornadasRouter.delete(
    "/:numeroJornada",
    requireAuth,
    requireRole("admin"),
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    remove,
);