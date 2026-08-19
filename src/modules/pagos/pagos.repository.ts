import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db, type DbOrTx } from "../../db/index.js";
import { pagos } from "../../db/schema/pagos.js";

export interface PagoInput {
    usuarioId: string;
    importe: number;
    fechaPago: string;
    registradoPor: string;
}

export interface PagoFila extends PagoInput {
    id: string;
    createdAt: Date;
}

export interface PagosFiltros {
    usuarioId?: string | undefined;
    desde?: string | undefined;
    hasta?: string | undefined;
}


export async function create(input: PagoInput, tx: DbOrTx = db): Promise<PagoFila> {
    const [row] = await tx.insert(pagos).values(input).returning();
    /* v8 ignore next -- @preserve */
    if (!row) throw new Error("No se pudo registrar el pago");
    return row;
}

export async function findAll(filtros: PagosFiltros, tx: DbOrTx = db): Promise<PagoFila[]> {
    const condiciones = [];
    if (filtros.usuarioId !== undefined) condiciones.push(eq(pagos.usuarioId, filtros.usuarioId));
    if (filtros.desde !== undefined) condiciones.push(gte(pagos.fechaPago, filtros.desde));
    if (filtros.hasta !== undefined) condiciones.push(lte(pagos.fechaPago, filtros.hasta));

    return tx
        .select()
        .from(pagos)
        .where(condiciones.length > 0 ? and(...condiciones) : undefined);
}

export async function findByUsuario(usuarioId: string, tx: DbOrTx = db): Promise<PagoFila[]> {
    return tx.select().from(pagos).where(eq(pagos.usuarioId, usuarioId));
}

export async function findById(id: string, tx: DbOrTx = db): Promise<PagoFila | undefined> {
    const [row] = await tx.select().from(pagos).where(eq(pagos.id, id));
    return row;
}

export async function remove(id: string, tx: DbOrTx = db) {
    await tx.delete(pagos).where(eq(pagos.id, id));
}

export async function getCredito(usuarioId: string, tx: DbOrTx = db): Promise<number> {
    const resultado = await tx.execute(sql`
        SELECT
            COALESCE((SELECT SUM(importe) FROM pagos WHERE usuario_id = ${usuarioId}), 0)
            - COALESCE((SELECT SUM(importe_escalon) FROM resultados_miembro WHERE usuario_id = ${usuarioId}), 0)
            + COALESCE((SELECT saldo_inicial FROM users WHERE id = ${usuarioId}), 0)
            AS credito
    `);
    const fila = resultado.rows[0] as { credito: string } | undefined;
    /* v8 ignore next -- @preserve */
    return fila ? Number(fila.credito) : 0;
}

export async function sumImportes(usuarioId: string, tx: DbOrTx = db): Promise<number> {
    const [row] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${pagos.importe}), 0)` })
        .from(pagos)
        .where(eq(pagos.usuarioId, usuarioId));
    /* v8 ignore next -- @preserve */
    return row ? Number(row.total) : 0;
}