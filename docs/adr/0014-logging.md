# ADR-0014 — Logging

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D14)

## Decisión

**Se elige:** pino + pino-http + requestId

Logs JSON correlacionables por petición, imprescindibles para depurar autenticación.

## Alternativas consideradas

- console.log
- winston

## Consecuencias

`pino` + `pino-http` en dependencies; `pino-pretty` en desarrollo.
