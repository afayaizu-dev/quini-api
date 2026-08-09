import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const oauthAccounts = pgTable(
    "oauth_accounts",
    {
        id: uuid("id").primaryKey().default(sql`uuidv7()`),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        provider: text("provider").notNull(),
        providerUserId: text("provider_user_id").notNull(),
        email: text("email").notNull(),
        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
        uniqueIndex("oauth_accounts_provider_account_key").on(t.provider, t.providerUserId),
    ],
);