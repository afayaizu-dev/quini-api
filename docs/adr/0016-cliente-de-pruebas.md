# ADR-0016 — Cliente de pruebas manuales

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D16)

## Decisión

**Se elige:** Insomnia + colección versionada + `inso` CLI

`inso` permite ejecutar la colección como smoke test dentro de CI.

## Alternativas consideradas

- Postman
- curl

## Consecuencias

Colección versionada en `insomnia/`, ejecutada en CI vía `inso run test`.
