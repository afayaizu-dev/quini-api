import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { getMe, updateMe, findAll, findById, update } from "./usuarios.controller.js";
import { UpdatePerfilSchema, UsuarioIdParamSchema } from "./usuarios.schemas.js";

export const usuariosRouter = Router();

usuariosRouter.get("/me", requireAuth, getMe);

usuariosRouter.put(
    "/me",
    requireAuth,
    validate({ body: UpdatePerfilSchema }),
    updateMe,
);

usuariosRouter.get("/", requireAuth, requireRole("admin"), findAll);

usuariosRouter.get(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: UsuarioIdParamSchema }),
    findById,
);

usuariosRouter.put(
    "/:id",
    requireAuth,
    requireRole("admin"),
    validate({ params: UsuarioIdParamSchema, body: UpdatePerfilSchema }),
    update,
);