import { ConflictError, NotFoundError } from "../../core/errors.js";
import * as usuariosRepository from "./usuarios.repository.js";
import * as pagosService from "../pagos/pagos.service.js";
import type { UpdatePerfilInput } from "./usuarios.schemas.js";
import { isUniqueViolation } from "../../core/error.js";

async function toResponse(usuario: {
    id: string;
    email: string;
    nombre: string;
    apellidos: string | null;
    apodo: string | null;
    telefono: string | null;
    role: string;
    createdAt: Date;
}) {
    const credito = await pagosService.getCredito(usuario.id);
    return { ...usuario, credito };
}

export async function getMe(userId: string) {
    const usuario = await usuariosRepository.findById(userId);
    /* v8 ignore next -- @preserve */
    if (!usuario) throw new NotFoundError("No existe el usuario autenticado.");
    return toResponse(usuario);
}

export async function findAll() {
    const usuarios = await usuariosRepository.findAll();
    return Promise.all(usuarios.map(toResponse));
}

export async function findById(id: string) {
    const usuario = await usuariosRepository.findById(id);
    if (!usuario) throw new NotFoundError(`No existe el usuario ${id}.`);
    return toResponse(usuario);
}

export async function update(id: string, input: UpdatePerfilInput) {
    const existente = await usuariosRepository.findById(id);
    if (!existente) {
        throw new NotFoundError(`No existe el usuario ${id}.`);
    }
    try {
        const usuario = await usuariosRepository.updatePerfil(id, input);
        /* v8 ignore next -- @preserve */
        if (!usuario) throw new Error("No se pudo actualizar el perfil");
        return toResponse(usuario);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isUniqueViolation(err)) {
            throw new ConflictError(`Ya existe un miembro con el apodo '${input.apodo}'.`);
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function updateMe(userId: string, input: UpdatePerfilInput) {
    return update(userId, input);
}                                                                                                                                               