import { NotFoundError } from "../../core/errors.js";
import * as ajustesBoteRepository from "./ajustes-bote.repository.js";
import type { AjusteBoteFila } from "./ajustes-bote.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
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
    const temporada = await temporadasService.resolveTemporada();
    const fila = await ajustesBoteRepository.create({
        importe: input.importe,
        motivo: input.motivo,
        fecha: input.fecha,
        temporadaId: temporada.id,
        registradoPor,
    });
    return toResponse(fila);
}

export async function findAll() {
    const filas = await ajustesBoteRepository.findAll();
    return filas.map(toResponse);
}

export async function remove(id: string) {
    const existente = await ajustesBoteRepository.findById(id);
    if (!existente) {
        throw new NotFoundError(`No existe el ajuste de bote ${id}.`);
    }
    await ajustesBoteRepository.remove(id);
}
