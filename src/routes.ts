import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { invitationsRouter } from "./modules/invitations/invitations.routes.js";
import { temporadasRouter } from "./modules/temporadas/temporadas.routes.js";
import { equiposRouter } from "./modules/equipos/equipos.routes.js";

export const router = Router();

router.use("/auth", authRouter);
router.use("/invitaciones", invitationsRouter);
router.use("/temporadas", temporadasRouter);
router.use("/equipos", equiposRouter);