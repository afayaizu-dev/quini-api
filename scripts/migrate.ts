import { env } from "../src/config/env.js";
import { migrateDatabase } from "../src/db/migrate.js";

migrateDatabase(env.DATABASE_URL)
    .then(() => {
        console.log("Migraciones aplicadas.");
    })
    .catch((err: unknown) => {
        console.error(err);
        process.exitCode = 1;
    });