import { Router } from "express";
import { authRouter } from "./modules/auth/auth.routes.js";
import { invitationsRouter } from "./modules/invitations/invitations.routes.js";
import { temporadasRouter } from "./modules/temporadas/temporadas.routes.js";
import { equiposRouter } from "./modules/equipos/equipos.routes.js";
import { jornadasRouter } from "./modules/jornadas/jornadas.routes.js";
import { usuariosRouter } from "./modules/usuarios/usuarios.routes.js";
import { resultadosRouter } from "./modules/resultados/resultados.routes.js";
import { apuestasRouter } from "./modules/apuestas/apuestas.routes.js";
import { calculosRouter } from "./modules/calculos/calculos.routes.js";


export const router = Router();

router.use("/auth", authRouter);
router.use("/invitaciones", invitationsRouter);
router.use("/temporadas", temporadasRouter);
router.use("/equipos", equiposRouter);
router.use("/jornadas", jornadasRouter);
router.use("/usuarios", usuariosRouter);
router.use("/jornadas", resultadosRouter);
router.use("/jornadas", apuestasRouter);
router.use("/calculos", calculosRouter);
