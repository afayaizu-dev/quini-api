import { sql } from "drizzle-orm";
import { index, inet, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const refreshTokens = pgTable(
    "refresh_tokens",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        tokenHash: text("token_hash").notNull(),
        familyId: uuid("family_id").notNull(),
        expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
        revokedAt: timestamp("revoked_at", { withTimezone: true }),
        userAgent: text("user_agent"),
        ip: inet("ip"),
    },
    (t) => [
        uniqueIndex("refresh_tokens_token_hash_key").on(t.tokenHash),
        index("refresh_tokens_family_id_idx").on(t.familyId),
    ],
);