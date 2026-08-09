import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { citext } from "./_helpers.js";

export const equipos = pgTable(
    "equipos",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        nombreLargo: citext("nombre_largo").notNull(),
        nombreCorto: text("nombre_corto").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("equipos_nombre_largo_key").on(t.nombreLargo),
        check("equipos_nombre_largo_check", sql`length(trim(${t.nombreLargo})) > 0`),
        check("equipos_nombre_corto_check", sql`length(trim(${t.nombreCorto})) > 0`),
    ],
);