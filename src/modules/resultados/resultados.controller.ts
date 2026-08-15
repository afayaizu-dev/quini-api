import type { Request, Response } from "express";
import * as resultadosService from "./resultados.service.js";
import type { UpsertResultadosInput } from "./resultados.schemas.js";
import type { JornadaNumeroParam, JornadaQuery } from "../jornadas/jornadas.schemas.js";

export async function findByJornada(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const resultado = await resultadosService.findByJornada(numeroJornada, temporada);
    res.status(200).json(resultado);
}

export async function upsert(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as UpsertResultadosInput;
    const { resultado, creado } = await resultadosService.upsert(numeroJornada, temporada, body);

    if (creado) {
        const location = temporada
            ? `/api/v1/jornadas/${numeroJornada}/resultados?temporada=${temporada}`
            : `/api/v1/jornadas/${numeroJornada}/resultados`;
        res.status(201).location(location).json(resultado);
        return;
    }
    res.status(200).json(resultado);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    await resultadosService.remove(numeroJornada, temporada);
    res.status(204).end();
}