import { createServer } from "node:http";
import { OAuth2Client } from "google-auth-library";
import { env } from "../src/config/env.js";

const REDIRECT_URI = "http://localhost:5555/oauth2callback";
const SCOPES = ["https://www.googleapis.com/auth/gmail.send"];

async function main(): Promise<void> {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        console.error("Faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET en .env");
        process.exitCode = 1;
        return;
    }

    const client = new OAuth2Client({ clientId, clientSecret, redirectUri: REDIRECT_URI });

    const authUrl = client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
    });

    console.log("Abre esta URL en el navegador con la cuenta de Gmail desde la que quieres enviar correos:");
    console.log(authUrl);
    console.log("\nEsperando la respuesta en http://localhost:5555 ...");

    await new Promise<void>((resolve, reject) => {
        const server = createServer((req, res) => {
            const url = new URL(req.url ?? "/", REDIRECT_URI);
            const code = url.searchParams.get("code");

            if (!code) {
                res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
                res.end("<p>Falta el parámetro code en la respuesta de Google.</p>");
                return;
            }

            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end("<p>Listo, puedes cerrar esta pestaña.</p>");

            client
                .getToken(code)
                .then(({ tokens }) => {
                    if (!tokens.refresh_token) {
                        console.error(
                            "Google no devolvió refresh_token (probablemente ya habías autorizado antes). " +
                                "Revoca el acceso en https://myaccount.google.com/permissions y vuelve a ejecutar este script.",
                        );
                        process.exitCode = 1;
                    } else {
                        console.log("\nGMAIL_REFRESH_TOKEN=" + tokens.refresh_token);
                    }
                    server.close(() => resolve());
                })
                .catch((err: unknown) => {
                    server.close(() => reject(err instanceof Error ? err : new Error(String(err))));
                });
        });

        server.on("error", reject);
        server.listen(5555);
    });
}

main().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
});
