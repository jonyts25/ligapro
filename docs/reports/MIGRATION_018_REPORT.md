# Migration 018 — Season public read models

**Archivo:** `supabase/migrations/20260714200000_season_public_read_models.sql`  
**Aplicada:** `npx supabase db push --linked`

## Objetivos

- Standings desde marcador oficial
- Goleadores desde `goal` (sin `own_goal`)
- Resumen disciplinario interno
- Wrappers públicos SECURITY DEFINER sin SELECT anon en tablas base

## Funciones

### Internas (`authenticated`)

- `get_season_standings(p_season_id)`
- `get_season_top_scorers(p_season_id)`
- `get_season_discipline_summary(p_season_id)`

Auth vía `is_member_of`. Sin `organization_id` / actor externo.

### Públicas (`anon`, `authenticated`)

- `get_public_season_overview(org, slug)`
- `get_public_season_standings(org, slug)`
- `get_public_season_matches(org, slug)`
- `get_public_season_scorers(org, slug)`
- `get_public_season_discipline(org, slug)`

Solo si `visibility = 'public'`. Columna `position` entrecomillada (reservada SQL).

Helpers: `__assert_season_readable`, `__resolve_public_season`, `__season_standings_core` — sin EXECUTE a roles producto.

## Grants

- Internas: REVOKE PUBLIC/anon; GRANT authenticated
- Públicas: REVOKE PUBLIC; GRANT anon, authenticated
- Sin GRANT SELECT anon en base tables

## Pruebas

`supabase/tests/018_season_public_read_models.sql` — 32/32 PASS.
