import { sql } from "drizzle-orm";
import { check, date, numeric, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const pagos = pgTable(
    "pagos",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        usuarioId: uuid("usuario_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        importe: numeric("importe", { precision: 12, scale: 2, mode: "number" }).notNull(),
        fechaPago: date("fecha_pago").notNull(),
        registradoPor: uuid("registrado_por")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [check("pagos_importe_check", sql`${t.importe} > 0`)],
);

