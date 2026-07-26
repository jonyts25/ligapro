# Migration 019 — Reagendado por consenso, cuenta de capitán, calendario dual-state

**Archivo:** `supabase/migrations/20260714230000_reschedule_consensus_captain_calendar.sql`  
**Aplicada:** `npx supabase db push --linked` → **Remote database is up to date**

Historial remoto alineado: entradas MCP en chunks (`20260726180742`–`20260726180906`) marcadas `reverted`; migración canónica `20260714230000` marcada `applied` tras verificar schema (tablas, índices, RPCs, RLS) sin drift.

## Objetivos

- Invitación de capitán → `players.profile_id` (sin crear Auth sin acción del invitado)
- RLS de capitán: leer partidos propios + operar reagendados
- Tabla `match_reschedule_requests` con máquina de estados (ADR 0006)
- `matches.calendar_status`: `programado` | `confirmado`
- Slot recurrente por temporada (`apply_recurring_slot_to_season`)
- Vista pública: `calendar_status` en `get_public_season_matches`

## Schema

### `matches.calendar_status`

Default `programado`. Transición a `confirmado` vía `confirm_match_calendar` o `resolve_match_reschedule(confirm)`.

### `season_rules` (nuevas columnas)

| Columna | Notas |
| --- | --- |
| `recurring_slot_field_id` | Cancha para bulk schedule |
| `recurring_slot_day_of_week` | 0–6, persistido al aplicar slot |
| `recurring_slot_start_time` | Hora local MX |
| `reschedule_request_ttl_hours` | Default **72** h para `expires_at` |

### `captain_invitations`

Email + token; estados `pending` \| `accepted` \| `expired` \| `cancelled`. Un pending por `season_team_player_id`.

### `match_reschedule_requests`

Estados: `proposed` → `approved_by_opponent` \| `rejected_by_opponent` \| `expired` → `confirmed_by_admin` \| `no_availability`.

Índice único parcial: un request abierto (`proposed` / `approved_by_opponent`) por `match_id`.

Expiración lazy: `expire_stale_match_reschedule_requests()` en cada RPC de lectura/escritura (sin cron).

## RPCs (`SECURITY DEFINER`, sin `organization_id`/actor en firma)

| RPC | Quién |
| --- | --- |
| `invite_captain_to_roster(p_season_team_player_id, p_email)` | owner/admin |
| `create_captain_player_with_invitation(...)` | owner/admin (F5) |
| `accept_captain_invitation(p_token)` | invitado autenticado |
| `propose_match_reschedule(p_match_id, p_starts_at, p_field_id?)` | capitán del match |
| `respond_match_reschedule(p_request_id, p_approve)` | capitán rival |
| `resolve_match_reschedule(p_request_id, p_action, p_notes?)` | owner/admin; `confirm` \| `no_availability` |
| `confirm_match_calendar(p_match_id)` | owner/admin |
| `apply_recurring_slot_to_season(p_season_id, p_day_of_week, p_start_time)` | owner/admin |

Internos (sin GRANT producto): `__schedule_match_core`, `__round_slot_starts_at`, `expire_stale_match_reschedule_requests`, helpers de capitán.

`schedule_match` refactorizado → delega en `__schedule_match_core(..., 'programado')`.

## RLS

- `matches`: policy `matches_select_active_captain` (capitán activo con `profile_id` vinculado)
- `match_reschedule_requests`: SELECT owner/admin o capitán del partido
- `captain_invitations`: SELECT owner/admin o email invitado

Sin INSERT/UPDATE directo para capitán en requests (solo RPCs).

## Grants

- Tablas nuevas: `REVOKE ALL` PUBLIC/anon; `GRANT SELECT` authenticated
- RPCs producto: `GRANT EXECUTE` authenticated; `REVOKE` PUBLIC/anon

## Pruebas

`supabase/tests/019_reschedule_consensus_captain.sql` — **11/11 PASS**.

Cobertura: aislamiento capitán, auto-aprobación bloqueada, non-captain, RLS cruzado org, duplicate open request, EXCLUDE en confirm, recurring no sobreescribe manual, lectura partidos propios vs ajenos.

## Tipos TS

`src/types/database.ts` regenerado (`npx supabase gen types typescript --project-id akgcamaegpboewsbbevl`).

## Fuera de alcance (confirmado)

Swap rival manual, WhatsApp API, Auth no-capitanes, cambios a `create_season_round_robin_fixture`, push/SW.
