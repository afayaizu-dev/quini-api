import { sql } from "drizzle-orm";
import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const ajustesBote = pgTable("ajustes_bote", {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    importe: numeric("importe", { precision: 12, scale: 2, mode: "number" }).notNull(),
    motivo: text("motivo").notNull(),
    fecha: date("fecha").notNull(),
    registradoPor: uuid("registrado_por")
        .notNull()
        .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
