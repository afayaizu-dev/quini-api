import { Router } from "express";
import { requireAuth } from "../../middleware/require-auth.js";
import { validate } from "../../middleware/validate.js";
import { miembro, jornada, temporada } from "./dashboard.controller.js";
import {
    DashboardMiembroQuerySchema,
    DashboardJornadaQuerySchema,
    DashboardTemporadaQuerySchema,
} from "./dashboard.schemas.js";

export const dashboardRouter = Router();

dashboardRouter.get("/miembro", requireAuth, validate({ query: DashboardMiembroQuerySchema }), miembro);
dashboardRouter.get("/jornada", requireAuth, validate({ query: DashboardJornadaQuerySchema }), jornada);
dashboardRouter.get("/temporada", requireAuth, validate({ query: DashboardTemporadaQuerySchema }), temporada);