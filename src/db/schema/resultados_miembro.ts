import { sql } from "drizzle-orm";
import { check, numeric, pgTable, smallint, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { jornadas } from "./jornadas.js";
import { users } from "./users.js";

export const resultadosMiembro = pgTable(
    "resultados_miembro",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        jornadaId: uuid("jornada_id")
            .notNull()
            .references(() => jornadas.id, { onDelete: "cascade" }),
        usuarioId: uuid("usuario_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        aciertosApuesta1: smallint("aciertos_apuesta_1"),
        aciertosApuesta2: smallint("aciertos_apuesta_2"),
        aciertosMax: smallint("aciertos_max").notNull(),
        premioApuesta1: numeric("premio_apuesta_1", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
        premioApuesta2: numeric("premio_apuesta_2", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
        ranking: smallint("ranking").notNull(),
        escalon: smallint("escalon").notNull(),
        importeEscalon: numeric("importe_escalon", { precision: 12, scale: 2, mode: "number" }).notNull(),
        costeApuestas: numeric("coste_apuestas", { precision: 12, scale: 2, mode: "number" }).notNull().default(1.5),
        bote: numeric("bote", { precision: 12, scale: 2, mode: "number" }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("resultados_miembro_jornada_usuario_key").on(t.jornadaId, t.usuarioId),
        check("resultados_miembro_aciertos_1_check", sql`${t.aciertosApuesta1} BETWEEN 0 AND 14`),
        check("resultados_miembro_aciertos_2_check", sql`${t.aciertosApuesta2} BETWEEN 0 AND 14`),
        check("resultados_miembro_escalon_check", sql`${t.escalon} BETWEEN 1 AND 10`),
        check("resultados_miembro_ranking_check", sql`${t.ranking} >= 1`),
    ],
);