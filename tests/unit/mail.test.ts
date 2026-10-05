import { beforeEach, describe, expect, test, vi } from "vitest";

const envMock = vi.hoisted(() => ({ MAIL_TRANSPORT: "gmail" as "gmail" | "smtp" }));

vi.mock("../../src/config/env.js", () => ({ env: envMock }));
vi.mock("../../src/modules/mail/gmail.js", () => ({ sendMail: vi.fn() }));
vi.mock("../../src/modules/mail/smtp.js", () => ({ sendMail: vi.fn() }));

import { sendMail } from "../../src/modules/mail/index.js";
import { sendMail as sendGmail } from "../../src/modules/mail/gmail.js";
import { sendMail as sendSmtp } from "../../src/modules/mail/smtp.js";

const input = { to: "socio@test.local", subject: "Boletín", html: "<p>Hola</p>" };

describe("sendMail", () => {
    beforeEach(() => {
        vi.mocked(sendGmail).mockReset();
        vi.mocked(sendSmtp).mockReset();
    });

    test("MAIL_TRANSPORT=gmail -> envía por Gmail API", async () => {
        envMock.MAIL_TRANSPORT = "gmail";

        await sendMail(input);

        expect(sendGmail).toHaveBeenCalledWith(input);
        expect(sendSmtp).not.toHaveBeenCalled();
    });

    test("MAIL_TRANSPORT=smtp -> envía por SMTP", async () => {
        envMock.MAIL_TRANSPORT = "smtp";

        await sendMail(input);

        expect(sendSmtp).toHaveBeenCalledWith(input);
        expect(sendGmail).not.toHaveBeenCalled();
    });

    test("propaga el error del transporte", async () => {
        envMock.MAIL_TRANSPORT = "smtp";
        vi.mocked(sendSmtp).mockRejectedValue(new Error("SMTP caído"));

        await expect(sendMail(input)).rejects.toThrow("SMTP caído");
    });
});
