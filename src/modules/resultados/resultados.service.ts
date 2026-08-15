import { ConflictError, NotFoundError } from "../../core/errors.js";
import * as resultadosRepository from "./resultados.repository.js";
import * as jornadasService from "../jornadas/jornadas.service.js";
import type { ResultadosColumnas, ResultadosFila } from "./resultados.repository.js";
import type { UpsertResultadosInput } from "./resultados.schemas.js";

function resultadoEn(resultados: string[], indice: number): string {
    const valor = resultados[indice];
    /* v8 ignore next -- @preserve */
    if (valor === undefined) throw new Error(`Falta el resultado del partido ${indice + 1}.`);
    return valor;
}

function toColumnas(input: UpsertResultadosInput): ResultadosColumnas {
    return {
        resultado1: resultadoEn(input.resultados, 0),
        resultado2: resultadoEn(input.resultados, 1),
        resultado3: resultadoEn(input.resultados, 2),
        resultado4: resultadoEn(input.resultados, 3),
        resultado5: resultadoEn(input.resultados, 4),
        resultado6: resultadoEn(input.resultados, 5),
        resultado7: resultadoEn(input.resultados, 6),
        resultado8: resultadoEn(input.resultados, 7),
        resultado9: resultadoEn(input.resultados, 8),
        resultado10: resultadoEn(input.resultados, 9),
        resultado11: resultadoEn(input.resultados, 10),
        resultado12: resultadoEn(input.resultados, 11),
        resultado13: resultadoEn(input.resultados, 12),
        resultado14: resultadoEn(input.resultados, 13),
        resultado15: input.resultado15,
        premioCat10: input.premios["10"],
        premioCat11: input.premios["11"],
        premioCat12: input.premios["12"],
        premioCat13: input.premios["13"],
        premioCat14: input.premios["14"],
        premioCat15: input.premios["15"],
    };
}

function toResponse(row: ResultadosFila) {
    return {
        id: row.id,
        resultados: [
            row.resultado1,
            row.resultado2,
            row.resultado3,
            row.resultado4,
            row.resultado5,
            row.resultado6,
            row.resultado7,
            row.resultado8,
            row.resultado9,
            row.resultado10,
            row.resultado11,
            row.resultado12,
            row.resultado13,
            row.resultado14,
        ],
        resultado15: row.resultado15,
        premios: {
            "10": row.premioCat10,
            "11": row.premioCat11,
            "12": row.premioCat12,
            "13": row.premioCat13,
            "14": row.premioCat14,
            "15": row.premioCat15,
        },
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}

export async function findByJornada(numeroJornada: number, temporadaCodigo?: string) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    const row = await resultadosRepository.findByJornada(jornada.id);
    if (!row) {
        throw new NotFoundError(`No hay resultados registrados para la jornada ${numeroJornada}.`);
    }
    return toResponse(row);
}


export async function upsert(numeroJornada: number, temporadaCodigo: string | undefined, input: UpsertResultadosInput) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    const row = await resultadosRepository.upsert(jornada.id, toColumnas(input));
    return { resultado: toResponse(row), creado: row.creado };
}




export async function remove(numeroJornada: number, temporadaCodigo?: string) {
    const jornada = await jornadasService.findByNumero(numeroJornada, temporadaCodigo);
    if (jornada.fechaCierreJornada !== null) {
        throw new ConflictError(`No se pueden borrar los resultados de la jornada ${numeroJornada}: ya está calculada.`);
    }
    await resultadosRepository.remove(jornada.id);
}



