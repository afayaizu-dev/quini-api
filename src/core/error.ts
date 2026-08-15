


const SQLSTATE_UNIQUE_VIOLATION = "23505";
const SQLSTATE_FOREIGN_KEY_VIOLATION = "23503";
const SQLSTATE_RESTRICT_VIOLATION = "23001";

export function isUniqueViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === SQLSTATE_UNIQUE_VIOLATION;
}

export function isForeignKeyViolation(err: unknown): boolean {
    /* v8 ignore next -- @preserve */
    const cause = err instanceof Error ? err.cause : undefined;
    /* v8 ignore next -- @preserve */
    if (typeof cause !== "object" || cause === null || !("code" in cause)) return false;
    return cause.code === SQLSTATE_FOREIGN_KEY_VIOLATION || cause.code === SQLSTATE_RESTRICT_VIOLATION;
}