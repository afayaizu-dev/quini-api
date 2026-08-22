# ADR-0015 — Versionado de la API

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D15)

## Decisión

**Se elige:** Prefijo `/api/v1`

Coste cero ahora; evita romper clientes existentes en el futuro.

## Alternativas consideradas

- Sin versión

## Consecuencias

Todas las rutas de `src/modules/*/*.routes.ts` cuelgan de `/api/v1`.
