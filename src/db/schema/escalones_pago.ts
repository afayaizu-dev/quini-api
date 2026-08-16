import { sql } from "drizzle-orm";
import { check, numeric, pgTable, smallint, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const escalonesPago = pgTable(
    "escalones_pago",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        escalon: smallint("escalon").notNull(),
        importe: numeric("importe", { precision: 12, scale: 2, mode: "number" }).notNull(),
    },
    (t) => [
        uniqueIndex("escalones_pago_escalon_key").on(t.escalon),
        check("escalones_pago_escalon_check", sql`${t.escalon} BETWEEN 1 AND 10`),
        check("escalones_pago_importe_check", sql`${t.importe} > 0`),
    ],
);