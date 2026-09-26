import { randomBytes } from "node:crypto";
import type { TokenResponse } from "./auth.schemas.js";

const TTL_MS = 60_000;
const codes = new Map<string, { tokens: TokenResponse; expiresAt: number }>();

function purgeExpired(): void {
    const now = Date.now();
    for (const [key, value] of codes) {
        if (value.expiresAt < now) codes.delete(key);
    }
}

export function createHandoffCode(tokens: TokenResponse): string {
    purgeExpired();
    const code = randomBytes(32).toString("base64url");
    codes.set(code, { tokens, expiresAt: Date.now() + TTL_MS });
    return code;
}

export function consumeHandoffCode(code: string): TokenResponse | undefined {
    purgeExpired();
    const entry = codes.get(code);
    if (!entry) return undefined;
    codes.delete(code);
    return entry.tokens;
}
