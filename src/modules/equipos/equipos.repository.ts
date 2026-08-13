import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { equipos } from "../../db/schema/equipos.js";
import type { CreateEquipoInput, UpdateEquipoInput } from "./equipos.schemas.js";

export async function create(input: CreateEquipoInput, tx: DbOrTx = db) {
    const [row] = await tx.insert(equipos).values(input).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo crear el equipo");
    return row;
}

export async function findAll(tx: DbOrTx = db) {
    return tx.select().from(equipos);
}

export async function findById(id: string, tx: DbOrTx = db) {
    const [row] = await tx.select().from(equipos).where(eq(equipos.id, id));
    return row;
}

export async function findByNombreLargo(nombreLargo: string, tx: DbOrTx = db) {
    const [row] = await tx.select().from(equipos).where(eq(equipos.nombreLargo, nombreLargo));
    return row;
}

export async function update(id: string, input: UpdateEquipoInput, tx: DbOrTx = db) {
    const [row] = await tx.update(equipos).set(input).where(eq(equipos.id, id)).returning();
    return row;
}

export async function remove(id: string, tx: DbOrTx = db) {
    await tx.delete(equipos).where(eq(equipos.id, id));
}