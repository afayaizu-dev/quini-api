# ADR-0019 — Autorización

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D19)

## Decisión

**Se elige:** Por rol (`user`/`admin`) en el claim del JWT, con middleware `requireRole`

Dos roles cubren el caso real de una peña de 10-30 personas. Se deja el claim `scope` reservado para granularidad futura sin cambiar el contrato.

## Alternativas consideradas

- Scopes granulares
- ACL por recurso

## Consecuencias

Middleware `requireRole` real, usado en las rutas administrativas del proyecto.
