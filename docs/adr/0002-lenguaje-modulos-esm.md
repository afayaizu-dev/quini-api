# ADR-0002 — Lenguaje y sistema de módulos

- **Estado:** Aceptada
- **Fecha:** 2026-08-06
- **Fuente:** `docs/00-Plan-inicial.md` §3 (tabla ADR-lite, decisión D2)

## Decisión

**Se elige:** TypeScript + ESM (`"type": "module"`)

ESM es el presente; evita el mundo dual `require`/`import`.

## Alternativas consideradas

- CommonJS

## Consecuencias

`package.json` declara `"type": "module"`; no hay CommonJS en el proyecto.
