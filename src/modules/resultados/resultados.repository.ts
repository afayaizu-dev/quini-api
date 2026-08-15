import { eq, getTableColumns, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { resultados } from "../../db/schema/resultados.js";



export interface ResultadosColumnas {
    resultado1: string;
    resultado2: string;
    resultado3: string;
    resultado4: string;
    resultado5: string;
    resultado6: string;
    resultado7: string;
    resultado8: string;
    resultado9: string;
    resultado10: string;
    resultado11: string;
    resultado12: string;
    resultado13: string;
    resultado14: string;
    resultado15: string;
    premioCat10: number;
    premioCat11: number;
    premioCat12: number;
    premioCat13: number;
    premioCat14: number;
    premioCat15: number;
}

export interface ResultadosFila extends ResultadosColumnas {
    id: string;
    jornadaId: string;
    createdAt: Date;
    updatedAt: Date;
}


export async function findByJornada(jornadaId: string, tx: DbOrTx = db) {
    const [row] = await tx.select().from(resultados).where(eq(resultados.jornadaId, jornadaId));
    return row;
}

export async function upsert(jornadaId: string, input: ResultadosColumnas, tx: DbOrTx = db): Promise<ResultadosFila & { creado: boolean }> {
    const [row] = await tx
        .insert(resultados)
        .values({ jornadaId, ...input })
        .onConflictDoUpdate({
            target: resultados.jornadaId,
            set: { ...input, updatedAt: new Date() },
        })
        .returning({ ...getTableColumns(resultados), creado: sql<boolean>`xmax = 0` });
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo guardar el resultado de la jornada");
    return row as ResultadosFila & { creado: boolean };
}

export async function remove(jornadaId: string, tx: DbOrTx = db) {
    await tx.delete(resultados).where(eq(resultados.jornadaId, jornadaId));
}
