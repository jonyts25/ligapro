# Migration 021 — Bloqueo de cancha, cuota, roster delegado, candado de facturación

**Archivo:** `supabase/migrations/20260716000000_field_blocks_roster_billing.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0007-cancha-cuota-roster-candado.md`

## Objetivos

1. Cerrar bloqueantes del portal del capitán (RLS lectura + `profiles.phone`)
2. Bloqueos de cancha por torneo (`season_field_blocks`)
3. Cuota de inscripción automática
4. Alta de jugadores delegada al capitán (con topes)
5. Subcapitán de designación única para capitán
6. Candado de facturación de plataforma en fixture/slot recurrente

## 0. Portal del capitán — prerequisito

| Cambio | Detalle |
| --- | --- |
| RLS SELECT | Policies `season_teams_select_team_leader`, `season_team_players_select_team_leader`, `field_reservations_select_team_leader` |
| `profiles.phone` | text nullable; self read/update vía policies existentes |

**Estado:** Con esta migración aplicada, el portal en `main` (`e5ed883`) es **funcional de punta a punta en backend**. Pendiente frontend mínimo: `getOpponentCaptainPhone` → leer `profiles.phone` (stub actual retorna `null`).

## 1. `season_field_blocks`

- EXCLUDE intra-season + trigger cross-season (patrón `field_availability_rules`)
- RPC `set_season_field_blocks(p_season_id, p_blocks jsonb)` — reemplazo atómico
- Helper `__assert_field_slot_not_blocked_by_other_season` en `__schedule_match_core`

## 2. Cuota de inscripción

- `season_rules.registration_fee numeric(12,2)` nullable
- `enroll_team_in_season`: inserta `team_charge` (`registration`) atómicamente si fee definido

## 3. Roster delegado

- `add_player_to_season_team` / `create_player_and_add_to_roster`: capitán/vice en equipo propio
- `season_rules.max_roster_size`, `season_teams.roster_locked_by_captain`, RPC `set_roster_lock`
- Helper `__assert_captain_roster_add_allowed` — admin bypass

## 4. Vicecapitán único

- `set_season_team_vice_captain`: capitán/subcapitán rechazado si ya hay vice activo; admin siempre puede reemplazar

## 5. Candado facturación

- `seasons.platform_billing_status` NOT NULL default `'pendiente'`
- Gate en `create_season_round_robin_fixture` y `apply_recurring_slot_to_season`
- `REVOKE UPDATE (platform_billing_status)` + trigger `seasons_prevent_platform_billing_status_update`

## Fuera de alcance (confirmado)

- Frontend: UI bloqueos, disponibilidad cruzada, formulario alta jugador capitán
- Panel `platform_billing_status`
- `get_field_availability_overview` RPC — **pendiente prompt frontend**
- Cambios a `field_reservations` / partido individual

## Pruebas

`supabase/tests/021_field_blocks_roster_billing.sql` — **23/23 PASS**

También parcheados `019` y `020`: setup de fixture con `platform_billing_status = 'pagado'` vía `RESET ROLE` + clear JWT (trigger + REVOKE impiden update como authenticated).

## Tipos TS

`src/types/database.ts` regenerado (`npx supabase gen types typescript --project-id akgcamaegpboewsbbevl`).

## Docs actualizados

- `docs/VENUES_AND_FIELDS.md`
- `docs/FIXTURE_AND_SCHEDULING.md`
- `docs/TEAMS_AND_ROSTERS.md`
- `docs/DOMAIN_MODEL.md`
- `docs/AUTHENTICATION.md`
- `docs/ADR/0007-cancha-cuota-roster-candado.md`
