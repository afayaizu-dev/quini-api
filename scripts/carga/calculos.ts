import { leerCsv, texto } from "./csv.js";
import { resolverJornadaActivaPorNumero, type Contexto, type ResumenModulo } from "./contexto.js";
import * as calculosRepository from "../../src/modules/calculos/calculos.repository.js";
import * as jornadasRepository from "../../src/modules/jornadas/jornadas.repository.js";
import * as resultadosRepository from "../../src/modules/resultados/resultados.repository.js";
import * as apuestasRepository from "../../src/modules/apuestas/apuestas.repository.js";
import type { ApuestaFila } from "../../src/modules/apuestas/apuestas.repository.js";
import type { ResultadosFila } from "../../src/modules/resultados/resultados.repository.js";
import { toApuestaCalculo, toResultadoCalculo } from "../../src/modules/calculos/calculos.service.js";
import { calcularJornada } from "../../src/modules/calculos/calculos.algoritmo.js";
import { db } from "../../src/db/index.js";

interface JornadaACalcular {
    numeroJornada: number;
    jornadaId: string;
    apuestas: ApuestaFila[];
    resultados: ResultadosFila;
    yaCalculada: boolean;
}

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const errores: string[] = [];
    const numerosJornada = new Set<number>();

    leerCsv("resultados.csv").forEach((fila, i) => {
        const linea = i + 2;
        const numero = Number(texto(fila.jornada));
        if (Number.isNaN(numero)) {
            errores.push(`resultados.csv línea ${linea}: número de jornada inválido.`);
            return;
        }
        numerosJornada.add(numero);
    });

    const validas: JornadaACalcular[] = [];

    for (const numeroJornada of numerosJornada) {
        const jornadaId = await resolverJornadaActivaPorNumero(ctx, numeroJornada);
        if (!jornadaId) {
            errores.push(`Jornada ${numeroJornada}: no existe en la temporada activa.`);
            continue;
        }

        const filaResultados = await resultadosRepository.findByJornada(jornadaId);
        if (!filaResultados) {
            errores.push(`Jornada ${numeroJornada}: no hay resultados registrados.`);
            continue;
        }

        const filasApuestas = await apuestasRepository.findByJornada(jornadaId);
        if (filasApuestas.length === 0) {
            errores.push(`Jornada ${numeroJornada}: no hay ninguna apuesta registrada.`);
            continue;
        }

        const yaCalculada = (await calculosRepository.findByJornada(jornadaId)).length > 0;

        validas.push({ numeroJornada, jornadaId, apuestas: filasApuestas, resultados: filaResultados, yaCalculada });
    }

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const jornada of validas) {
        if (opciones.dryRun) {
            if (jornada.yaCalculada) {
                actualizados++;
            } else {
                creados++;
            }
            continue;
        }

        const escalones = await calculosRepository.findEscalones();
        const liquidaciones = calcularJornada(
            jornada.apuestas.map(toApuestaCalculo),
            toResultadoCalculo(jornada.resultados),
            escalones,
        );

        await db.transaction(async (tx) => {
            await calculosRepository.upsertResultadosMiembro(
                liquidaciones.map((l) => ({ jornadaId: jornada.jornadaId, ...l })),
                tx,
            );
            await jornadasRepository.cerrarJornada(jornada.jornadaId, tx);
        });

        if (jornada.yaCalculada) {
            actualizados++;
        } else {
            creados++;
        }
    }

    return { creados, actualizados, errores: [] };
}
