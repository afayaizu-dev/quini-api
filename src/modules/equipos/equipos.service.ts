import { ConflictError, NotFoundError } from "../../core/errors.js";
import { db, type DbOrTx } from "../../db/index.js";
import * as equiposRepository from "./equipos.repository.js";
import type { CreateEquipoInput, UpdateEquipoInput } from "./equipos.schemas.js";
import { isUniqueViolation, isForeignKeyViolation } from "../../core/error.js";



export async function resolveEquipo(nombreLargo: string, tx: DbOrTx = db) {
    const equipo = await equiposRepository.findByNombreLargo(nombreLargo, tx);
    if (!equipo) {
        throw new NotFoundError(`No existe el equipo '${nombreLargo}'.`);
    }
    return equipo;
}

export async function create(input: CreateEquipoInput) {
    try {
        return await equiposRepository.create(input);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isUniqueViolation(err)) {
            throw new ConflictError(`Ya existe un equipo con el nombre '${input.nombreLargo}'.`);
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function findAll() {
    return equiposRepository.findAll();
}

export async function findById(id: string) {
    const equipo = await equiposRepository.findById(id);
    if (!equipo) {
        throw new NotFoundError(`No existe un equipo con id '${id}'.`);
    }
    return equipo;
}

export async function update(id: string, input: UpdateEquipoInput) {
    await findById(id);
    try {
        return await equiposRepository.update(id, input);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isUniqueViolation(err)) {
            throw new ConflictError(`Ya existe un equipo con el nombre '${input.nombreLargo}'.`);
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function remove(id: string) {
    await findById(id);
    try {
        await equiposRepository.remove(id);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isForeignKeyViolation(err)) {
            throw new ConflictError("No se puede borrar un asociados.");
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}