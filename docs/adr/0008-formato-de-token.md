# ADR-0008 — Formato de los tokens de sesión

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D8)

## Decisión

**Se elige:** JWT propio (access) + token opaco (refresh)

El access se valida sin ir a base de datos. El refresh es opaco y revocable.

## Alternativas consideradas

- Sesiones en servidor
- JWT también como refresh

## Consecuencias

`jose` firma/verifica el access token; el refresh opaco se persiste y rota en base de datos.
