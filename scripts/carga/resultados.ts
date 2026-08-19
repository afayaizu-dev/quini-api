import { UpsertResultadosSchema } from "../../src/modules/resultados/resultados.schemas.js";
import * as resultadosRepository from "../../src/modules/resultados/resultados.repository.js";
import type { ResultadosColumnas } from "../../src/modules/resultados/resultados.repository.js";
import { leerCsv, texto, numero } from "./csv.js";
import { resolverJornadaActivaPorNumero, type Contexto, type ResumenModulo } from "./contexto.js";

function r(valores: string[], i: number): string {
    return valores[i] as string;
}

interface ResultadoValido {
    jornadaId: string;
    columnas: ResultadosColumnas;
}

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const errores: string[] = [];
    const validas: ResultadoValido[] = [];
    const vistos = new Set<string>();

    const filas = leerCsv("resultados.csv");

    for (const [i, fila] of filas.entries()) {
        const linea = i + 2;
        const numeroJornada = Number(texto(fila.jornada));
        const resultadosSignos = Array.from({ length: 14 }, (_, idx) => texto(fila[`r${idx + 1}`]).toUpperCase());
        const resultado15 = texto(fila.resultado15).toUpperCase();

        let premios: Record<string, number>;
        try {
            premios = {
                "10": numero(fila.premio10),
                "11": numero(fila.premio11),
                "12": numero(fila.premio12),
                "13": numero(fila.premio13),
                "14": numero(fila.premio14),
                "15": numero(fila.premio15),
            };
        } catch (err) {
            errores.push(`resultados.csv línea ${linea}: ${err instanceof Error ? err.message : String(err)}`);
            continue;
        }

        const resultado = UpsertResultadosSchema.safeParse({
            resultados: resultadosSignos,
            resultado15,
            premios,
        });
        if (!resultado.success) {
            errores.push(`resultados.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            continue;
        }

        const jornadaId = await resolverJornadaActivaPorNumero(ctx, numeroJornada);
        if (!jornadaId) {
            errores.push(`resultados.csv línea ${linea}: no existe la jornada ${numeroJornada} en la temporada activa.`);
            continue;
        }

        if (vistos.has(jornadaId)) {
            errores.push(`resultados.csv línea ${linea}: la jornada ${numeroJornada} aparece más de una vez en el fichero.`);
            continue;
        }
        vistos.add(jornadaId);

        validas.push({
            jornadaId,
            columnas: {
                resultado1: r(resultado.data.resultados, 0),
                resultado2: r(resultado.data.resultados, 1),
                resultado3: r(resultado.data.resultados, 2),
                resultado4: r(resultado.data.resultados, 3),
                resultado5: r(resultado.data.resultados, 4),
                resultado6: r(resultado.data.resultados, 5),
                resultado7: r(resultado.data.resultados, 6),
                resultado8: r(resultado.data.resultados, 7),
                resultado9: r(resultado.data.resultados, 8),
                resultado10: r(resultado.data.resultados, 9),
                resultado11: r(resultado.data.resultados, 10),
                resultado12: r(resultado.data.resultados, 11),
                resultado13: r(resultado.data.resultados, 12),
                resultado14: r(resultado.data.resultados, 13),
                resultado15: resultado.data.resultado15,
                premioCat10: resultado.data.premios["10"],
                premioCat11: resultado.data.premios["11"],
                premioCat12: resultado.data.premios["12"],
                premioCat13: resultado.data.premios["13"],
                premioCat14: resultado.data.premios["14"],
                premioCat15: resultado.data.premios["15"],
            },
        });
    }

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        if (opciones.dryRun) {
            const existente = await resultadosRepository.findByJornada(fila.jornadaId);
            if (existente) {
                actualizados++;
            } else {
                creados++;
            }
            continue;
        }

        const { creado } = await resultadosRepository.upsert(fila.jornadaId, fila.columnas);
        if (creado) {
            creados++;
        } else {
            actualizados++;
        }

    }

    return { creados, actualizados, errores: [] };
}
