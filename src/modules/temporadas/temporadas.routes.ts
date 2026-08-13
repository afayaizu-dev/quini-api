import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, findAll, findByCodigo, update, remove, activate } from "./temporadas.controller.js";
import {
    CreateTemporadaSchema,
    UpdateTemporadaSchema,
    TemporadaCodigoParamSchema,
} from "./temporadas.schemas.js";

export const temporadasRouter = Router();

temporadasRouter.get("/", requireAuth, findAll);

temporadasRouter.get(
    "/:codigo",
    requireAuth,
    validate({ params: TemporadaCodigoParamSchema }),
    findByCodigo,
);

temporadasRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: CreateTemporadaSchema }),
    create,
);

temporadasRouter.put(
    "/:codigo",
    requireAuth,
    requireRole("admin"),
    validate({ params: TemporadaCodigoParamSchema, body: UpdateTemporadaSchema }),
    update,
);

temporadasRouter.delete(
    "/:codigo",
    requireAuth,
    requireRole("admin"),
    validate({ params: TemporadaCodigoParamSchema }),
    remove,
);

temporadasRouter.post(
    "/:codigo/activar",
    requireAuth,
    requireRole("admin"),
    validate({ params: TemporadaCodigoParamSchema }),
    activate,
);
