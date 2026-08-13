import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, findAll, findById, update, remove } from "./equipos.controller.js";
import { CreateEquipoSchema, UpdateEquipoSchema, EquipoIdParamSchema } from "./equipos.schemas.js";

export const equiposRouter = Router();

equiposRouter.get("/", requireAuth, findAll);

equiposRouter.get(
    "/:id",
    requireAuth,
    validate({ params: EquipoIdParamSchema }),
    findById,
);

equiposRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: CreateEquipoSchema }),
    create,
);

equiposRouter.put(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: EquipoIdParamSchema, body: UpdateEquipoSchema }),
    update,
);

equiposRouter.delete(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: EquipoIdParamSchema }),
    remove,
);