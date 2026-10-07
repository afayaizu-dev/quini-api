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

// Crédito = pagos - importe de escalón de las jornadas + saldo inicial. Con 'hastaFecha' (YYYY-MM-DD) solo cuenta
// lo anterior o igual a esa fecha: pagos por fecha_pago y resultados por la fecha de su jornada.
export async function getCredito(usuarioId: string, tx: DbOrTx = db, hastaFecha?: string): Promise<number> {
    const pagosHasta = hastaFecha === undefined ? sql`` : sql` AND fecha_pago <= ${hastaFecha}::date`;
    const resultadosHasta = hastaFecha === undefined ? sql`` : sql` AND j.fecha <= ${hastaFecha}::date`;
    const resultado = await tx.execute(sql`
        SELECT
            COALESCE((SELECT SUM(importe) FROM pagos WHERE usuario_id = ${usuarioId}${pagosHasta}), 0)
            - COALESCE((
                SELECT SUM(rm.importe_escalon) FROM resultados_miembro rm
                JOIN jornadas j ON j.id = rm.jornada_id
                WHERE rm.usuario_id = ${usuarioId}${resultadosHasta}
            ), 0)
            + COALESCE((SELECT saldo_inicial FROM users WHERE id = ${usuarioId}), 0)
            AS credito
    `);
    const fila = resultado.rows[0] as { credito: string } | undefined;
    /* v8 ignore next -- @preserve */
    return fila ? Number(fila.credito) : 0;
}

export async function sumImportes(usuarioId: string, tx: DbOrTx = db, hastaFecha?: string): Promise<number> {
    const condiciones = [eq(pagos.usuarioId, usuarioId)];
    if (hastaFecha !== undefined) condiciones.push(lte(pagos.fechaPago, hastaFecha));
    const [row] = await tx
        .select({ total: sql<string>`COALESCE(SUM(${pagos.importe}), 0)` })
        .from(pagos)
        .where(and(...condiciones));
    /* v8 ignore next -- @preserve */
    return row ? Number(row.total) : 0;
}
