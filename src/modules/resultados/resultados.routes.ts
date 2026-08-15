import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { findByJornada, upsert, remove } from "./resultados.controller.js";
import { UpsertResultadosSchema } from "./resultados.schemas.js";
import { JornadaNumeroParamSchema, JornadaQuerySchema } from "../jornadas/jornadas.schemas.js";

export const resultadosRouter = Router();

resultadosRouter.get(
    "/:numeroJornada/resultados",
    requireAuth,
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    findByJornada,
);

resultadosRouter.put(
    "/:numeroJornada/resultados",
    requireAuth,
    requireRole("admin"),
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema, body: UpsertResultadosSchema }),
    upsert,
);

resultadosRouter.delete(
    "/:numeroJornada/resultados",
    requireAuth,
    requireRole("admin"),
    validate({ params: JornadaNumeroParamSchema, query: JornadaQuerySchema }),
    remove,
);