# ADR-0024 — Observabilidad: trazas

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D24)

## Decisión

**Se elige:** OpenTelemetry preparado pero desactivado (`OTEL_ENABLED=false`); se activará cuando haya un problema de rendimiento que los logs no expliquen

Las trazas son la señal más cara (CPU, memoria y un backend adicional) y la menos necesaria con el volumen de usuarios real del proyecto. Correlacionar pino con un `trace_id` desde el principio cuesta poco y evita rehacer los logs después.

## Alternativas consideradas

- Instrumentar trazas desde el primer día
- no instrumentar nunca

## Consecuencias

Sigue desactivado, coherente con D23: se pospuso por la misma razón (sin tráfico real que justifique el coste).
