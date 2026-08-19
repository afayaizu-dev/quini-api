import { CreateEquipoSchema } from "../../src/modules/equipos/equipos.schemas.js";
import * as equiposRepository from "../../src/modules/equipos/equipos.repository.js";
import { leerCsv, texto } from "./csv.js";
import { normalizar, type Contexto, type ResumenModulo } from "./contexto.js";

export async function cargar(ctx: Contexto, opciones: { dryRun: boolean }): Promise<ResumenModulo> {
    const filas = leerCsv("equipos.csv");
    const errores: string[] = [];
    const validas: { nombreLargo: string; nombreCorto: string }[] = [];
    const vistos = new Set<string>();

    filas.forEach((fila, i) => {
        const linea = i + 2; // +1 por el índice 0, +1 por la cabecera
        const candidato = {
            nombreLargo: texto(fila.nombreLargo),
            nombreCorto: texto(fila.nombreCorto),
        };
        const resultado = CreateEquipoSchema.safeParse(candidato);
        if (!resultado.success) {
            errores.push(`equipos.csv línea ${linea}: ${resultado.error.issues.map((iss) => iss.message).join(", ")}`);
            return;
        }

        const clave = normalizar(resultado.data.nombreLargo);
        if (vistos.has(clave)) {
            errores.push(`equipos.csv línea ${linea}: nombreLargo "${resultado.data.nombreLargo}" duplicado en el fichero.`);
            return;
        }
        vistos.add(clave);
        validas.push(resultado.data);
    });

    if (errores.length > 0) {
        return { creados: 0, actualizados: 0, errores };
    }

    let creados = 0;
    let actualizados = 0;

    for (const fila of validas) {
        const existente = await equiposRepository.findByNombreLargo(fila.nombreLargo);

        if (existente) {
            if (!opciones.dryRun) {
                await equiposRepository.update(existente.id, fila);
            }
            ctx.equiposPorNombre.set(normalizar(fila.nombreLargo), existente.id);
            actualizados++;
        } else if (opciones.dryRun) {
            creados++;
        } else {
            const creado = await equiposRepository.create(fila);
            ctx.equiposPorNombre.set(normalizar(fila.nombreLargo), creado.id);
            creados++;
        }
    }

    return { creados, actualizados, errores: [] };
}
