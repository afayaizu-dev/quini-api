import { describe, expect, test } from "vitest";
import { createHandoffCode, consumeHandoffCode } from "../../src/modules/auth/google-handoff.js";
import type { TokenResponse } from "../../src/modules/auth/auth.schemas.js";

const TOKENS: TokenResponse = {
    access_token: "access-token",
    token_type: "Bearer",
    expires_in: 900,
    refresh_token: "refresh-token",
};

describe("google-handoff (unit)", () => {
    test("un código creado se puede canjear exactamente una vez", () => {
        const code = createHandoffCode(TOKENS);

        expect(consumeHandoffCode(code)).toEqual(TOKENS);
        expect(consumeHandoffCode(code)).toBeUndefined();
    });

    test("un código desconocido devuelve undefined", () => {
        expect(consumeHandoffCode("codigo-que-no-existe")).toBeUndefined();
    });
});
