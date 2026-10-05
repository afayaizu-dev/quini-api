import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import type { SendMailInput } from "./types.js";

let transporter: ReturnType<typeof nodemailer.createTransport> | undefined;

function requireSmtpTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = env;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !env.MAIL_FROM) {
        throw new Error("Faltan SMTP_HOST/SMTP_USER/SMTP_PASS/MAIL_FROM en .env para enviar por SMTP.");
    }

    transporter ??= nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        // 465 usa TLS implícito; el resto (587) negocia STARTTLS y lo exige.
        secure: SMTP_PORT === 465,
        requireTLS: SMTP_PORT !== 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    return { transporter, from: env.MAIL_FROM };
}

/* v8 ignore start -- @preserve */
export async function sendMail({ to, subject, html }: SendMailInput): Promise<void> {
    const { transporter, from } = requireSmtpTransporter();
    await transporter.sendMail({ from, to, subject, html });
}
/* v8 ignore stop -- @preserve */
