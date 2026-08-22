# ADR-0020 — Envío de invitaciones

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D20)

## Decisión

**Se elige:** Sin email por ahora: el endpoint devuelve la URL y el admin la reparte a mano

Cero infraestructura extra para un grupo de 10-30 personas. El punto de extensión queda marcado en el service.

## Alternativas consideradas

- Integrar SMTP/Resend/SES desde el principio

## Consecuencias

Sin dependencia de proveedor de email en el proyecto; el reparto es manual por el admin.
