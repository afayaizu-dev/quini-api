import { and, asc, eq, inArray } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { jornadas, partidos } from "../../db/schema/jornadas.js";

interface PartidoRow {
    orden: number;
    equipoLocalId: string;
    equipoVisitanteId: string;
}

interface CreateJornadaRepoInput {
    temporadaId: string;
    numeroJornada: number;
    fecha: string;
    createdBy: string;
    partidos: PartidoRow[];
}

function ordenarPorOrden<T extends { orden: number }>(filas: T[]): T[] {
    return [...filas].sort((a, b) => a.orden - b.orden);
}

export async function create(input: CreateJornadaRepoInput) {
    return db.transaction(async (tx) => {
        const [jornada] = await tx
            .insert(jornadas)
            .values({
                temporadaId: input.temporadaId,
                numeroJornada: input.numeroJornada,
                fecha: input.fecha,
                createdBy: input.createdBy,
            })
            .returning();
        /* v8 ignore next -- @preserve */
        if (!jornada) throw new Error("No se pudo crear la jornada");

        const filasPartidos = await tx
            .insert(partidos)
            .values(input.partidos.map((p) => ({ ...p, jornadaId: jornada.id })))
            .returning();

        return { ...jornada, partidos: ordenarPorOrden(filasPartidos) };
    });
}

export async function findAll(temporadaId: string, tx: DbOrTx = db) {
    const filasJornadas = await tx
        .select()
        .from(jornadas)
        .where(eq(jornadas.temporadaId, temporadaId))
        .orderBy(asc(jornadas.numeroJornada));

    if (filasJornadas.length === 0) return [];

    const idsJornadas = filasJornadas.map((j) => j.id);
    const filasPartidos = await tx
        .select()
        .from(partidos)
        .where(inArray(partidos.jornadaId, idsJornadas))
        .orderBy(asc(partidos.orden));

    return filasJornadas.map((jornada) => ({
        ...jornada,
        partidos: filasPartidos.filter((p) => p.jornadaId === jornada.id),
    }));
}

export async function findByNumero(temporadaId: string, numeroJornada: number, tx: DbOrTx = db) {
    const [jornada] = await tx
        .select()
        .from(jornadas)
        .where(and(eq(jornadas.temporadaId, temporadaId), eq(jornadas.numeroJornada, numeroJornada)));

    if (!jornada) return undefined;

    const filasPartidos = await tx
        .select()
        .from(partidos)
        .where(eq(partidos.jornadaId, jornada.id))
        .orderBy(asc(partidos.orden));

    return { ...jornada, partidos: filasPartidos };
}

export async function replace(jornadaId: string, input: { fecha: string; partidos: PartidoRow[] }) {
    return db.transaction(async (tx) => {
        await tx.update(jornadas).set({ fecha: input.fecha, updatedAt: new Date() }).where(eq(jornadas.id, jornadaId));
        await tx.delete(partidos).where(eq(partidos.jornadaId, jornadaId));

        const filasPartidos = await tx
            .insert(partidos)
            .values(input.partidos.map((p) => ({ ...p, jornadaId })))
            .returning();
        /* v8 ignore next -- @preserve */
        const [jornada] = await tx.select().from(jornadas).where(eq(jornadas.id, jornadaId));
        /* v8 ignore next -- @preserve */
        if (!jornada) throw new Error("No se pudo actualizar la jornada");
        /* v8 ignore next -- @preserve */
        return { ...jornada, partidos: ordenarPorOrden(filasPartidos) };
    });
}

export async function remove(jornadaId: string, tx: DbOrTx = db) {
    await tx.delete(jornadas).where(eq(jornadas.id, jornadaId));
}
