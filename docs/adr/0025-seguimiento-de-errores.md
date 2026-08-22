# ADR-0025 — Seguimiento de errores (tipo Sentry)

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D25)

## Decisión

**Se elige:** Aplazado; si hace falta, GlitchTip (compatible con el SDK de Sentry)

Sentry autoalojado exige unos 8 GB de RAM y una docena de contenedores. Logs estructurados más alertas de tasa de error 5xx cubren la mayor parte del valor a coste cero.

## Alternativas consideradas

- Sentry self-hosted
- Sentry SaaS

## Consecuencias

Sigue aplazado; no se ha instalado ningún sistema de error tracking en el proyecto.
