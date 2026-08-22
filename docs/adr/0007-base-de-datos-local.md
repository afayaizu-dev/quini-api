# ADR-0007 — Base de datos en desarrollo local

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D7)

## Decisión

**Se elige:** Docker Compose (por defecto) + embedded-postgres (opcional)

La instancia embebida es útil para tests y para trabajar sin tener Docker arrancado.

## Alternativas consideradas

- Solo Docker

## Consecuencias

Scripts `db:up` (Compose) y `db:embedded` (persistente) conviven en `package.json`.
