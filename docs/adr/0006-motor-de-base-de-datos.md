# ADR-0006 — Motor de base de datos

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D6)

## Decisión

**Se elige:** PostgreSQL 18 en los tres entornos

UUID, `CHECK`, índices parciales, transacciones y `CASCADE` sólidos. La versión 18 añade `uuidv7()` nativo. Misma versión en desarrollo, tests y producción evita bugs que solo aparecen en producción.

## Alternativas consideradas

- MySQL
- SQLite
- PostgreSQL 17

## Consecuencias

`docker-compose.yml`, `docker-compose.prod.yml` y `embedded-postgres` corren los tres sobre Postgres 18.
