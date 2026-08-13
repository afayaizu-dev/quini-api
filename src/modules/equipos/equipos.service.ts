import { ConflictError, NotFoundError } from "../../core/errors.js";
import { db, type DbOrTx } from "../../db/index.js";
import * as equiposRepository from "./equipos.repository.js";
import type { CreateEquipoInput, UpdateEquipoInput } from "./equipos.schemas.js";

function isUniqueViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === "23503" || cause.code === "23001";
}

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