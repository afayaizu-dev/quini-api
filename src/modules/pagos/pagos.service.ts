import { NotFoundError } from "../../core/errors.js";
import * as pagosRepository from "./pagos.repository.js";
import * as usuariosRepository from "../usuarios/usuarios.repository.js";
import type { CreatePagoInput, PagosQuery } from "./pagos.schemas.js";

function toResponse(fila: {
    id: string;
    usuarioId: string;
    importe: number;
    fechaPago: string;
    registradoPor: string;
    createdAt: Date;
}) {
    return {
        id: fila.id,
        usuarioId: fila.usuarioId,
        importe: fila.importe,
        fechaPago: fila.fechaPago,
        registradoPor: fila.registradoPor,
        createdAt: fila.createdAt,
    };
}

export async function create(input: CreatePagoInput, registradoPor: string) {
    const usuario = await usuariosRepository.findById(input.usuarioId);
    if (!usuario) {
        throw new NotFoundError(`No existe el usuario ${input.usuarioId}.`);
    }

    const fila = await pagosRepository.create({
        usuarioId: input.usuarioId,
        importe: input.importe,
        fechaPago: input.fechaPago,
        registradoPor,
    });
    return toResponse(fila);
}

export async function findAll(query: PagosQuery) {
    const filas = await pagosRepository.findAll({
        usuarioId: query.usuario,
        desde: query.desde,
        hasta: query.hasta,
    });
    return filas.map(toResponse);
}

export async function findMios(userId: string) {
    const filas = await pagosRepository.findByUsuario(userId);
    return filas.map(toResponse);
}

export async function remove(id: string) {
    const existente = await pagosRepository.findById(id);
    if (!existente) {
        throw new NotFoundError(`No existe el pago ${id}.`);
    }
    await pagosRepository.remove(id);
}

export async function getCredito(usuarioId: string, hastaFecha?: string) {
    return pagosRepository.getCredito(usuarioId, undefined, hastaFecha);
}