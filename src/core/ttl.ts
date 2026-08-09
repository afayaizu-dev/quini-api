export function parseTtlToMs(ttl: string): number {
    const match = /^(\d+)(s|m|h|d)$/.exec(ttl);
    if (!match) {
        throw new Error(`TTL con formato no soportado: "${ttl}"`);
    }
    const [, amount, unit] = match;
    const unitMs = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit as "s" | "m" | "h" | "d"];
    return Number(amount) * unitMs;
}