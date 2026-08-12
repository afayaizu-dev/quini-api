import { beforeEach } from "vitest";
import { db } from "../../src/db/index.js";
import { sql } from "drizzle-orm";

beforeEach(async () => {
    await db.execute(sql`
        TRUNCATE TABLE
            partidos, jornadas, equipos, temporadas,
            oauth_accounts, refresh_tokens, invitations, users
        RESTART IDENTITY CASCADE
    `);
})