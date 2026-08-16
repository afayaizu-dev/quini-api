import type { Request, Response } from "express";
import * as calculosService from "./calculos.service.js";
import type { EjecutarCalculoInput, CalculoQuery } from "./calculos.schemas.js";

export async function ejecutar(req: Request, res: Response): Promise<void> {
    const body = req.body as EjecutarCalculoInput;
    const resultado = await calculosService.ejecutar(body);
    res.status(200).json(resultado);
}

export async function findByJornada(req: Request, res: Response): Promise<void> {
    const { jornada, temporada } = req.query as unknown as CalculoQuery;
    const resultado = await calculosService.findByJornada(jornada, temporada);
    res.status(200).json(resultado);
}