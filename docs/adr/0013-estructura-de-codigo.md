# ADR-0013 — Estructura de código

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D13)

## Decisión

**Se elige:** Modular por feature, en capas

En MVC plano, añadir un recurso nuevo toca cinco carpetas transversales. Por feature, un módulo es una carpeta autocontenida.

## Alternativas consideradas

- MVC plano

## Consecuencias

11 módulos reales en `src/modules/` (apuestas, auth, calculos, dashboard, equipos, invitations, jornadas, pagos, resultados, temporadas, usuarios), cada uno con el mismo patrón de 5-6 ficheros.
