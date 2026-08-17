import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as dashboardService from "./dashboard.service.js";
import type { DashboardMiembroQuery, DashboardJornadaQuery, DashboardTemporadaQuery } from "./dashboard.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function miembro(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as DashboardMiembroQuery;
    const auth = requireAuthContext(req);
    const resultado = await dashboardService.miembro(query, auth);
    res.status(200).json(resultado);
}

export async function jornada(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as DashboardJornadaQuery;
    const resultado = await dashboardService.jornada(query);
    res.status(200).json(resultado);
}

export async function temporada(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as DashboardTemporadaQuery;
    const resultado = await dashboardService.temporada(query);
    res.status(200).json(resultado);
}