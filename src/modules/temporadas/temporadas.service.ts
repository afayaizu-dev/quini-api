import { ConflictError, NotFoundError } from "../../core/errors.js";
import { db, type DbOrTx } from "../../db/index.js";
import * as ajustesBoteRepository from "../ajustes-bote/ajustes-bote.repository.js";
import * as dashboardRepository from "../dashboard/dashboard.repository.js";
import * as temporadasRepository from "./temporadas.repository.js";
import type { CreateTemporadaInput, UpdateTemporadaInput } from "./temporadas.schemas.js";
import { isUniqueViolation, isForeignKeyViolation } from "../../core/error.js";




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

interface TemporadaRef {
    id: string;
    codigo: string;
    fechaInicio: string;
}

// Crea (o recalcula, si ya existe) el ajuste "Bote heredado de <anterior>" en la nueva temporada.
async function registrarBoteHeredado(
    anterior: TemporadaRef,
    nueva: TemporadaRef,
    registradoPor: string,
    tx: DbOrTx,
) {
    const datos = {
        importe: await dashboardRepository.boteTemporada(anterior.id, tx),
        motivo: `Bote heredado de ${anterior.codigo}`,
        fecha: nueva.fechaInicio,
        temporadaId: nueva.id,
        origenTemporadaId: anterior.id,
        registradoPor,
    };
    const existente = await ajustesBoteRepository.findHeredado(nueva.id, tx);
    if (existente) {
        await ajustesBoteRepository.updateHeredado(existente.id, datos, tx);
    } else {
        await ajustesBoteRepository.create(datos, tx);
    }
}

export async function activate(codigo: string, registradoPor: string) {
    return db.transaction(async (tx) => {
        const nueva = await resolveTemporada(codigo, tx);
        const anterior = await temporadasRepository.findActiva(tx);
        const activada = await temporadasRepository.activate(codigo, tx);
        // Solo se hereda hacia delante: re-activar la misma o una temporada más antigua no toca heredados.
        if (anterior && anterior.id !== nueva.id && anterior.fechaInicio < nueva.fechaInicio) {
            await registrarBoteHeredado(anterior, nueva, registradoPor, tx);
        }
        return activada;
    });
}
