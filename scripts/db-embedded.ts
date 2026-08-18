import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { migrateDatabase } from "../src/db/migrate.js";

const port = Number(process.env.EMBEDDED_PG_PORT ?? 54329);
const databaseDir = process.env.EMBEDDED_PG_DIR ?? "./.pgdata";
const user = "quini";
const password = "quini";
const database = "quini";

mkdirSync(databaseDir, { recursive: true });
const yaEstabaInicializado = existsSync(path.join(databaseDir, "PG_VERSION"));

const pg = new EmbeddedPostgres({
    databaseDir,
    user,
    password,
    port,
    persistent: true,
});

async function main(): Promise<void> {
    if (!yaEstabaInicializado) {
        await pg.initialise();
    }
    await pg.start();

    try {
        await pg.createDatabase(database);
    } catch {
        /* la base ya existía de una sesión anterior */
    }

    const databaseUrl = `postgres://${user}:${password}@127.0.0.1:${port}/${database}`;
    await migrateDatabase(databaseUrl);

    console.log(`Postgres embebido listo en ${databaseUrl}`);
    console.log("Ctrl+C para detenerlo.");
}

async function shutdown(): Promise<void> {
    console.log("\nDeteniendo Postgres embebido...");
    await pg.stop();
    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
