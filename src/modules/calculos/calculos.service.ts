import { ConflictError, NotFoundError } from "../../core/errors.js";
import { db } from "../../db/index.js";
import * as calculosRepository from "./calculos.repository.js";
import * as jornadasService from "../jornadas/jornadas.service.js";
import * as jornadasRepository from "../jornadas/jornadas.repository.js";
import * as temporadasService from "../temporadas/temporadas.service.js";
import * as resultadosRepository from "../resultados/resultados.repository.js";
import * as apuestasRepository from "../apuestas/apuestas.repository.js";
import { calcularJornada } from "./calculos.algoritmo.js";
import type { ApuestaCalculo, ResultadoCalculo, LiquidacionMiembro } from "./calculos.algoritmo.js";
import type { EjecutarCalculoInput } from "./calculos.schemas.js";

function toResultadoCalculo(row: {
    resultado1: string; resultado2: string; resultado3: string; resultado4: string; resultado5: string;
    resultado6: string; resultado7: string; resultado8: string; resultado9: string; resultado10: string;
    resultado11: string; resultado12: string; resultado13: string; resultado14: string;
    premioCat10: number; premioCat11: number; premioCat12: number; premioCat13: number; premioCat14: number; premioCat15: number;
}): ResultadoCalculo {
    return {
        resultados: [
            row.resultado1, row.resultado2, row.resultado3, row.resultado4, row.resultado5,
            row.resultado6, row.resultado7, row.resultado8, row.resultado9, row.resultado10,
            row.resultado11, row.resultado12, row.resultado13, row.resultado14,
        ],
        premios: {
            "10": row.premioCat10, "11": row.premioCat11, "12": row.premioCat12,
            "13": row.premioCat13, "14": row.premioCat14, "15": row.premioCat15,
        },
    };
}

function toApuestaCalculo(row: {
    id: string; usuarioId: string; numeroApuesta: number;
    partido1: string; partido2: string; partido3: string; partido4: string; partido5: string;
    partido6: string; partido7: string; partido8: string; partido9: string; partido10: string;
    partido11: string; partido12: string; partido13: string; partido14: string;
}): ApuestaCalculo {
    return {
        id: row.id,
        usuarioId: row.usuarioId,
        numeroApuesta: row.numeroApuesta as 1 | 2,
        partidos: [
            row.partido1, row.partido2, row.partido3, row.partido4, row.partido5,
            row.partido6, row.partido7, row.partido8, row.partido9, row.partido10,
            row.partido11, row.partido12, row.partido13, row.partido14,
        ],
    };
}

function toResponse(numeroJornada: number, temporadaCodigo: string, filas: LiquidacionMiembro[]) {
    const miembros = [...filas]
        .sort((a, b) => a.ranking - b.ranking)
        .map((f) => ({
            usuarioId: f.usuarioId,
            aciertosApuesta1: f.aciertosApuesta1,
            aciertosApuesta2: f.aciertosApuesta2,
            aciertosMax: f.aciertosMax,
            premioApuesta1: f.premioApuesta1,
            premioApuesta2: f.premioApuesta2,
            ranking: f.ranking,
            escalon: f.escalon,
            importeEscalon: f.importeEscalon,
            costeApuestas: f.costeApuestas,
            bote: f.bote,
        }));

    const boteTotal = Math.round(miembros.reduce((acc, m) => acc + m.bote, 0) * 100) / 100;
    const premiosTotal = Math.round(miembros.reduce((acc, m) => acc + m.premioApuesta1 + m.premioApuesta2, 0) * 100) / 100;
    const costeTotal = Math.round(miembros.reduce((acc, m) => acc + m.costeApuestas, 0) * 100) / 100;

    return { jornada: numeroJornada, temporada: temporadaCodigo, miembros, boteTotal, premiosTotal, costeTotal };
}

export async function ejecutar(input: EjecutarCalculoInput) {
    const temporada = await temporadasService.resolveTemporada(input.temporada);
    if (!temporada.activa) {
        throw new ConflictError(`La temporada '${temporada.codigo}' no está activa.`);
    }

    const jornada = await jornadasService.findByNumero(input.jornada, temporada.codigo);
    if (jornadasService.apuestasAbiertas(jornada)) {
        throw new ConflictError(`Las apuestas de la jornada ${input.jornada} todavía están abiertas.`);
    }

    const filaResultados = await resultadosRepository.findByJornada(jornada.id);
    if (!filaResultados) {
        throw new ConflictError(`No hay resultados registrados para la jornada ${input.jornada}.`);
    }

    const filasApuestas = await apuestasRepository.findByJornada(jornada.id);
    if (filasApuestas.length === 0) {
        throw new ConflictError(`No hay ninguna apuesta registrada para la jornada ${input.jornada}.`);
    }

    const escalones = await calculosRepository.findEscalones();
    const liquidaciones = calcularJornada(filasApuestas.map(toApuestaCalculo), toResultadoCalculo(filaResultados), escalones);

    const filasGuardadas = await db.transaction(async (tx) => {
        const guardadas = await calculosRepository.upsertResultadosMiembro(
            liquidaciones.map((l) => ({ jornadaId: jornada.id, ...l })),
            tx,
        );
        await jornadasRepository.cerrarJornada(jornada.id, tx);
        return guardadas;
    });

    return toResponse(input.jornada, temporada.codigo, filasGuardadas);
}

export async function findByJornada(numeroJornada: number, temporadaCodigo?: string) {
    const temporada = await temporadasService.resolveTemporada(temporadaCodigo);
    const jornada = await jornadasService.findByNumero(numeroJornada, temporada.codigo);

    const filas = await calculosRepository.findByJornada(jornada.id);
    if (filas.length === 0) {
        throw new NotFoundError(`No hay un cálculo registrado para la jornada ${numeroJornada}.`);
    }

    return toResponse(numeroJornada, temporada.codigo, filas);
}