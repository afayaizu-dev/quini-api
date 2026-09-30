import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, findAll, remove } from "./ajustes-bote.controller.js";
import { CreateAjusteBoteSchema, AjusteBoteIdParamSchema } from "./ajustes-bote.schemas.js";

export const ajustesBoteRouter = Router();

ajustesBoteRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: CreateAjusteBoteSchema }),
    create,
);

ajustesBoteRouter.get("/", requireAuth, findAll);

ajustesBoteRouter.delete(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: AjusteBoteIdParamSchema }),
    remove,
);
