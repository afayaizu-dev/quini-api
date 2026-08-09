import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

const server = app.listen(env.PORT, () => {
    console.log(`API escuchando en http://localhost:${env.PORT}`);
});

function shutdown(signal: string): void {
    console.log(`${signal} recibido, cerrando servidor...`);
    server.close(() => {
        console.log("Servidor cerrado.");
        process.exit(0);
    });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));