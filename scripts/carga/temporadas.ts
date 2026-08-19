import { CreateTemporadaSchema } from "../../src/modules/temporadas/temporadas.schemas.js";
import * as temporadasRepository from "../../src/modules/temporadas/temporadas.repository.js";
import { db } from "../../src/db/index.js";
import { leerCsv, texto, booleano } from "./csv.js";
import type { Contexto, ResumenModulo } from "./contexto.js";

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const filas = leerCsv("temporadas.csv");
    const errores: string[] = [];
    const validas: { codigo: string; nombre: string; fechaInicio: string; fechaFin: string; activa: boolean }[] = [];
    const vistos = new Set<string>();
    let codigoActiva: string | undefined;

    filas.forEach((fila, i) => {
        const linea = i + 2;
        const candidato = {
            codigo: texto(fila.codigo),
            nombre: texto(fila.nombre),
            fechaInicio: texto(fila.fechaInicio),
            fechaFin: texto(fila.fechaFin),
        };
        const resultado = CreateTemporadaSchema.safeParse(candidato);
        if (!resultado.success) {
            errores.push(`temporadas.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            return;
        }

        if (vistos.has(resultado.data.codigo)) {
            errores.push(`temporadas.csv línea ${linea}: codigo "${resultado.data.codigo}" duplicado en el fichero.`);
            return;
        }
        vistos.add(resultado.data.codigo);

        const activa = booleano(fila.activa);
        if (activa) {
            if (codigoActiva !== undefined) {
                errores.push(
                    `temporadas.csv línea ${linea}: ya hay otra temporada marcada como activa ("${codigoActiva}") — solo puede haber una.`,
                );
                return;
            }
            codigoActiva = resultado.data.codigo;
        }

        validas.push({ ...resultado.data, activa });
    });

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const existente = await temporadasRepository.findByCodigo(fila.codigo);

        if (existente) {
            if (!opciones.dryRun) {
                await temporadasRepository.update(fila.codigo, {
                    nombre: fila.nombre,
                    fechaInicio: fila.fechaInicio,
                    fechaFin: fila.fechaFin,
                });
            }
            ctx.temporadasPorCodigo.set(fila.codigo, existente.id);
            actualizados++;
        } else if (opciones.dryRun) {
            creados++;
        } else {
            const creada = await temporadasRepository.create({
                codigo: fila.codigo,
                nombre: fila.nombre,
                fechaInicio: fila.fechaInicio,
                fechaFin: fila.fechaFin,
            });
            ctx.temporadasPorCodigo.set(fila.codigo, creada.id);
            creados++;
        }

        if (fila.activa && !opciones.dryRun) {
            await db.transaction((tx) => temporadasRepository.activate(fila.codigo, tx));
        }
    }

    return { creados, actualizados, errores: [] };
}