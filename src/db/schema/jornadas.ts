import { sql } from "drizzle-orm";
import { check, date, integer, pgTable, smallint, timestamp, uniqueIndex, text, uuid } from "drizzle-orm/pg-core";
import { equipos } from "./equipos.js";
import { temporadas } from "./temporadas.js";
import { users } from "./users.js";


export const jornadas = pgTable(
    "jornadas",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        temporadaId: uuid("temporada_id")
            .notNull()
            .references(() => temporadas.id, { onDelete: "restrict" }),
        numeroJornada: integer("numero_jornada").notNull(),
        fecha: date("fecha").notNull(),
        fechaAperturaApuestas: timestamp("fecha_apertura_apuestas", { withTimezone: true }),
        fechaCierreApuestas: timestamp("fecha_cierre_apuestas", { withTimezone: true }),
        fechaCierreJornada: timestamp("fecha_cierre_jornada", { withTimezone: true }),
        apuestaPleno15: text("apuesta_pleno_15"),
        createdBy: uuid("created_by").notNull().references(() => users.id),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("jornadas_temporada_numero_key").on(t.temporadaId, t.numeroJornada),
        check("jornadas_numero_check", sql`${t.numeroJornada} >= 1`),
        check(
            "jornadas_ventana_check",
            sql`${t.fechaAperturaApuestas} is null or ${t.fechaCierreApuestas} is null or ${t.fechaCierreApuestas} > ${t.fechaAperturaApuestas}`,
        ),
        check("jornadas_pleno_check", sql`${t.apuestaPleno15} ~ '^[012M]-[012M]$'`),
    ],
);


export const partidos = pgTable(
    "partidos",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        jornadaId: uuid("jornada_id")
            .notNull()
            .references(() => jornadas.id, { onDelete: "cascade" }),
        orden: smallint("orden").notNull(),
        equipoLocalId: uuid("equipo_local_id")
            .notNull()
            .references(() => equipos.id, { onDelete: "restrict" }),
        equipoVisitanteId: uuid("equipo_visitante_id")
            .notNull()
            .references(() => equipos.id, { onDelete: "restrict" }),
    },
    (t) => [
        uniqueIndex("partidos_jornada_orden_key").on(t.jornadaId, t.orden),
        check("partidos_orden_check", sql`${t.orden} between 1 and 15`),
        check("partidos_equipos_distintos_check", sql`${t.equipoLocalId} <> ${t.equipoVisitanteId}`),
    ],
);


