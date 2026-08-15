import { ConflictError, NotFoundError } from "../../core/errors.js";
import { isUniqueViolation } from "../../core/error.js";
import * as jornadasRepository from "./jornadas.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as equiposService from "../equipos/equipos.service.js";
import type {
    CreateJornadaInput,
    UpdateJornadaInput,
    PartidoInput,
    FechasJornadaInput,
    PlenoJornadaInput,
} from "./jornadas.schemas.js";

interface JornadaConFechas {
    fechaAperturaApuestas: Date | null;
    fechaCierreApuestas: Date | null;
    fechaCierreJornada: Date | null;
}

export function apuestasAbiertas(jornada: JornadaConFechas): boolean {
    if (jornada.fechaAperturaApuestas === null || jornada.fechaCierreApuestas === null) return false;
    if (jornada.fechaCierreJornada !== null) return false;
    const ahora = new Date();
    return jornada.fechaAperturaApuestas <= ahora && ahora < jornada.fechaCierreApuestas;
}

export function assertApuestasAbiertas(jornada: JornadaConFechas): void {
    if (!apuestasAbiertas(jornada)) {
        throw new ConflictError("Las apuestas de esta jornada están cerradas.");
    }
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
        fechaAperturaApuestas: Date | null;
        fechaCierreApuestas: Date | null;
        fechaCierreJornada: Date | null;
        apuestaPleno15: string | null;
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
        fechaAperturaApuestas: jornada.fechaAperturaApuestas,
        fechaCierreApuestas: jornada.fechaCierreApuestas,
        fechaCierreJornada: jornada.fechaCierreJornada,
        apuestaPleno15: jornada.apuestaPleno15,
        apuestasAbiertas: apuestasAbiertas(jornada),
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

async function resolveExistente(numeroJornada: number, temporadaCodigo: string | undefined) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const existente = await jornadasRepository.findByNumero(temporada.id, numeroJornada);
    if (!existente) {
        throw new NotFoundError(`No existe la jornada ${numeroJornada} en la temporada '${temporada.codigo}'.`);
    }
    return { temporada, existente };
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
    const { temporada, existente } = await resolveExistente(numeroJornada, temporadaCodigo);
    return toResponse(temporada.codigo, existente);
}


export async function replace(numeroJornada: number, temporadaCodigo: string | undefined, input: UpdateJornadaInput) {
    const { temporada, existente } = await resolveExistente(numeroJornada, temporadaCodigo);

    if (await jornadasRepository.tieneResultados(existente.id)) {
        throw new ConflictError(`No se puede reemplazar la jornada ${numeroJornada}: ya tiene resultados registrados.`);
    }

    const partidosResueltos = await resolvePartidos(input.partidos);
    const jornada = await jornadasRepository.replace(existente.id, { fecha: input.fecha, partidos: partidosResueltos });
    return toResponse(temporada.codigo, jornada);
}

export async function remove(numeroJornada: number, temporadaCodigo?: string) {
    const { existente } = await resolveExistente(numeroJornada, temporadaCodigo);

    if (await jornadasRepository.tieneResultados(existente.id)) {
        throw new ConflictError(`No se puede eliminar la jornada ${numeroJornada}: ya tiene resultados registrados.`);
    }

    await jornadasRepository.remove(existente.id);
}

export async function updateFechas(
    numeroJornada: number,
    temporadaCodigo: string | undefined,
    input: FechasJornadaInput,
) {
    const { temporada, existente } = await resolveExistente(numeroJornada, temporadaCodigo);
    const jornada = await jornadasRepository.updateFechas(existente.id, input);
    return toResponse(temporada.codigo, { ...jornada, partidos: existente.partidos });
}

export async function cerrarApuestas(numeroJornada: number, temporadaCodigo?: string) {
    const { temporada, existente } = await resolveExistente(numeroJornada, temporadaCodigo);
    const jornada = await jornadasRepository.cerrarApuestas(existente.id);
    return toResponse(temporada.codigo, { ...jornada, partidos: existente.partidos });
}

export async function updatePleno(
    numeroJornada: number,
    temporadaCodigo: string | undefined,
    input: PlenoJornadaInput,
) {
    const { temporada, existente } = await resolveExistente(numeroJornada, temporadaCodigo);
    const jornada = await jornadasRepository.updatePleno(existente.id, input.apuestaPleno15);
    return toResponse(temporada.codigo, { ...jornada, partidos: existente.partidos });
}