import type { Request, Response } from "express";
import * as boletinService from "./boletin.service.js";
import type { EnviarBoletinInput } from "./boletin.schemas.js";

export async function enviar(req: Request, res: Response): Promise<void> {
    const body = req.body as EnviarBoletinInput;
    const resultado = await boletinService.enviarBoletin(body.subject, body.html);
    res.status(200).json(resultado);
}
