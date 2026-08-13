import { ConflictError, NotFoundError } from "../../core/errors.js";
import * as jornadasRepository from "./jornadas.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as equiposService from "../equipos/equipos.service.js";
import type { CreateJornadaInput, UpdateJornadaInput, PartidoInput } from "./jornadas.schemas.js";

function isUniqueViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === "23505";
}

async function resolvePartidos(partidosInput: PartidoInput[]) {
    return Promise.all(
        partidosInput.map(async (p) => {
            const [local, visitante] = await Promise.all([
                equiposService.resolveEquipo(p.equipoLocal),
                equiposService.resolveEquipo(p.equipoVisitante),
            ]);
            return { orden: p.orden, equipoLocalId: local.id, equipoVisitanteId: visitante.id };
        }),
    );
}

function toResponse(
    temporadaCodigo: string,
    jornada: {
        id: string;
        numeroJornada: number;
        fecha: string;
        createdAt: Date;
        updatedAt: Date;
        partidos: { id: string; orden: number; equipoLocalId: string; equipoVisitanteId: string }[];
    },
) {
    return {
        id: jornada.id,
        temporada: temporadaCodigo,
        numeroJornada: jornada.numeroJornada,
        fecha: jornada.fecha,
        partidos: jornada.partidos.map((p) => ({
            id: p.id,
            orden: p.orden,
            equipoLocalId: p.equipoLocalId,
            equipoVisitanteId: p.equipoVisitanteId,
        })),
        createdAt: jornada.createdAt,
        updatedAt: jornada.updatedAt,
    };
}

export async function create(input: CreateJornadaInput, createdBy: string) {
    const temporada = await temporadasService.resolveTemporada(input.temporada);
    const partidosResueltos = await resolvePartidos(input.partidos);

    try {
        const jornada = await jornadasRepository.create({
            temporadaId: temporada.id,
            numeroJornada: input.numeroJornada,
            fecha: input.fecha,
            createdBy,
            partidos: partidosResueltos,
        });
        return toResponse(temporada.codigo, jornada);
    } catch (err) {
        /* v8 ignore next -- @preserve */
        if (isUniqueViolation(err)) {
            throw new ConflictError(
                `Ya existe la jornada ${input.numeroJornada} en la temporada '${temporada.codigo}'.`,
            );
        }
        /* v8 ignore next -- @preserve */
        throw err;
    }
}

export async function findAll(temporadaCodigo?: string) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const filas = await jornadasRepository.findAll(temporada.id);
    return filas.map((jornada) => toResponse(temporada.codigo, jornada));
}

export async function findByNumero(numeroJornada: number, temporadaCodigo?: string) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const jornada = await jornadasRepository.findByNumero(temporada.id, numeroJornada);
    if (!jornada) {
        throw new NotFoundError(`No existe la jornada ${numeroJornada} en la temporada '${temporada.codigo}'.`);
    }
    return toResponse(temporada.codigo, jornada);
}

export async function replace(numeroJornada: number, temporadaCodigo: string | undefined, input: UpdateJornadaInput) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const existente = await jornadasRepository.findByNumero(temporada.id, numeroJornada);
    if (!existente) {
        throw new NotFoundError(`No existe la jornada ${numeroJornada} en la temporada '${temporada.codigo}'.`);
    }

    const partidosResueltos = await resolvePartidos(input.partidos);
    const jornada = await jornadasRepository.replace(existente.id, { fecha: input.fecha, partidos: partidosResueltos });
    return toResponse(temporada.codigo, jornada);
}

export async function remove(numeroJornada: number, temporadaCodigo?: string) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const existente = await jornadasRepository.findByNumero(temporada.id, numeroJornada);
    if (!existente) {
        throw new NotFoundError(`No existe la jornada ${numeroJornada} en la temporada '${temporada.codigo}'.`);
    }
    await jornadasRepository.remove(existente.id);
}