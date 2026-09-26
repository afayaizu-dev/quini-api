import { CreateApuestaSchema } from "../../src/modules/apuestas/apuestas.schemas.js";
import * as apuestasRepository from "../../src/modules/apuestas/apuestas.repository.js";
import { leerCsv, texto, textoOpcional } from "./csv.js";
import { resolverJornadaActivaPorNumero, resolverUsuarioPorApodo, type Contexto, type ResumenModulo } from "./contexto.js";

function p(partidos: string[], i: number): string {
    return partidos[i] as string;
}

interface ApuestaValida {
    jornadaId: string;
    usuarioId: string;
    creadaPorId: string;
    numeroApuesta: 1 | 2;
    partidos: string[];
    sugerenciaPleno15: string | null;
}

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const errores: string[] = [];
    const validas: ApuestaValida[] = [];
    const vistos = new Set<string>();

    const filas = leerCsv("apuestas.csv");

    for (const [i, fila] of filas.entries()) {
        const linea = i + 2;
        const numeroJornada = Number(texto(fila.jornada));
        const apodo = texto(fila.apodo);
        const numeroApuesta = Number(texto(fila.numeroApuesta));
        const partidos = Array.from({ length: 14 }, (_, idx) => texto(fila[`p${idx + 1}`]).toUpperCase());
        const sugerenciaPleno15 = textoOpcional(fila.sugerenciaPleno15)?.toUpperCase();

        const resultado = CreateApuestaSchema.safeParse({
            numeroApuesta,
            partidos,
            ...(sugerenciaPleno15 ? { sugerenciaPleno15 } : {}),
        });
        if (!resultado.success) {
            errores.push(`apuestas.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            continue;
        }

        const jornadaId = await resolverJornadaActivaPorNumero(ctx, numeroJornada);
        if (!jornadaId) {
            errores.push(`apuestas.csv línea ${linea}: no existe la jornada ${numeroJornada} en la temporada activa.`);
            continue;
        }

        const usuarioId = await resolverUsuarioPorApodo(ctx, apodo);
        if (!usuarioId) {
            errores.push(`apuestas.csv línea ${linea}: no existe ningún usuario con apodo "${apodo}".`);
            continue;
        }

        const creadaPorApodo = textoOpcional(fila.creadaPorApodo);
        const creadaPorId = creadaPorApodo ? await resolverUsuarioPorApodo(ctx, creadaPorApodo) : usuarioId;
        if (!creadaPorId) {
            errores.push(`apuestas.csv línea ${linea}: no existe ningún usuario con apodo "${creadaPorApodo}" (creadaPorApodo).`);
            continue;
        }

        const clave = `${jornadaId}#${usuarioId}#${resultado.data.numeroApuesta}`;
        if (vistos.has(clave)) {
            errores.push(
                `apuestas.csv línea ${linea}: apuesta duplicada en el fichero (jornada ${numeroJornada}, ${apodo}, nº${numeroApuesta}).`,
            );
            continue;
        }
        vistos.add(clave);

        validas.push({
            jornadaId,
            usuarioId,
            creadaPorId,
            numeroApuesta: resultado.data.numeroApuesta,
            partidos: resultado.data.partidos,
            sugerenciaPleno15: resultado.data.sugerenciaPleno15 ?? null,
        });
    }

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const columnas = {
            partido1: p(fila.partidos, 0),
            partido2: p(fila.partidos, 1),
            partido3: p(fila.partidos, 2),
            partido4: p(fila.partidos, 3),
            partido5: p(fila.partidos, 4),
            partido6: p(fila.partidos, 5),
            partido7: p(fila.partidos, 6),
            partido8: p(fila.partidos, 7),
            partido9: p(fila.partidos, 8),
            partido10: p(fila.partidos, 9),
            partido11: p(fila.partidos, 10),
            partido12: p(fila.partidos, 11),
            partido13: p(fila.partidos, 12),
            partido14: p(fila.partidos, 13),
            sugerenciaPleno15: fila.sugerenciaPleno15,
        };

        const existente = await apuestasRepository.findOne(fila.jornadaId, fila.usuarioId, fila.numeroApuesta);

        if (existente) {
            if (!opciones.dryRun) {
                await apuestasRepository.replace(existente.id, columnas, undefined);
            }
            actualizados++;
        } else if (opciones.dryRun) {
            creados++;
        } else {
            await apuestasRepository.create({
                ...columnas,
                jornadaId: fila.jornadaId,
                usuarioId: fila.usuarioId,
                numeroApuesta: fila.numeroApuesta,
                creadaPor: fila.creadaPorId,
            });
            creados++;
        }
    }

    return { creados, actualizados, errores: [] };
}
