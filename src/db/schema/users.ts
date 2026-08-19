import { sql } from "drizzle-orm";
import { boolean, check, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { citext } from "./_helpers.js";


export const users = pgTable(
    "users",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        email: citext("email").notNull(),
        passwordHash: text("password_hash"),
        nombre: text("nombre").notNull(),
        apellidos: text("apellidos"),
        apodo: citext("apodo"),
        telefono: text("telefono"),
        saldoInicial: numeric("saldo_inicial", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
        role: text("role").notNull().default("user"),
        emailVerified: boolean("email_verified").notNull().default(false),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("users_email_key").on(t.email),
        uniqueIndex("users_apodo_key").on(t.apodo),
        check("users_role_check", sql`${t.role} in ('user', 'admin')`),
    ],
);