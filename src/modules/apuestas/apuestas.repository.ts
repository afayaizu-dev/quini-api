import { and, eq, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { apuestas } from "../../db/schema/apuestas.js";
import { jornadas } from "../../db/schema/jornadas.js";

export interface ApuestaColumnas {
    partido1: string;
    partido2: string;
    partido3: string;
    partido4: string;
    partido5: string;
    partido6: string;
    partido7: string;
    partido8: string;
    partido9: string;
    partido10: string;
    partido11: string;
    partido12: string;
    partido13: string;
    partido14: string;
    sugerenciaPleno15: string | null;
}

export interface ApuestaFila extends ApuestaColumnas {
    id: string;
    jornadaId: string;
    usuarioId: string;
    numeroApuesta: number;
    creadaPor: string;
    createdAt: Date;
    updatedAt: Date;
}

interface CreateApuestaInput extends ApuestaColumnas {
    jornadaId: string;
    usuarioId: string;
    numeroApuesta: number;
    creadaPor: string;
}

export async function create(input: CreateApuestaInput, tx: DbOrTx = db): Promise<ApuestaFila> {
    const [row] = await tx.insert(apuestas).values(input).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo crear la apuesta");
    return row;
}

export async function findByJornada(jornadaId: string, tx: DbOrTx = db): Promise<ApuestaFila[]> {
    return tx.select().from(apuestas).where(eq(apuestas.jornadaId, jornadaId));
}

export async function findByJornadaYUsuario(
    jornadaId: string,
    usuarioId: string,
    tx: DbOrTx = db,
): Promise<ApuestaFila[]> {
    return tx
        .select()
        .from(apuestas)
        .where(and(eq(apuestas.jornadaId, jornadaId), eq(apuestas.usuarioId, usuarioId)));
}

export async function findOne(
    jornadaId: string,
    usuarioId: string,
    numeroApuesta: number,
    tx: DbOrTx = db,
): Promise<ApuestaFila | undefined> {
    const [row] = await tx
        .select()
        .from(apuestas)
        .where(
            and(
                eq(apuestas.jornadaId, jornadaId),
                eq(apuestas.usuarioId, usuarioId),
                eq(apuestas.numeroApuesta, numeroApuesta),
            ),
        );
    return row;
}

export async function replace(id: string, input: ApuestaColumnas, tx: DbOrTx = db): Promise<ApuestaFila> {
    const [row] = await tx
        .update(apuestas)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(apuestas.id, id))
        .returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo actualizar la apuesta");
    return row;
}

export async function remove(id: string, tx: DbOrTx = db) {
    await tx.delete(apuestas).where(eq(apuestas.id, id));
}

export async function countByJornada(jornadaId: string, tx: DbOrTx = db): Promise<number> {
    const [row] = await tx
        .select({ total: sql<number>`count(*)::int` })
        .from(apuestas)
        .where(eq(apuestas.jornadaId, jornadaId));
    /* v8 ignore next -- @preserve */
    return row?.total ?? 0;
}

export async function contarPorAutoria(
    usuarioId: string,
    temporadaId: string,
    tx: DbOrTx = db,
): Promise<{ total: number; propias: number }> {
    const [row] = await tx
        .select({
            total: sql<number>`count(*)::int`,
            propias: sql<number>`count(*) filter (where ${apuestas.creadaPor} = ${apuestas.usuarioId})::int`,
        })
        .from(apuestas)
        .innerJoin(jornadas, eq(jornadas.id, apuestas.jornadaId))
        .where(and(eq(apuestas.usuarioId, usuarioId), eq(jornadas.temporadaId, temporadaId)));
    /* v8 ignore next -- @preserve */
    return row ?? { total: 0, propias: 0 };
}