# ADR-0018 — Acceso cerrado por invitación

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D18)

## Decisión

**Se elige:** Invitación de un solo uso, emitida por un admin, con TTL de 7 días; también obligatoria para el login con Google

Una peña es un grupo cerrado. Cerrar solo el registro por contraseña y dejar Google abierto sería el error clásico: cualquiera con una cuenta de Gmail podría entrar.

## Alternativas consideradas

- Registro abierto
- Allowlist de emails en configuración

## Consecuencias

Módulo `invitations` implementado; la misma restricción se aplica al flujo de Google OAuth.
