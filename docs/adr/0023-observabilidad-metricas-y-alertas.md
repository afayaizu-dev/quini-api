# ADR-0023 — Observabilidad: métricas y alertas

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D23)

## Decisión

**Se elige:** `prom-client` en la API + Prometheus + Grafana OSS autoalojados, más Uptime Kuma fuera del VPS

Todo el stack elegido es de licencia libre y sin cuenta ni suscripción, y cabe en un VPS modesto.

## Alternativas consideradas

- SigNoz o Sentry self-hosted (4-8 GB de RAM)
- Datadog/New Relic (con suscripción)
- solo logs

## Consecuencias

Decidido pero no ejecutado: instrumentar un servicio sin tráfico real todavía aporta poco (ver cronología del proyecto, columna "Alcance decidido").
