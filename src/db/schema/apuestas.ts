import { sql } from "drizzle-orm";
import { boolean, check, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { jornadas } from "./jornadas.js";
import { users } from "./users.js";

export const apuestas = pgTable(
  "apuestas",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    jornadaId: uuid("jornada_id")
      .notNull()
      .references(() => jornadas.id, { onDelete: "cascade" }),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    numeroApuesta: smallint("numero_apuesta").notNull(),
    partido1: text("partido_1").notNull(),
    partido2: text("partido_2").notNull(),
    partido3: text("partido_3").notNull(),
    partido4: text("partido_4").notNull(),
    partido5: text("partido_5").notNull(),
    partido6: text("partido_6").notNull(),
    partido7: text("partido_7").notNull(),
    partido8: text("partido_8").notNull(),
    partido9: text("partido_9").notNull(),
    partido10: text("partido_10").notNull(),
    partido11: text("partido_11").notNull(),
    partido12: text("partido_12").notNull(),
    partido13: text("partido_13").notNull(),
    partido14: text("partido_14").notNull(),
    sugerenciaPleno15: text("sugerencia_pleno_15"),
    creadaPor: uuid("creada_por")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    creadaPorElMismo: boolean("creada_por_el_mismo"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("apuestas_jornada_usuario_numero_key").on(
      t.jornadaId,
      t.usuarioId,
      t.numeroApuesta,
    ),
    check("apuestas_numero_check", sql`${t.numeroApuesta} IN (1, 2)`),
    check("apuestas_partido_1_check", sql`${t.partido1} ~ '^[1X2]$'`),
    check("apuestas_partido_2_check", sql`${t.partido2} ~ '^[1X2]$'`),
    check("apuestas_partido_3_check", sql`${t.partido3} ~ '^[1X2]$'`),
    check("apuestas_partido_4_check", sql`${t.partido4} ~ '^[1X2]$'`),
    check("apuestas_partido_5_check", sql`${t.partido5} ~ '^[1X2]$'`),
    check("apuestas_partido_6_check", sql`${t.partido6} ~ '^[1X2]$'`),
    check("apuestas_partido_7_check", sql`${t.partido7} ~ '^[1X2]$'`),
    check("apuestas_partido_8_check", sql`${t.partido8} ~ '^[1X2]$'`),
    check("apuestas_partido_9_check", sql`${t.partido9} ~ '^[1X2]$'`),
    check("apuestas_partido_10_check", sql`${t.partido10} ~ '^[1X2]$'`),
    check("apuestas_partido_11_check", sql`${t.partido11} ~ '^[1X2]$'`),
    check("apuestas_partido_12_check", sql`${t.partido12} ~ '^[1X2]$'`),
    check("apuestas_partido_13_check", sql`${t.partido13} ~ '^[1X2]$'`),
    check("apuestas_partido_14_check", sql`${t.partido14} ~ '^[1X2]$'`),
    check("apuestas_pleno_check", sql`${t.sugerenciaPleno15} ~ '^[012M]-[012M]$'`),
  ],
);
