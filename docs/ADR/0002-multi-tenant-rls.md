# ADR 0002 — Multi-tenant con RLS

## Status

Accepted

## Context

LigaPro atiende múltiples organizaciones (ligas/administradores de canchas). Los datos operativos deben quedar aislados entre tenants. Un fallo de aislamiento sería crítico en un producto B2B.

## Decision

Multi-tenancy se implementa con:

- `organization_id` en las tablas de negocio relevantes
- Row Level Security (RLS) en Postgres/Supabase
- constraints que impiden referencias cross-tenant

Las políticas RLS validan membresía/roles del usuario autenticado respecto a la organización.

## Consequences

- Toda consulta privilegiada debe respetar el tenant.
- El diseño de FKs y constraints debe anticipar el aislamiento.
- Las pruebas de seguridad RLS son obligatorias antes de producción.
- Queries sin filtro de organización no son aceptables como patrón de acceso.
