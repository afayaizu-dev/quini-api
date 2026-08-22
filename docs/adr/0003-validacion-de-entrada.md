# ADR-0003 — Validación de entrada

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D3)

## Decisión

**Se elige:** Zod

Infiere tipos TypeScript desde el esquema: valida y tipa con una sola definición.

## Alternativas consideradas

- Joi
- class-validator
- ajv a mano

## Consecuencias

`zod` ^4.4.3 en dependencies; valida y tipa cada `src/modules/*/*.schemas.ts`.
