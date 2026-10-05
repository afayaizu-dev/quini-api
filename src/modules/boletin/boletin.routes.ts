import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { requireRole } from "../../middleware/require-role.js";
import { validate } from "../../middleware/validate.js";
import { enviar, prueba } from "./boletin.controller.js";
import { EnviarBoletinSchema } from "./boletin.schemas.js";

export const boletinRouter = Router();

boletinRouter.post("/enviar", requireAuth, requireRole("admin"), validate({ body: EnviarBoletinSchema }), enviar);
boletinRouter.post("/prueba", requireAuth, requireRole("admin"), validate({ body: EnviarBoletinSchema }), prueba);
