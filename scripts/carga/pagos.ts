import { z } from "zod";
import { importeEuros } from "../../src/modules/resultados/resultados.schemas.js";
import * as pagosRepository from "../../src/modules/pagos/pagos.repository.js";
import { leerCsv, texto, numero } from "./csv.js";
import { resolverUsuarioPorApodo, type Contexto, type ResumenModulo } from "./contexto.js";

const FilaPagoSchema = z.object({
    importe: importeEuros.refine((v) => v > 0, "El importe debe ser mayor que 0."),
    fechaPago: z.iso.date(),
});

interface PagoValido {
    usuarioId: string;
    importe: number;
    fechaPago: string;
    registradoPorId: string;
}

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const errores: string[] = [];
    const validas: PagoValido[] = [];

    const filas = leerCsv("pagos.csv");

    for (const [i, fila] of filas.entries()) {
        const linea = i + 2;
        const apodo = texto(fila.apodo);
        const registradoPorApodo = texto(fila.registradoPorApodo);

        let importe: number;
        try {
            importe = numero(fila.importe);
        } catch (err) {
            errores.push(`pagos.csv línea ${linea}: ${err instanceof Error ? err.message : String(err)}`);
            continue;
        }

        const resultado = FilaPagoSchema.safeParse({ importe, fechaPago: texto(fila.fecha) });
        if (!resultado.success) {
            errores.push(`pagos.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            continue;
        }

        const usuarioId = await resolverUsuarioPorApodo(ctx, apodo);
        if (!usuarioId) {
            errores.push(`pagos.csv línea ${linea}: no existe ningún usuario con apodo "${apodo}".`);
            continue;
        }

        const registradoPorId = await resolverUsuarioPorApodo(ctx, registradoPorApodo);
        if (!registradoPorId) {
            errores.push(
                `pagos.csv línea ${linea}: no existe ningún usuario con apodo "${registradoPorApodo}" (registradoPorApodo).`,
            );
            continue;
        }

        validas.push({
            usuarioId,
            importe: resultado.data.importe,
            fechaPago: resultado.data.fechaPago,
            registradoPorId,
        });
    }

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const existentes = await pagosRepository.findByUsuario(fila.usuarioId);
        const yaExiste = existentes.some((p) => p.importe === fila.importe && p.fechaPago === fila.fechaPago);

        if (yaExiste) {
            actualizados++;
            continue;
        }

        if (!opciones.dryRun) {
            await pagosRepository.create({
                usuarioId: fila.usuarioId,
                importe: fila.importe,
                fechaPago: fila.fechaPago,
                registradoPor: fila.registradoPorId,
            });
        }
        creados++;
    }

    return { creados, actualizados, errores: [] };
}
