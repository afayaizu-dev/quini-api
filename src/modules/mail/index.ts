import { env } from "../../config/env.js";
import { sendMail as sendGmail } from "./gmail.js";
import { sendMail as sendSmtp } from "./smtp.js";
import type { SendMailInput } from "./types.js";

export type { SendMailInput } from "./types.js";

// Punto único de envío: el transporte se elige con MAIL_TRANSPORT (gmail por defecto).
export async function sendMail(input: SendMailInput): Promise<void> {
    if (env.MAIL_TRANSPORT === "smtp") {
        await sendSmtp(input);
        return;
    }
    await sendGmail(input);
}
