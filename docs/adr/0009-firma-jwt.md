# ADR-0009 — Algoritmo de firma JWT

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D9)

## Decisión

**Se elige:** HS256 en desarrollo → RS256 en producción

RS256 permite validar con clave pública sin compartir el secreto. Se diseña para poder rotar (JWKS) sin tocar el negocio.

## Alternativas consideradas

- Solo HS256

## Consecuencias

Ver `src/modules/auth/tokens.ts` para el algoritmo activo en cada entorno.
