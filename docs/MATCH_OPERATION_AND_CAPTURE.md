# Operación de partido y captura (F7)

## Schema real utilizado

- `season_roles`: `tournament_admin` | `referee` | `delegate` | `scorekeeper` (Migration 022)
- `match_officials`: roles `referee` | `assistant` | `delegate` | `scorekeeper`; status `assigned` | `confirmed` | `declined`
- `match_events`: `goal` | `own_goal` | `yellow_card` | `red_card` | `substitution_in` | `substitution_out` | `injury`; `minute` 0–130; anulación vía `voided_at` / `void_reason` (022)
- Sin stoppage minute, sin autor en evento, sin team_id directo (vía `season_team_player`)
- `update_match_result(p_match_id, p_status, p_home_score, p_away_score)` — owner/admin/`tournament_admin` (ventana 022 con bypass)
- `can_capture_match(p_match_id)` — owner/admin OR tournament_admin OR referee/delegate/**scorekeeper** con asignación **confirmada**
- Disciplina automática: trigger `match_events_generate_discipline_suspensions` (007) — **sin cambios en 020/022**

## Migration 022 — scorekeeper, ventana de captura, anulación

Archivo: `supabase/migrations/20260717000000_scorekeeper_capture_window_void_events.sql`  
ADR: `docs/ADR/0008-cedula-arbitral-ventana-y-correccion.md`

### Scorekeeper

- `season_roles.role` admite `scorekeeper`.
- Captura igual que referee/delegate: `season_role` + `match_officials.status = 'confirmed'` con rol coincidente.

### Ventana de tiempo

Timezone: `America/Mexico_City`.

Ventana abierta cuando `now()` está entre el `starts_at` de la reserva `confirmed` del partido y las **09:00 del día calendario siguiente**.

| Actor | Ventana |
| --- | --- |
| referee / delegate / scorekeeper | Obligatoria (sin reserva confirmada → rechazo) |
| owner / admin / tournament_admin | **Bypass total** |

Mensaje distinto de permiso: «La ventana de captura para este partido ya cerró».

Helpers: `__match_capture_window_open`, `__match_capture_window_bypass`, `__assert_match_capture_window`.

Aplica a `record_match_event`, trigger `match_events_enforce_capture_rules` y `update_match_result`.

### Anulación de eventos

Columnas: `voided_at`, `voided_by_profile_id`, `void_reason` (CHECK todo-o-nada).

RPC `void_match_event(p_event_id, p_reason)` — **solo owner/admin**; motivo obligatorio.

- No borra la fila; no permite editar contenido original.
- Segunda anulación falla («already voided»).
- No encadena con `waive_discipline_suspension`.
- `get_season_top_scorers` / `get_season_discipline_summary` / `get_public_season_scorers` excluyen `voided_at IS NOT NULL`.

## Migration 020 — ajuste de sanciones (admin)

Archivo: `supabase/migrations/20260715000000_discipline_vice_captain_payment_marks.sql`

Alineado con el patrón de Migration 017 (`match_events`): correcciones vía RPC, no UPDATE/DELETE directo.

### Policies finales `discipline_suspensions`

- **SELECT:** sin cambios (miembros / owner/admin según policies existentes)
- **INSERT:** trigger automático (007) + RPC `create_administrative_suspension` para `administrative` \| `expulsion` sin evento origen
- **UPDATE:** denegado — policy DROP + `REVOKE UPDATE` de `authenticated`
- **DELETE:** denegado — policy DROP + `REVOKE DELETE` de `authenticated`

Tipo `expulsion` explícito en CHECK (no valores arbitrarios tipo 999 partidos).

### RPCs de ajuste (owner/admin; `p_reason` obligatorio)

| RPC | Efecto |
| --- | --- |
| `waive_discipline_suspension(p_suspension_id, p_reason)` | `status = 'waived'`; conserva fila |
| `adjust_discipline_suspension_length(p_suspension_id, p_matches_remaining, p_reason)` | Sobrescribe `matches_remaining` |
| `create_administrative_suspension(p_season_team_player_id, p_suspension_type, p_matches_remaining, p_reason)` | Alta manual; `suspension_type` ∈ `administrative` \| `expulsion`; `source_match_event_id` NULL |

Motivo persistido en `notes`. Cambios auditados por trigger genérico de Migration 010 (`audit_discipline_suspensions`).

El trigger `match_events_generate_discipline_suspensions` **no** se modificó. Anular un evento (022) **no** revierte suspensiones; usar `waive_discipline_suspension` (020) explícitamente.

## Migration 017 — hardening

Archivo: `supabase/migrations/20260714013000_harden_match_event_capture.sql`

### Policies finales `match_events`

- **SELECT:** `match_events_select_member` (miembros de la org)
- **INSERT:** owner/admin, tournament_admin (season), confirmed official (referee/delegate/scorekeeper)
- **UPDATE:** denegado — policies DROP + `REVOKE UPDATE` de `authenticated`
- **DELETE:** denegado — policies DROP + `REVOKE DELETE` de `authenticated`

Owner/admin no editan/eliminan eventos desde producto mientras no exista reconciliación disciplinaria segura. Corrección futura = anulación/reconciliación explícita, no UPDATE directo.

### Garantía DB partido cerrado

Trigger `BEFORE INSERT` `match_events_enforce_capture_rules`:

1. Resuelve el match
2. Rechaza status `finished` | `cancelled` | `walkover` (los tres bloquean captura)
3. Si hay `auth.uid()`, exige `can_capture_match`
4. Rechaza jugador `inactive`

Validaciones de org/roster/team permanecen en triggers 006b existentes.

### RPC `record_match_event`

```text
record_match_event(p_match_id, p_season_team_player_id, p_event_type, p_minute, p_notes DEFAULT NULL)
RETURNS uuid
```

- SECURITY DEFINER + `search_path = public`
- Actor = `auth.uid()` únicamente
- `can_capture_match`, status abierto, roster/team, event_type, minute
- Un INSERT; dispara audit + disciplina existentes
- Sin `organization_id` / actor externo en la firma
- `REVOKE` PUBLIC/anon; `GRANT` authenticated

`recordMatchEventAction` usa exclusivamente esta RPC.

## Marcador oficial

Fuente de verdad: `matches.home_score` / `away_score` vía `update_match_result`. Los eventos no derivan el marcador.

## Transiciones de status

Sin máquina formal en DB. UI limita: `scheduled` → `in_progress`/`finished`/`cancelled`/`walkover`; `in_progress` → `finished`/`cancelled`/`walkover`; estados terminales sin más cambios en UI. Eventos bloqueados en DB (trigger + RPC) y en Server Action.

## Rutas

- `.../temporadas/[seasonId]/oficiales`
- `.../partidos/[matchId]` (detalle + oficiales)
- `.../partidos/[matchId]/captura`

## Siguiente paso

Reconciliación disciplinaria manual tras anulación (waive explícito). Standings y páginas públicas: ver `docs/STANDINGS_AND_PUBLIC_PAGES.md`.
