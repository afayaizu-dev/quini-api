import { OAuth2Client } from "google-auth-library";
import { env } from "../../config/env.js";

interface GmailConfig {
    client: OAuth2Client;
    senderEmail: string;
}

function requireGmailConfig(): GmailConfig {
    const clientId = env.GOOGLE_CLIENT_ID;
    const clientSecret = env.GOOGLE_CLIENT_SECRET;
    const refreshToken = env.GMAIL_REFRESH_TOKEN;
    const senderEmail = env.GMAIL_SENDER_EMAIL;

    if (!clientId || !clientSecret || !refreshToken || !senderEmail) {
        throw new Error(
            'Faltan GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GMAIL_REFRESH_TOKEN/GMAIL_SENDER_EMAIL en .env (usa "npm run mail:authorize" para obtener el refresh token).',
        );
    }

    const client = new OAuth2Client({ clientId, clientSecret });
    client.setCredentials({ refresh_token: refreshToken });

    return { client, senderEmail };
}

// RFC 2047: cada encoded-word mide como máximo 75 caracteres; con el envoltorio
// "=?UTF-8?B?...?=" (12) quedan 63 de base64, es decir 45 bytes por fragmento.
const MAX_BYTES_POR_FRAGMENTO = 45;

function encodeHeader(value: string): string {
    const fragmentos: string[] = [];
    let actual = "";
    let bytesActual = 0;

    for (const caracter of value) {
        const bytes = Buffer.byteLength(caracter, "utf-8");
        if (bytesActual + bytes > MAX_BYTES_POR_FRAGMENTO) {
            fragmentos.push(actual);
            actual = "";
            bytesActual = 0;
        }
        actual += caracter;
        bytesActual += bytes;
    }
    fragmentos.push(actual);

    return fragmentos.map((f) => `=?UTF-8?B?${Buffer.from(f, "utf-8").toString("base64")}?=`).join("\r\n ");
}

function buildRawMessage(from: string, to: string, subject: string, html: string): string {
    const message = [
        `From: ${from}`,
        `To: ${to}`,
        `Subject: ${encodeHeader(subject)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: base64",
        "",
        Buffer.from(html, "utf-8").toString("base64"),
    ].join("\r\n");

    return Buffer.from(message, "utf-8").toString("base64url");
}

export interface SendMailInput {
    to: string;
    subject: string;
    html: string;
}

/* v8 ignore start -- @preserve */
export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
    const { client, senderEmail } = requireGmailConfig();

    const accessTokenResponse = await client.getAccessToken();
    const accessToken = accessTokenResponse.token;
    if (!accessToken) {
        throw new Error("No se pudo obtener un access token de Gmail (refresh token caducado o revocado).");
    }

    const raw = buildRawMessage(senderEmail, to, subject, html);

    const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ raw }),
    });

    if (!res.ok) {
        const body = await res.text();
        throw new Error(`Gmail API devolvió ${res.status}: ${body}`);
    }
}
/* v8 ignore stop -- @preserve */
