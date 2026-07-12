# ADR 0005 — Vistas públicas explícitas

## Status

Accepted

## Context

La consulta pública (tablas, fixture, goleo) es parte del ciclo MVP, pero el rol `anon` no debe leer tablas base con datos operativos, PII o finanzas.

## Decision

La lectura pública ocurre únicamente mediante vistas (o endpoints) explícitas pensadas para exposición.

El rol `anon` no accede a tablas base. Las vistas públicas exponen solo columnas y filas aprobadas para consumo externo.

## Consequences

- Toda superficie pública se declara y revisa de forma consciente.
- RLS/privilegios de tablas base permanecen estrictos.
- Cambios de schema interno no se filtran automáticamente al público.
- Se requiere mantenimiento de vistas al evolucionar el modelo.
