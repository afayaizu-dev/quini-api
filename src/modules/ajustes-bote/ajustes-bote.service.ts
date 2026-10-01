import { ConflictError, NotFoundError } from "../../core/errors.js";
import * as ajustesBoteRepository from "./ajustes-bote.repository.js";
import type { AjusteBoteFila } from "./ajustes-bote.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as temporadasRepository from "../temporadas/temporadas.repository.js";
import type { CreateAjusteBoteInput } from "./ajustes-bote.schemas.js";

function toResponse(fila: AjusteBoteFila) {
    return {
        id: fila.id,
        temporadaId: fila.temporadaId,
        origenTemporadaId: fila.origenTemporadaId,
        importe: fila.importe,
        motivo: fila.motivo,
        fecha: fila.fecha,
        registradoPor: fila.registradoPor,
        createdAt: fila.createdAt,
    };
}

export async function create(input: CreateAjusteBoteInput, registradoPor: string) {
    const temporada = await temporadasService.resolveTemporada(input.temporada);
    if (!temporada.activa) {
        throw new ConflictError(
            `La temporada '${temporada.codigo}' no está activa: solo se registran ajustes de bote en la temporada activa.`,
        );
    }
    const fila = await ajustesBoteRepository.create({
        importe: input.importe,
        motivo: input.motivo,
        fecha: input.fecha,
        temporadaId: temporada.id,
        registradoPor,
    });
    return toResponse(fila);
}

export async function findAll(temporadaCodigo?: string) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const filas = await ajustesBoteRepository.findByTemporada(temporada.id);
    return filas.map(toResponse);
}

export async function remove(id: string) {
    const existente = await ajustesBoteRepository.findById(id);
    if (!existente) {
        throw new NotFoundError(`No existe el ajuste de bote ${id}.`);
    }
    if (existente.origenTemporadaId !== null) {
        throw new ConflictError(
            "El bote heredado no se puede borrar a mano: se recalcula al activar la temporada.",
        );
    }
    const activa = await temporadasRepository.findActiva();
    if (activa?.id !== existente.temporadaId) {
        throw new ConflictError("Solo se pueden borrar ajustes de bote de la temporada activa.");
    }
    await ajustesBoteRepository.remove(id);
}
