import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as jornadasService from "./jornadas.service.js";
import type {
    CreateJornadaInput,
    UpdateJornadaInput,
    JornadaNumeroParam,
    JornadaQuery,
    FechasJornadaInput,
    PlenoJornadaInput,
} from "./jornadas.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateJornadaInput;
    const auth = requireAuthContext(req);
    const jornada = await jornadasService.create(body, auth.userId);

    const location = body.temporada
        ? `/api/v1/jornadas/${jornada.numeroJornada}?temporada=${jornada.temporada}`
        : `/api/v1/jornadas/${jornada.numeroJornada}`;

    res.status(201).location(location).json(jornada);
}

export async function findAll(req: Request, res: Response): Promise<void> {
    const { temporada } = req.query as unknown as JornadaQuery;
    const lista = await jornadasService.findAll(temporada);
    res.status(200).json(lista);
}

export async function findByNumero(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const jornada = await jornadasService.findByNumero(numeroJornada, temporada);
    res.status(200).json(jornada);
}

export async function replace(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as UpdateJornadaInput;
    const jornada = await jornadasService.replace(numeroJornada, temporada, body);
    res.status(200).json(jornada);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    await jornadasService.remove(numeroJornada, temporada);
    res.status(204).end();
}

export async function updateFechas(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as FechasJornadaInput;
    const jornada = await jornadasService.updateFechas(numeroJornada, temporada, body);
    res.status(200).json(jornada);
}

export async function cerrarApuestas(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const jornada = await jornadasService.cerrarApuestas(numeroJornada, temporada);
    res.status(200).json(jornada);
}

export async function updatePleno(req: Request, res: Response): Promise<void> {
    const { numeroJornada } = req.params as unknown as JornadaNumeroParam;
    const { temporada } = req.query as unknown as JornadaQuery;
    const body = req.body as PlenoJornadaInput;
    const jornada = await jornadasService.updatePleno(numeroJornada, temporada, body);
    res.status(200).json(jornada);
}