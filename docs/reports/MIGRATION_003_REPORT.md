# Migration 003 Report — Competitions, Seasons & Season Rules

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712205815_create_competitions_seasons_rules.sql` |
| Tests de aislamiento | `supabase/tests/003_competitions_seasons_isolation.sql` |
| Tipos TS regenerados | `src/types/database.ts` |
| Domain model actualizado | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_003_REPORT.md` |

### Objetos de base de datos

- Tablas: `competitions`, `seasons`, `season_rules`
- Triggers de consistencia: `seasons_enforce_org_matches_competition`, `season_rules_enforce_org_matches_season`
- Trigger `seasons_create_default_rules` (AFTER INSERT → fila `season_rules` con defaults)
- `updated_at` vía `set_updated_at` (reuso 001) en las tres tablas
- RLS reutilizando `is_member_of` / `has_role_in_org`
- Sin acceso `anon` / público a tablas base

## Decisiones tomadas

1. **`organization_id` denormalizado** en `seasons` y `season_rules`, con triggers de consistencia (mismo patrón 002).
2. **Slug UNIQUE compuesto** `(organization_id, slug)` — no global.
3. **`format_type` / `visibility`** como CHECKs de texto; sin tablas de groups/brackets; `visibility` no afecta RLS de miembros.
4. **CRUD** competitions/seasons/season_rules: solo `organization_owner` u `organization_admin`. Members: SELECT.
5. **`season_roles` / tournament_admin**: no implementados; quedan para cuando exista `season_teams`.
6. **`season_rules` auto-creadas** al insertar season (ver tradeoff abajo).
7. **Tests en archivo separado** `003_…`.

### Tradeoff: auto-crear `season_rules` vs creación explícita

| Opción | Pros | Contras |
|--------|------|---------|
| A. Trigger AFTER INSERT | Invariante 1:1 siempre; app no puede olvidar; alineado con profiles-from-auth | Menos flexible si se quisiera crear season sin rules (no es el caso) |
| B. App crea rules explícitamente | Un solo round-trip con valores custom al crear | Riesgo de season huérfana sin rules; más bugs de onboarding |

**Decisión: A (trigger).** Defaults viven en columnas; la app personaliza con `UPDATE`. Garantiza `UNIQUE(season_id)` útil desde el primer momento.

## Flujo de migración

```text
supabase migration new create_competitions_seasons_rules
→ editar archivo generado
→ supabase db push --linked
```

Timestamps local/remoto: `20260712205815`.

## Resultado de pruebas (Tarea H)

```bash
npx supabase db query --linked -f supabase/tests/003_competitions_seasons_isolation.sql
```

| Test | Resultado | Details |
|------|-----------|---------|
| 1a User A no lee competitions B | **PASS** | `competitions_visible=0` |
| 1b User A no lee seasons B | **PASS** | `seasons_visible=0` |
| 1c User A no lee season_rules B | **PASS** | `season_rules_visible=0` |
| 2 Member no crea competition | **PASS** | RLS policy violation |
| 3 Admin crea competition+season+rules | **PASS** | rules auto + UPDATE ok |
| 4 Season org ≠ competition org | **PASS** | exception must match competitions.organization_id |
| 5 Rules org ≠ season org | **PASS** | exception must match seasons.organization_id |
| 6 format_type inválido | **PASS** | `seasons_format_type_check` |
| 7 visibility inválido | **PASS** | `seasons_visibility_check` |
| 8 points_loss > points_draw | **PASS** | `season_rules_points_order_check` |
| 9 Dos rules misma season | **PASS** | `season_rules_season_id_unique` |
| 10a Mismo slug misma org | **PASS** | `seasons_organization_id_slug_unique` |
| 10b Mismo slug orgs distintas | **PASS** | `seasons_with_slug_across_orgs=2` |

**13/13 PASS**

## Desviaciones respecto al prompt

1. Ninguna funcional. Test 3 valida creación de competition+season y que `season_rules` exista (auto-trigger) + UPDATE por admin, en lugar de un INSERT manual de rules (que chocaría con el UNIQUE tras el auto-create).
2. Warning Docker en `db push` (cache local); push remoto OK.

## Aplicación

- Proyecto: `ligapro-dev` (`akgcamaegpboewsbbevl`)
- Migración: `create_competitions_seasons_rules` (`20260712205815`)

## Pendiente / fuera de alcance

- teams, players, season_teams, matches, groups, stages, brackets
- season_roles
- field_reservations
- vistas públicas
- UI
- Commit pendiente de aprobación humana
