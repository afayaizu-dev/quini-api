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
import { pagosRouter } from "./modules/pagos/pagos.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { ajustesBoteRouter } from "./modules/ajustes-bote/ajustes-bote.routes.js";


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
router.use("/pagos", pagosRouter);
router.use("/dashboard", dashboardRouter);
router.use("/ajustes-bote", ajustesBoteRouter);
