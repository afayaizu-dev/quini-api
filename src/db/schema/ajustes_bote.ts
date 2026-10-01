import { sql } from "drizzle-orm";
import { check, date, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { temporadas } from "./temporadas.js";
import { users } from "./users.js";

export const ajustesBote = pgTable(
    "ajustes_bote",
    {
        id: uuid("id")
            .primaryKey()
            .default(sql`uuidv7()`),
        temporadaId: uuid("temporada_id")
            .notNull()
            .references(() => temporadas.id, { onDelete: "restrict" }),
        // NULL = ajuste manual; no NULL = bote heredado de esa temporada (lo crea POST /temporadas/:codigo/activar).
        origenTemporadaId: uuid("origen_temporada_id").references(() => temporadas.id, {
            onDelete: "restrict",
        }),
        importe: numeric("importe", { precision: 12, scale: 2, mode: "number" }).notNull(),
        motivo: text("motivo").notNull(),
        fecha: date("fecha").notNull(),
        registradoPor: uuid("registrado_por")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("ajustes_bote_un_heredado_por_temporada")
            .on(t.temporadaId)
            .where(sql`${t.origenTemporadaId} is not null`),
        check("ajustes_bote_origen_distinto_check", sql`${t.origenTemporadaId} <> ${t.temporadaId}`),
    ],
);
