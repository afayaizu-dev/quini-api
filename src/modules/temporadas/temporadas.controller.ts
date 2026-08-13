import type { Request, Response } from "express";
import * as temporadasService from "./temporadas.service.js";
import type {
    CreateTemporadaInput,
    UpdateTemporadaInput,
    TemporadaCodigoParam,
} from "./temporadas.schemas.js";

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateTemporadaInput;
    const temporada = await temporadasService.create(body);
    res.status(201).json(temporada);
}

export async function findAll(_req: Request, res: Response): Promise<void> {
    const temporadas = await temporadasService.findAll();
    res.status(200).json(temporadas);
}

export async function findByCodigo(req: Request, res: Response): Promise<void> {
    const { codigo } = req.params as TemporadaCodigoParam;
    const temporada = await temporadasService.resolveTemporada(codigo);
    res.status(200).json(temporada);
}

export async function update(req: Request, res: Response): Promise<void> {
    const { codigo } = req.params as TemporadaCodigoParam;
    const body = req.body as UpdateTemporadaInput;
    const temporada = await temporadasService.update(codigo, body);
    res.status(200).json(temporada);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { codigo } = req.params as TemporadaCodigoParam;
    await temporadasService.remove(codigo);
    res.status(204).end();
}

export async function activate(req: Request, res: Response): Promise<void> {
    const { codigo } = req.params as TemporadaCodigoParam;
    const temporada = await temporadasService.activate(codigo);
    res.status(200).json(temporada);
}
