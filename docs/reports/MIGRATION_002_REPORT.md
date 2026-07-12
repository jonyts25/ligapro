# Migration 002 Report — Venues, Fields & Availability Rules

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712204334_create_venues_fields_availability.sql` |
| Tests de aislamiento | `supabase/tests/002_venues_fields_isolation.sql` |
| Tipos TS regenerados | `src/types/database.ts` |
| Domain model actualizado | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_002_REPORT.md` |

### Objetos de base de datos

- Tablas: `venues`, `fields`, `field_availability_rules`
- Triggers de consistencia: `fields_enforce_org_matches_venue`, `field_availability_rules_enforce_org_matches_field`
- `updated_at`: reutiliza `set_updated_at` de Migration 001
- RLS en las tres tablas; policies reutilizan `is_member_of` / `has_role_in_org`
- Sin acceso `anon` / público a tablas base

## Decisiones tomadas

1. **`organization_id` denormalizado** en `fields` y `field_availability_rules` para RLS simple, con trigger que exige igualdad con el padre (`venue` / `field`).
2. **CRUD venues/fields/rules**: solo `organization_owner` u `organization_admin`; members solo SELECT.
3. **Sin detección de traslapes** entre reglas de disponibilidad — informativo; conflictos duros van en `field_reservations` (bloque futuro).
4. **Sin rol “encargado de cancha”** — fuera del alcance congelado.
5. **Sin `field_reservations`** en este bloque.
6. **Tests en archivo separado** (`002_…`) para no tocar la suite 001 ya aprobada y poder re-ejecutar solo infraestructura física.

## Flujo de migración (aprendizaje 001 aplicado)

```text
supabase migration new create_venues_fields_availability
→ editar archivo generado
→ supabase db push --linked
```

Timestamps local y remoto coinciden: `20260712204334`.

## Resultado de pruebas (Tarea H)

```bash
npx supabase db query --linked -f supabase/tests/002_venues_fields_isolation.sql
```

| Test | Resultado | Details |
|------|-----------|---------|
| 1a User A no lee venues de org B | **PASS** | `venues_visible=0` |
| 1b User A no lee fields de org B | **PASS** | `fields_visible=0` |
| 1c User A no lee rules de org B | **PASS** | `rules_visible=0` |
| 2 Member no crea venue | **PASS** | RLS policy violation |
| 3 Admin crea venue + field | **PASS** | venue + field insertados |
| 4 Field org ≠ venue org | **PASS** | exception must match venues.organization_id |
| 5 ends_at ≤ starts_at | **PASS** | check `field_availability_rules_time_range_check` |
| 6 day_of_week fuera 0–6 | **PASS** | check `field_availability_rules_day_of_week_check` |

**8/8 PASS**

## Desviaciones respecto al prompt

1. Ninguna funcional. Se eligió archivo de tests **separado** (`002_venues_fields_isolation.sql`) en lugar de ampliar `001_…` — justificado arriba.
2. Warning de Docker al final de `db push` (cache de catálogo local); la migración remota aplicó correctamente (`Finished supabase db push`, list sync OK).

## Aplicación

- Proyecto: `ligapro-dev` (`akgcamaegpboewsbbevl`)
- Migración remota: `create_venues_fields_availability` (version `20260712204334`)

## Pendiente / fuera de alcance

- `field_reservations` (calendario/partidos)
- competitions / seasons / teams / players
- vistas públicas (ADR 0005)
- UI
- Commit pendiente de aprobación humana
