import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";
import { migrateDatabase } from "../../src/db/migrate.js";

async function getFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.unref();
        server.on("error", reject);
        server.listen(0, () => {
            const address = server.address();
            if (address === null || typeof address === "string") {
                reject(new Error("No se pudo obtener un puerto libre."));
                return;
            }
            const { port } = address;
            server.close(() => resolve(port));
        });
    });
}

let pg: EmbeddedPostgres | undefined;

export async function setup(): Promise<void> {
    const port = await getFreePort();
    const databaseDir = mkdtempSync(path.join(tmpdir(), "quini-test-pg-"));

    pg = new EmbeddedPostgres({
        databaseDir,
        user: "quini_test",
        password: "quini_test",
        port,
        persistent: false,
    });

    await pg.initialise();
    await pg.start();
    await pg.createDatabase("quini_test");

    const databaseUrl = `postgres://quini_test:quini_test@127.0.0.1:${port}/quini_test`;
    process.env.DATABASE_URL = databaseUrl;
    await migrateDatabase(databaseUrl);
}

export async function teardown(): Promise<void> {
    await pg?.stop();
}