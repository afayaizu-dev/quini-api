import type { Request, Response } from "express";
import * as equiposService from "./equipos.service.js";
import type { CreateEquipoInput, UpdateEquipoInput, EquipoIdParam } from "./equipos.schemas.js";

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateEquipoInput;
    const equipo = await equiposService.create(body);
    res.status(201).json(equipo);
}

export async function findAll(_req: Request, res: Response): Promise<void> {
    const equipos = await equiposService.findAll();
    res.status(200).json(equipos);
}

export async function findById(req: Request, res: Response): Promise<void> {
    const { id } = req.params as EquipoIdParam;
    const equipo = await equiposService.findById(id);
    res.status(200).json(equipo);
}

export async function update(req: Request, res: Response): Promise<void> {
    const { id } = req.params as EquipoIdParam;
    const body = req.body as UpdateEquipoInput;
    const equipo = await equiposService.update(id, body);
    res.status(200).json(equipo);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { id } = req.params as EquipoIdParam;
    await equiposService.remove(id);
    res.status(204).end();
}