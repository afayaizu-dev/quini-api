import { eq } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { temporadas } from "../../db/schema/temporadas.js";
import type { CreateTemporadaInput, UpdateTemporadaInput } from "./temporadas.schemas.js";

export async function create(input: CreateTemporadaInput, tx: DbOrTx = db) {
    const [row] = await tx.insert(temporadas).values(input).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo crear la temporada");
    return row;
}

export async function findAll(tx: DbOrTx = db) {
    return tx.select().from(temporadas);
}

export async function findByCodigo(codigo: string, tx: DbOrTx = db) {
    const [row] = await tx.select().from(temporadas).where(eq(temporadas.codigo, codigo));
    return row;
}

export async function findActiva(tx: DbOrTx = db) {
    const [row] = await tx.select().from(temporadas).where(eq(temporadas.activa, true));
    return row;
}

export async function update(codigo: string, input: UpdateTemporadaInput, tx: DbOrTx = db) {
    const [row] = await tx.update(temporadas).set(input).where(eq(temporadas.codigo, codigo)).returning();
    return row;
}

export async function remove(codigo: string, tx: DbOrTx = db) {
    await tx.delete(temporadas).where(eq(temporadas.codigo, codigo));
}

export async function activate(codigo: string, tx: DbOrTx) {
    await tx.update(temporadas).set({ activa: false }).where(eq(temporadas.activa, true));
    const [row] = await tx.update(temporadas).set({ activa: true }).where(eq(temporadas.codigo, codigo)).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo activar la temporada");
    return row;
}
