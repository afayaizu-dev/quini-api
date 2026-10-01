import { env } from "../src/config/env.js";
import { sendMail } from "../src/modules/mail/gmail.js";

function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const arg of argv) {
        if (!arg.startsWith("--")) continue;
        const [key, value] = arg.slice(2).split("=");
        if (key) args[key] = value ?? true;
    }
    return args;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const to = typeof args.to === "string" ? args.to : env.GMAIL_SENDER_EMAIL;

    if (!to) {
        console.error("Uso: npm run mail:test -- --to=destinatario@ejemplo.com (o define GMAIL_SENDER_EMAIL para enviarte a ti mismo)");
        process.exitCode = 1;
        return;
    }

    console.log(`Enviando correo de prueba a ${to}...`);

    await sendMail({
        to,
        subject: "Prueba de envío — quini-api",
        html: `<p>Si lees esto, el envío por Gmail API + OAuth2 funciona correctamente.</p><p>Enviado: ${new Date().toISOString()}</p>`,
    });

    console.log("Correo enviado.");
}

main().catch((err: unknown) => {
    console.error("Fallo al enviar:", err);
    process.exitCode = 1;
});
