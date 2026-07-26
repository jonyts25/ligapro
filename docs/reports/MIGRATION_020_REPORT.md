# Migration 020 — Disciplina, vicecapitán, marcas de pago internas

**Archivo:** `supabase/migrations/20260715000000_discipline_vice_captain_payment_marks.sql`  
**Aplicada:** `npx supabase db push --linked` → **Remote database is up to date**

Historial remoto alineado: entradas MCP de desarrollo (`20260726182704`, `20260726182741`) marcadas `reverted`; migración canónica `20260715000000` marcada `applied`. Fix RLS de marcas de pago incluido en el archivo canónico (`is_team_leader_for_roster_player`).

## Objetivos

- Alinear ajustes de `discipline_suspensions` al patrón RPC + motivo (como `match_events` / 017)
- Vicecapitán en roster con mismos privilegios de reagendado que el capitán
- Tabla informal `season_team_player_payment_marks` (sin mezclar con ledger oficial)

## 1. Disciplina (admin)

### Cambios schema

- `suspension_type`: agrega `'expulsion'` (CHECK explícito; no valores arbitrarios)
- `discipline_suspensions_source_event_required_check`: `administrative` **y** `expulsion` exigen `source_match_event_id IS NULL`
- `REVOKE UPDATE, DELETE` para `authenticated`; policies directas eliminadas

### RPCs (`SECURITY DEFINER`, owner/admin, `p_reason` obligatorio)

| RPC | Efecto |
| --- | --- |
| `waive_discipline_suspension(p_suspension_id, p_reason)` | `status = 'waived'` |
| `adjust_discipline_suspension_length(p_suspension_id, p_matches_remaining, p_reason)` | Sobrescribe `matches_remaining` |
| `create_administrative_suspension(p_season_team_player_id, p_suspension_type, p_matches_remaining, p_reason)` | Alta manual; tipos `administrative` \| `expulsion` |

Motivo en `notes`. Audit log: trigger `audit_discipline_suspensions` (Migration 010) — sin cambios.

**No tocado:** `match_events_generate_discipline_suspensions` (007).

## 2. Vicecapitán

### `season_team_players`

| Columna / regla | Notas |
| --- | --- |
| `is_vice_captain` | boolean NOT NULL default false |
| CHECK exclusión | `NOT (is_captain AND is_vice_captain)` |
| CHECK active | vice debe estar `registration_status = 'active'` |
| Índice único parcial | un vice por `season_team_id` |

### RPCs / extensiones 019

| RPC | Cambio |
| --- | --- |
| `set_season_team_vice_captain(p_season_team_id, p_player_id)` | **Nueva**; misma validación que capitán |
| `set_season_team_captain` | Limpia `is_vice_captain` al designar capitán |
| `set_season_team_player_status` | Limpia capitán **y** vice en inactive/suspended |
| `invite_captain_to_roster` | Acepta filas con `is_captain` **o** `is_vice_captain` |

Tabla `captain_invitations` **sin renombrar** — reutiliza flujo 019.

### Helpers / RLS reagendado

- `is_active_captain_or_vice_of_season_team` — nuevo helper base
- `is_active_captain_of_season_team` / `is_active_captain_of_match` — delegan a capitán **o** vice
- Policies `matches_select_active_captain`, `match_reschedule_requests_select_captain` — actualizadas

Vicecapitán **no** designa capitán ni tiene privilegios extra.

## 3. Marcas de pago internas

### `season_team_player_payment_marks`

| Columna | Notas |
| --- | --- |
| `season_team_player_id` | UNIQUE — una marca por jugador |
| `marked_paid` | boolean NOT NULL default false |
| `marked_by_profile_id` | FK → profiles |
| `notes` | text nullable |

Trigger de consistencia `organization_id` vs roster. **Sin** FK a finanzas oficiales.

### RPC

`set_player_payment_mark(p_season_team_player_id, p_marked_paid, p_notes?)` — capitán/vice activo vinculado; UPSERT.

### RLS

| Rol | SELECT | INSERT/UPDATE |
| --- | --- | --- |
| Capitán/vice vinculado (equipo propio) | sí | vía RPC (GRANT SELECT; policies usan `is_team_leader_for_roster_player`) |
| owner/admin | sí | **no** (solo lectura) |
| Otros | no | no |

**Nota técnica:** helper `is_team_leader_for_roster_player` es `SECURITY DEFINER` porque el capitán no es `organization_member` y no puede leer otras filas de roster en subqueries RLS.

## Grants

- `discipline_suspensions`: UPDATE/DELETE revocados para authenticated
- `season_team_player_payment_marks`: `REVOKE ALL` PUBLIC/anon; `GRANT SELECT` authenticated
- RPCs nuevas: `GRANT EXECUTE` authenticated; `REVOKE` PUBLIC/anon

## Fuera de alcance (confirmado)

- `team_charges` / `team_payments` y RPCs de void
- Privilegios extra de capitán/vice (roster, cargos, captura)
- `match_events_generate_discipline_suspensions`
- Finanzas admin / dashboard de liga (frontend aparte)

## Pruebas

`supabase/tests/020_discipline_vice_captain_payment_marks.sql` — **15/15 PASS**.

Cobertura: RPCs disciplina con/sin motivo, REVOKE UPDATE/DELETE, constraint expulsion/administrative, exclusión capitán/vice, índice único vice, reagendado vice = capitán, aislamiento marcas de pago cross-team, admin read-only marcas, jugador sin profile sin privilegios.

## Tipos TS

`src/types/database.ts` regenerado (`npx supabase gen types typescript --project-id akgcamaegpboewsbbevl`).

## Docs actualizados

- `docs/DOMAIN_MODEL.md`
- `docs/MATCH_OPERATION_AND_CAPTURE.md`
- `docs/TEAMS_AND_ROSTERS.md`
