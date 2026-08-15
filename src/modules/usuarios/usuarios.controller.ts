import type { Request, Response } from "express";
import { UnauthorizedError } from "../../core/errors.js";
import * as usuariosService from "./usuarios.service.js";
import type { UpdatePerfilInput, UsuarioIdParam } from "./usuarios.schemas.js";

function requireAuthContext(req: Request) {
    /* v8 ignore next -- @preserve */
    if (!req.auth) {
        throw new UnauthorizedError();
    }
    return req.auth;
}

export async function getMe(req: Request, res: Response): Promise<void> {
    const auth = requireAuthContext(req);
    const usuario = await usuariosService.getMe(auth.userId);
    res.status(200).json(usuario);
}

export async function updateMe(req: Request, res: Response): Promise<void> {
    const auth = requireAuthContext(req);
    const body = req.body as UpdatePerfilInput;
    const usuario = await usuariosService.updateMe(auth.userId, body);
    res.status(200).json(usuario);
}

export async function findAll(_req: Request, res: Response): Promise<void> {
    const usuarios = await usuariosService.findAll();
    res.status(200).json(usuarios);
}

export async function findById(req: Request, res: Response): Promise<void> {
    const { id } = req.params as UsuarioIdParam;
    const usuario = await usuariosService.findById(id);
    res.status(200).json(usuario);
}

export async function update(req: Request, res: Response): Promise<void> {
    const { id } = req.params as UsuarioIdParam;
    const body = req.body as UpdatePerfilInput;
    const usuario = await usuariosService.update(id, body);
    res.status(200).json(usuario);
}