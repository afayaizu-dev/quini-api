import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as ajustesBoteService from "./ajustes-bote.service.js";
import type { CreateAjusteBoteInput, AjusteBoteIdParam, AjustesBoteQuery } from "./ajustes-bote.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateAjusteBoteInput;
    const auth = requireAuthContext(req);
    const ajuste = await ajustesBoteService.create(body, auth.userId);
    res.status(201).location(`/api/v1/ajustes-bote/${ajuste.id}`).json(ajuste);
}

export async function findAll(req: Request, res: Response): Promise<void> {
    const { temporada } = req.query as unknown as AjustesBoteQuery;
    const lista = await ajustesBoteService.findAll(temporada);
    res.status(200).json(lista);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { id } = req.params as unknown as AjusteBoteIdParam;
    await ajustesBoteService.remove(id);
    res.status(204).end();
}
