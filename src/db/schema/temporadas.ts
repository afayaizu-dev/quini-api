import { sql } from "drizzle-orm";
import { boolean, check, date, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const temporadas = pgTable(
    "temporadas",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        codigo: text("codigo").notNull(),
        nombre: text("nombre").notNull(),
        fechaInicio: date("fecha_inicio").notNull(),
        fechaFin: date("fecha_fin").notNull(),
        activa: boolean("activa").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("temporadas_codigo_key").on(t.codigo),
        uniqueIndex("temporadas_una_activa").on(t.activa).where(sql`${t.activa}`),
        check("temporadas_codigo_check", sql`${t.codigo} ~ '^\\d{4}-\\d{2}$'`),
        check("temporadas_fechas_check", sql`${t.fechaFin} > ${t.fechaInicio}`),
    ],
);
