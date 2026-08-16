import { asc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { escalonesPago } from "../../db/schema/escalones_pago.js";
import { resultadosMiembro } from "../../db/schema/resultados_miembro.js";

export interface EscalonFila {
    escalon: number;
    importe: number;
}

export interface ResultadoMiembroColumnas {
    usuarioId: string;
    aciertosApuesta1: number | null;
    aciertosApuesta2: number | null;
    aciertosMax: number;
    premioApuesta1: number;
    premioApuesta2: number;
    ranking: number;
    escalon: number;
    importeEscalon: number;
    costeApuestas: number;
    bote: number;
}

export interface ResultadoMiembroInput extends ResultadoMiembroColumnas {
    jornadaId: string;
}

export interface ResultadoMiembroFila extends ResultadoMiembroInput {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}

export async function findEscalones(tx: DbOrTx = db): Promise<EscalonFila[]> {
    return tx.select({ escalon: escalonesPago.escalon, importe: escalonesPago.importe }).from(escalonesPago);
}

export async function upsertResultadosMiembro(
    filas: ResultadoMiembroInput[],
    tx: DbOrTx = db,
): Promise<ResultadoMiembroFila[]> {
    const guardadas: ResultadoMiembroFila[] = [];
    for (const fila of filas) {
        const [row] = await tx
            .insert(resultadosMiembro)
            .values(fila)
            .onConflictDoUpdate({
                target: [resultadosMiembro.jornadaId, resultadosMiembro.usuarioId],
                set: { ...fila, updatedAt: new Date() },
            })
            .returning();
        /* v8 ignore next -- @preserve */
        if (!row) throw new Error("No se pudo guardar la liquidación del miembro");
        guardadas.push(row);
    }
    return guardadas;
}

export async function findByJornada(jornadaId: string, tx: DbOrTx = db): Promise<ResultadoMiembroFila[]> {
    return tx
        .select()
        .from(resultadosMiembro)
        .where(eq(resultadosMiembro.jornadaId, jornadaId))
        .orderBy(asc(resultadosMiembro.ranking));
}
