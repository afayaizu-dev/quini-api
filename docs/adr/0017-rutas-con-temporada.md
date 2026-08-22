# ADR-0017 — Forma de las rutas con temporada

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D17)

## Decisión

**Se elige:** Rutas planas `/api/v1/jornadas/{n}` resueltas contra la temporada activa, con `?temporada=<codigo>` para apuntar a otra

Mantiene intacto el contrato original y no rompe clientes al aparecer la segunda temporada. La temporada se comporta como contexto de trabajo, no como jerarquía de URL.

## Alternativas consideradas

- Rutas anidadas `/api/v1/temporadas/{codigo}/jornadas/{n}`

## Consecuencias

Ver `src/modules/jornadas/jornadas.routes.ts` y `jornadas.service.ts` (resolución de temporada activa).
