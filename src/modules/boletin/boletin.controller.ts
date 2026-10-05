import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as boletinService from "./boletin.service.js";
import type { EnviarBoletinInput } from "./boletin.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function enviar(req: Request, res: Response): Promise<void> {
    const body = req.body as EnviarBoletinInput;
    const resultado = await boletinService.enviarBoletin(body.subject, body.html);
    res.status(200).json(resultado);
}

export async function prueba(req: Request, res: Response): Promise<void> {
    const auth = requireAuthContext(req);
    const body = req.body as EnviarBoletinInput;
    const resultado = await boletinService.enviarPrueba(auth.email, body.subject, body.html);
    res.status(200).json(resultado);
}
