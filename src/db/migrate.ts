import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

export async function migrateDatabase(databaseUrl: string): Promise<void> {
    const pool = new Pool({ connectionString: databaseUrl });
    const db = drizzle(pool);

    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS citext`);
    await migrate(db, { migrationsFolder: "./drizzle" });

    await pool.end();
}