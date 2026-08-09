import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { citext } from "./_helpers.js";
import { users } from "./users.js";

export const invitations = pgTable(
    "invitations",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        email: citext("email").notNull(),
        role: text("role").notNull(),
        tokenHash: text("token_hash").notNull(),
        invitedBy: uuid("invited_by").notNull().references(() => users.id),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        acceptedAt: timestamp("accepted_at", { withTimezone: true }),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("invitations_pending_email_key")
            .on(t.email)
            .where(sql`${t.acceptedAt} is null and ${t.revokedAt} is null`),
        check("invitations_role_check", sql`${t.role} in ('user','admin')`),
    ],
);
