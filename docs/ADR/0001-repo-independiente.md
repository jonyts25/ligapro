# ADR 0001 — Repo independiente

## Status

Accepted

## Context

LigaPro forma parte del ecosistema Sports Core junto con Mundial Compas, pero son productos distintos con ciclos de release, datos y despliegues propios. Mezclarlos en un monorepo o reutilizar el mismo proyecto Supabase aumentaría el acoplamiento y el riesgo operativo.

## Decision

LigaPro tiene repositorio Git, proyecto Supabase y deploy independientes de Mundial Compas.

Mundial Compas permanece solo como referencia conceptual/técnica en el workspace de Cursor; no se importa código ni se comparte base de datos.

## Consequences

- Control de versiones, CI/CD y secretos separados.
- Posible duplicación de patrones de dominio a corto plazo.
- Cambios en un producto no bloquean al otro.
- El workspace multi-root facilita consulta sin acoplar builds.
