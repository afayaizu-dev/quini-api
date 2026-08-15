import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as apuestasService from "./apuestas.service.js";
import type { CreateApuestaInput, UpdateApuestaInput, ApuestaNumeroParam } from "./apuestas.schemas.js";
import type { JornadaNumeroParam, JornadaQuery } from "../jornadas/jornadas.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function create(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as CreateApuestaInput;
    const auth = requireAuthContext(req);

    const apuesta = await apuestasService.create(numeroJornada, temporada, body, auth);

    const location = temporada
        ? `/api/v1/jornadas/${numeroJornada}/apuestas/${apuesta.numeroApuesta}?temporada=${temporada}`
        : `/api/v1/jornadas/${numeroJornada}/apuestas/${apuesta.numeroApuesta}`;

    res.status(201).location(location).json(apuesta);
}

export async function findByJornada(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const auth = requireAuthContext(req);

    const lista = await apuestasService.findByJornada(numeroJornada, temporada, auth);
    res.status(200).json(lista);
}

export async function findMias(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const auth = requireAuthContext(req);

    const lista = await apuestasService.findMias(numeroJornada, temporada, auth);
    res.status(200).json(lista);
}

export async function replace(req: Request, res: Response): Promise<void> {
    const { numeroJornada, numeroApuesta } = req.params as unknown as ApuestaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as UpdateApuestaInput;
    const auth = requireAuthContext(req);

    const apuesta = await apuestasService.replace(numeroJornada, temporada, numeroApuesta, body, auth);
    res.status(200).json(apuesta);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { numeroJornada, numeroApuesta } = req.params as unknown as ApuestaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const auth = requireAuthContext(req);

    await apuestasService.remove(numeroJornada, temporada, numeroApuesta, auth);
    res.status(204).end();
}
