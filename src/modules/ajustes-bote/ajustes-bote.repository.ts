import { asc, eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { ajustesBote } from "../../db/schema/ajustes_bote.js";

export interface AjusteBoteInput {
    importe: number;
    motivo: string;
    fecha: string;
    temporadaId: string;
    origenTemporadaId?: string | null;
    registradoPor: string;
}

export interface AjusteBoteFila {
    id: string;
    importe: number;
    motivo: string;
    fecha: string;
    temporadaId: string;
    origenTemporadaId: string | null;
    registradoPor: string;
    createdAt: Date;
}

export async function create(input: AjusteBoteInput, tx: DbOrTx = db): Promise<AjusteBoteFila> {
    const [row] = await tx.insert(ajustesBote).values(input).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo registrar el ajuste de bote");
    return row;
}

export async function findByTemporada(temporadaId: string, tx: DbOrTx = db): Promise<AjusteBoteFila[]> {
    return tx
        .select()
        .from(ajustesBote)
        .where(eq(ajustesBote.temporadaId, temporadaId))
        .orderBy(asc(ajustesBote.fecha), asc(ajustesBote.createdAt));
}

export async function findById(id: string, tx: DbOrTx = db): Promise<AjusteBoteFila | undefined> {
    const [row] = await tx.select().from(ajustesBote).where(eq(ajustesBote.id, id));
    return row;
}

export async function remove(id: string, tx: DbOrTx = db) {
    await tx.delete(ajustesBote).where(eq(ajustesBote.id, id));
}
