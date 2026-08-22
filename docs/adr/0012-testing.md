# ADR-0012 — Framework de testing

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D12)

## Decisión

**Se elige:** Vitest + Supertest

Vitest habla ESM y TypeScript sin configuración adicional. Supertest llama a la app sin abrir puertos reales.

## Alternativas consideradas

- Jest
- node:test

## Consecuencias

`vitest` ^4.1.10 + `supertest` ^7.2.2, con cobertura vía `@vitest/coverage-v8`.
