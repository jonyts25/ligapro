# Migration 006a Report — Matches, Officials & field_reservations.match_id FK

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712222715_create_matches_and_officials.sql` |
| Tests | `supabase/tests/006a_matches_officials_isolation.sql` |
| Tipos TS | `src/types/database.ts` (regenerados) |
| Domain model | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_006A_REPORT.md` |

### Objetos

- Tabla `matches` + triggers org-vs-season y home/away-vs-season_id
- Tabla `match_officials` + trigger org-vs-match
- **Cierre pendiente 005:**
  - `field_reservations.match_id` → FK `matches(id)` ON DELETE SET NULL
  - CHECK `field_reservations_match_type_requires_match_id_check`
- RLS owner/admin CRUD; members SELECT; sin captura por oficiales (006b)

## Pendiente 005 cerrado (evidencia prueba 10)

| Caso | Resultado | Details |
|------|-----------|---------|
| 10a `reservation_type='match'` con `match_id` NULL | **PASS** | `field_reservations_match_type_requires_match_id_check` |
| 10b `reservation_type='match'` con `match_id` válido | **PASS** | reservation insertada y vinculada |

## Decisiones / notas

1. `field_reservation_id` nullable en matches (fixture antes que horario).
2. Trigger dedicado valida **season_id** de home/away (no solo organization_id).
3. Captura de resultado por `match_officials` **no** implementada — 006b + `match_events`.
4. Generación automática de fixture / reservations tipo match — futuro.

## Flujo

```text
supabase migration new create_matches_and_officials
→ editar
→ supabase db push --linked
```

Timestamp: `20260712222715` (local = remoto).

## Resultado de pruebas

| Test | Resultado | Details |
|------|-----------|---------|
| 1a/1b aislamiento | **PASS** | visible=0 |
| 2 member no crea match | **PASS** | bloqueado (org/season mismatch bajo JWT member) |
| 3 admin crea match | **PASS** | id insertado |
| 4 org ≠ season | **PASS** | must match seasons.organization_id |
| 5 home = away | **PASS** | home_away_distinct_check |
| 6a/6b team de otra season | **PASS** | belongs to season … |
| 7 marcador parcial | **PASS** | scores_both_or_neither_check |
| 8 status inválido | **PASS** | matches_status_check |
| 9 sin reservation | **PASS** | NULL permitido |
| 10a/10b FK+CHECK match_id | **PASS** | cierra 005 |
| 11a/11b officials unique/roles | **PASS** | UNIQUE / 2 roles OK |
| 12 officials org mismatch | **PASS** | must match matches.organization_id |

**16/16 PASS**

## Desviaciones

1. Ninguna funcional.
2. Warning Docker en `db push` (cache); push remoto OK.

## Pendiente siguiente

- 006b: `match_events` (+ posible permiso de captura)
- `discipline_suspensions`, `season_roles`
- UI / vistas públicas

Commit pendiente de aprobación humana.
