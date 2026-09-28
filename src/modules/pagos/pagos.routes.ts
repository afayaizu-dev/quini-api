import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { create, findAll, findMios, remove } from "./pagos.controller.js";
import { CreatePagoSchema, PagosQuerySchema, PagoIdParamSchema } from "./pagos.schemas.js";

export const pagosRouter = Router();

pagosRouter.get("/mios", requireAuth, findMios);

pagosRouter.post(
    "/",
    requireAuth,
    requireRole("admin"),
    validate({ body: CreatePagoSchema }),
    create,
);

pagosRouter.get(
    "/",
    requireAuth,
    validate({ query: PagosQuerySchema }),
    findAll,
);

pagosRouter.delete(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: PagoIdParamSchema }),
    remove,
);

