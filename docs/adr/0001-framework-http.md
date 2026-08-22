# ADR-0001 — Framework HTTP

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D1)

## Decisión

**Se elige:** Express 5

Lo pide el prompt. Express 5 propaga errores de handlers `async` automáticamente, lo que elimina el `try/catch` en cada ruta.

## Alternativas consideradas

- Fastify
- NestJS
- Hono

## Consecuencias

Confirmado en `package.json` (`express` ^5.2.1) y en el manejo global de errores de `src/middleware/error-handler.ts`.
