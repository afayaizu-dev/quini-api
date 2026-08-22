# ADR-0005 — Acceso a datos

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D5)

## Decisión

**Se elige:** Drizzle ORM + migraciones SQL

Drizzle genera SQL legible y las migraciones son ficheros `.sql` que se pueden leer. Prisma esconde más; `pg` a pelo enseña más pero implica mucho boilerplate.

## Alternativas consideradas

- Prisma
- TypeORM
- `pg` a pelo

## Consecuencias

`drizzle-orm` ^0.45.2 + `drizzle-kit`; migraciones SQL versionadas en el repositorio.
