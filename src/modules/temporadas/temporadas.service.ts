import { ConflictError, NotFoundError } from "../../core/errors.js";
import { db, type DbOrTx } from "../../db/index.js";
import * as temporadasRepository from "./temporadas.repository.js";
import type { CreateTemporadaInput, UpdateTemporadaInput } from "./temporadas.schemas.js";



/* 
    El error 23505 de postgres indica que se ha violado una restricción de unicidad (unique constraint violation).
    "code" in cause  verifica que el objeto cause tiene la propiedad "
    
*/
function isUniqueViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === "23503" || cause.code === "23001";
}

export async function resolveTemporada(codigo?: string, tx: DbOrTx = db) {
    const temporada = codigo
        ? await temporadasRepository.findByCodigo(codigo, tx)
        : await temporadasRepository.findActiva(tx);

    /* v8 ignore next -- @preserve */
    if (!temporada) {
        throw new NotFoundError(
            codigo ? `No existe la temporada '${codigo}'.` : "No hay ninguna temporada activa.",
        );
    }
    return temporada;
}

export async function create(input: CreateTemporadaInput) {
    try {
        return await temporadasRepository.create(input);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isUniqueViolation(err)) {
            throw new ConflictError(`Ya existe una temporada con el código '${input.codigo}'.`);
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function findAll() {
    return temporadasRepository.findAll();
}

export async function update(codigo: string, input: UpdateTemporadaInput) {
    await resolveTemporada(codigo);
    return temporadasRepository.update(codigo, input);
}

export async function remove(codigo: string) {
    await resolveTemporada(codigo);
    try {
        await temporadasRepository.remove(codigo);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isForeignKeyViolation(err)) {
            throw new ConflictError("No se puede borrar una temporada que tiene jornadas asociadas.");
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function activate(codigo: string) {
    return db.transaction(async (tx) => {
        await resolveTemporada(codigo, tx);
        return temporadasRepository.activate(codigo, tx);
    });
}