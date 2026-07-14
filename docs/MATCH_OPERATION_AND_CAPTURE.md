# Operación de partido y captura (F7)

## Schema real utilizado

- `season_roles`: `tournament_admin` | `referee` | `delegate`
- `match_officials`: roles `referee` | `assistant` | `delegate` | `scorekeeper`; status `assigned` | `confirmed` | `declined`
- `match_events`: `goal` | `own_goal` | `yellow_card` | `red_card` | `substitution_in` | `substitution_out` | `injury`; `minute` 0–130
- Sin stoppage minute, sin autor en evento, sin team_id directo (vía `season_team_player`)
- `update_match_result(p_match_id, p_status, p_home_score, p_away_score)` — owner/admin/`tournament_admin`
- `can_capture_match(p_match_id)` — owner/admin OR tournament_admin OR referee/delegate con asignación **confirmada**
- Disciplina automática: trigger `match_events_generate_discipline_suspensions` (007)

## Migration 017 — hardening

Archivo: `supabase/migrations/20260714013000_harden_match_event_capture.sql`

### Policies finales `match_events`

- **SELECT:** `match_events_select_member` (miembros de la org)
- **INSERT:** owner/admin, tournament_admin (season), confirmed official (referee/delegate) — sin cambios de autorización de captura
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

Reconciliación disciplinaria / anulación segura de eventos (F8+); read models (standings, goleo). **No avanzar a F8 en este cierre.**
