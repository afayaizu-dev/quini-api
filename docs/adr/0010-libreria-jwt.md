# ADR-0010 — Librería JWT

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D10)

## Decisión

**Se elige:** jose

Moderna, ESM nativa, soporta JWKS, sin dependencias transitivas pesadas.

## Alternativas consideradas

- jsonwebtoken

## Consecuencias

`jose` y `google-auth-library` confirmados en `dependencies`.
