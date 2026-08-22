# ADR-0011 — Hash de contraseñas

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D11)

## Decisión

**Se elige:** Argon2id (`@node-rs/argon2`)

Recomendación actual de OWASP frente a bcrypt/scrypt. `@node-rs` trae binarios precompilados.

## Alternativas consideradas

- bcrypt
- scrypt

## Consecuencias

`@node-rs/argon2` ^2.0.2 en `dependencies`.
