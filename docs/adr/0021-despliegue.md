# ADR-0021 — Estrategia de despliegue

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D21)

## Decisión

**Se elige:** VPS con Docker Compose + Caddy (HTTPS automático), imagen publicada en GHCR

Caddy obtiene los certificados TLS solo, sin certbot ni cron. Construir en el VPS obligaría a tener devDependencies y toolchain allí, y haría el despliegue lento y frágil.

## Alternativas consideradas

- `git pull` y build en el propio VPS
- systemd + Node desnudo
- PaaS

## Consecuencias

Confirmado en `docker/Caddyfile`, `docker-compose.prod.yml` y `.github/workflows/deploy.yml`.
