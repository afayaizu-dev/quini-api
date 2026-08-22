# ADR-0022 — Migraciones en producción

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D22)

## Decisión

**Se elige:** Paso explícito antes de arrancar la nueva versión, en un contenedor de un solo uso

Con varias instancias, migrar al arrancar produce condiciones de carrera. Un fallo de migración debe detener el despliegue, no dejar la app arrancada a medias.

## Alternativas consideradas

- Migrar automáticamente al arrancar la app

## Consecuencias

Paso de migración explícito dentro de `.github/workflows/deploy.yml`, antes de recrear el contenedor de la API.
