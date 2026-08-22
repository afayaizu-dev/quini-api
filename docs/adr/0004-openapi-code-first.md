# ADR-0004 — OpenAPI

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D4)

## Decisión

**Se elige:** Generado desde Zod (code-first)

Evita que documentación y código diverjan. El requisito "todo documentado a nivel de endpoint" se vuelve automático.

## Alternativas consideradas

- Spec-first (YAML a mano)

## Consecuencias

`zod-openapi` genera `openapi/openapi.json` desde los mismos esquemas Zod que validan cada petición.
