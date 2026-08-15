import { ConflictError, NotFoundError } from "../../core/errors.js";;
import * as usuariosRepository from "./usuarios.repository.js";
import type { UpdatePerfilInput } from "./usuarios.schemas.js";
import { isUniqueViolation } from "../../core/error.js";

export async function getMe(userId: string) {
    const usuario = await usuariosRepository.findById(userId);
    /* v8 ignore next -- @preserve */
    if (!usuario) throw new NotFoundError("No existe el usuario autenticado.");
    return usuario;
}

export async function findAll() {
    return usuariosRepository.findAll();
}

export async function findById(id: string) {
    const usuario = await usuariosRepository.findById(id);
    if (!usuario) throw new NotFoundError(`No existe el usuario ${id}.`);
    return usuario;
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
        return usuario;
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