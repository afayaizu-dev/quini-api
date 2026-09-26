import { ConflictError, ForbiddenError, NotFoundError } from "../../core/errors.js";
import { isUniqueViolation } from "../../core/error.js";
import * as apuestasRepository from "./apuestas.repository.js";
import * as jornadasService from "../jornadas/jornadas.service.js";
import * as usuariosService from "../usuarios/usuarios.service.js";
import type { ApuestaColumnas, ApuestaFila } from "./apuestas.repository.js";
import type { CreateApuestaInput, UpdateApuestaInput } from "./apuestas.schemas.js";

interface AuthContext {
    userId: string;
    role: string;
}

function partidoEn(partidos: string[], indice: number): string {
    const valor = partidos[indice];
    /* v8 ignore next -- @preserve */
    if (valor === undefined) throw new Error(`Falta el partido ${indice + 1} de la apuesta.`);
    return valor;
}

function toColumnas(input: { partidos: string[]; sugerenciaPleno15?: string | undefined }): ApuestaColumnas {

    return {
        partido1: partidoEn(input.partidos, 0),
        partido2: partidoEn(input.partidos, 1),
        partido3: partidoEn(input.partidos, 2),
        partido4: partidoEn(input.partidos, 3),
        partido5: partidoEn(input.partidos, 4),
        partido6: partidoEn(input.partidos, 5),
        partido7: partidoEn(input.partidos, 6),
        partido8: partidoEn(input.partidos, 7),
        partido9: partidoEn(input.partidos, 8),
        partido10: partidoEn(input.partidos, 9),
        partido11: partidoEn(input.partidos, 10),
        partido12: partidoEn(input.partidos, 11),
        partido13: partidoEn(input.partidos, 12),
        partido14: partidoEn(input.partidos, 13),
        sugerenciaPleno15: input.sugerenciaPleno15 ?? null,
    };
}


function toResponse(fila: ApuestaFila) {
    return {
        id: fila.id,
        numeroApuesta: fila.numeroApuesta,
        partidos: [
            fila.partido1, fila.partido2, fila.partido3, fila.partido4, fila.partido5,
            fila.partido6, fila.partido7, fila.partido8, fila.partido9, fila.partido10,
            fila.partido11, fila.partido12, fila.partido13, fila.partido14,
        ],
        sugerenciaPleno15: fila.sugerenciaPleno15,
        usuarioId: fila.usuarioId,
        creadaPorElMismo: fila.creadaPorElMismo ?? (fila.creadaPor === fila.usuarioId),
        createdAt: fila.createdAt,
        updatedAt: fila.updatedAt,
    };
}


export async function create(
    numeroJornada: number,
    temporadaCodigo: string | undefined,
    input: CreateApuestaInput,
    auth: AuthContext,
) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    jornadasService.assertApuestasAbiertas(jornada, auth);
    const usuarioId = await usuariosService.resolveUsuarioObjetivo(auth, input.usuarioId);
    if (input.creadaPorElMismo !== undefined && auth.role !== "admin") {
        throw new ForbiddenError();
    }

    try {
        const fila = await apuestasRepository.create({
            jornadaId: jornada.id,
            usuarioId,
            numeroApuesta: input.numeroApuesta,
            creadaPor: auth.userId,
            ...toColumnas(input),
            ...(input.creadaPorElMismo !== undefined && { creadaPorElMismo: input.creadaPorElMismo }),
        });
        return toResponse(fila);
    } catch (err) {
        if (isUniqueViolation(err)) {
            throw new ConflictError(`Ya existe la apuesta ${input.numeroApuesta} de este usuario para la jornada ${numeroJornada}.`);
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function findByJornada(numeroJornada: number, temporadaCodigo: string | undefined, auth: AuthContext) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    if (auth.role !== "admin" && jornada.apuestasAbiertas) {
        throw new ForbiddenError();
    }
    const filas = await apuestasRepository.findByJornada(jornada.id);
    return filas.map((fila) => toResponse(fila));
}

export async function findMias(numeroJornada: number, temporadaCodigo: string | undefined, auth: AuthContext) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    const filas = await apuestasRepository.findByJornadaYUsuario(jornada.id, auth.userId);
    return filas.map((fila) => toResponse(fila));
}

export async function replace(
    numeroJornada: number,
    temporadaCodigo: string | undefined,
    numeroApuesta: number,
    input: UpdateApuestaInput,
    auth: AuthContext,
) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    jornadasService.assertApuestasAbiertas(jornada, auth);
    const usuarioId = await usuariosService.resolveUsuarioObjetivo(auth, input.usuarioId);
    if (input.creadaPorElMismo !== undefined && auth.role !== "admin") {
        throw new ForbiddenError();
    }

    const existente = await apuestasRepository.findOne(jornada.id, usuarioId, numeroApuesta);
    if (!existente) {
        throw new NotFoundError(`No existe la apuesta ${numeroApuesta} de este usuario para la jornada ${numeroJornada}.`);
    }

    const fila = await apuestasRepository.replace(existente.id, toColumnas(input), input.creadaPorElMismo);
    return toResponse(fila);
}

export async function remove(
    numeroJornada: number,
    temporadaCodigo: string | undefined,
    numeroApuesta: number,
    auth: AuthContext,
) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    jornadasService.assertApuestasAbiertas(jornada);

    const existente = await apuestasRepository.findOne(jornada.id, auth.userId, numeroApuesta);
    if (!existente) {
        throw new NotFoundError(`No existe la apuesta ${numeroApuesta} para la jornada ${numeroJornada}.`);
    }

    await apuestasRepository.remove(existente.id);
}