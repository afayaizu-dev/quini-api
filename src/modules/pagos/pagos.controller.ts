import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as pagosService from "./pagos.service.js";
import type { CreatePagoInput, PagosQuery, PagoIdParam } from "./pagos.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreatePagoInput;
    const auth = requireAuthContext(req);
    const pago = await pagosService.create(body, auth.userId);
    res.status(201).location(`/api/v1/pagos/${pago.id}`).json(pago);
}

export async function findAll(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as PagosQuery;
    const lista = await pagosService.findAll(query);
    res.status(200).json(lista);
}

export async function findMios(req: Request, res: Response): Promise<void> {
    const auth = requireAuthContext(req);
    const lista = await pagosService.findMios(auth.userId);
    res.status(200).json(lista);
}

export async function remove(req: Request, res: Response): Promise<void> {
    const { id } = req.params as unknown as PagoIdParam;
    await pagosService.remove(id);
    res.status(204).end();
}