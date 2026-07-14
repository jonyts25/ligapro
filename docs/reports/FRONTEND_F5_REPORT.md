# Frontend F5 — Equipos, inscripción y planteles

**Fecha:** 2026-07-13  
**Base:** `eef7629` — `feat: frontend F4 competitions seasons and atomic rules`  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Check | Resultado |
| --- | --- |
| Working tree limpio | Sí |
| Commit F4 | `eef7629` |
| Migrations 001–013 sync | Sí |
| Schema 004 leído | Completo |
| Audit 010 | teams/players/season_teams/season_team_players |
| RPC capitán existente | `set_season_team_captain(season_team_id, player_id)` |
| Mundial Compas | No tocado |

---

## 2. Schema real

### `teams`
`id`, `organization_id`, `name`, timestamps. Sin `is_active`/logo.

### `players`
`id`, `organization_id`, `profile_id` (nullable), `full_name`. Sin position.

### `season_teams`
`season_id`, `team_id`, `organization_id`, `display_name`, `group_name`, `registration_status` (`registered`\|`confirmed`\|`withdrawn`). UNIQUE `(season_id, team_id)`.

### `season_team_players`
`season_team_id`, `player_id`, `organization_id`, `season_id` (015), `jersey_number`, `is_captain`, `registration_status` (`active`\|`inactive`\|`suspended`). UNIQUE plantel+player; un capitán; jersey único si no null; capitán debe ser active.

**Migration 015:** un player **no** puede estar `active`/`suspended` en dos equipos de la misma season (índice parcial `(season_id, player_id)`). `inactive` libera.

---

## 3. Permisos reales

Members SELECT. Owner/admin INSERT/UPDATE/DELETE vía RLS. Capitanía vía RPC owner/admin. tournament_admin sin privilegio estructural.

---

## 4–5. Migration 014

**Sí — necesaria** para enroll + player/roster atómicos + baja suave.

**Archivo:** `supabase/migrations/20260713025710_team_roster_management.sql`  
**Push:** aplicado · local = remote

### RPCs nuevas

| Función | Retorno |
| --- | --- |
| `enroll_team_in_season(...)` | `season_team_id` |
| `create_player_and_add_to_roster(...)` | `season_team_player_id` |
| `add_player_to_season_team(...)` | `season_team_player_id` |
| `deactivate_season_team_player(...)` | void |

Reutiliza `set_season_team_captain` (004). SECURITY DEFINER; sin organization_id/actor; REVOKE PUBLIC/anon.

---

## 6–7. Archivos

### Creados
```
supabase/migrations/20260713025710_team_roster_management.sql
supabase/tests/014_teams_rosters_frontend.sql
docs/TEAMS_AND_ROSTERS.md
docs/reports/FRONTEND_F5_REPORT.md
src/lib/teams/{types,queries,actions}.ts
src/components/teams/*
src/app/.../equipos/**
src/app/.../temporadas/[seasonId]/equipos/**
```

### Modificados
```
nav-items (Equipos)
SeasonReadinessCard + season detail
dashboard + demo-data
competitions queries/types (readiness)
SubmitButton (disabled opcional)
docs DOMAIN_MODEL / DESIGN_SYSTEM / COMPETITIONS
suite 004 cleanup audit_log
database.ts types
```

---

## 8–10. Rutas / Actions / Helpers

Rutas del brief. Actions: create/updateTeam, enrollTeam, createPlayerAndAdd, addExistingPlayer, updateRosterEntry, deactivateRosterPlayer, setCaptain. Helpers: getOrganizationTeams, getTeamDetails, getSeasonTeams, getSeasonTeamRoster, getAvailableTeamsForSeason, getAvailablePlayersForRoster, getSeasonRosterStats, getOrganizationTeamStats.

---

## 11–15. Flujos

Teams (name). Inscripción RPC. Players sin Auth. Roster create/add/deactivate. Capitán RPC atómica + confirmación UI.

---

## 16. Dashboard / readiness

Reales: teams + enrollments. Readiness: sedes, canchas, equipos, jugadores activos, equipos con capitán, fixture No. CTA “Registrar equipos” activo. Labels derivados: Pendiente / Configurando planteles / Lista para generar fixture.

---

## 17. Matriz

| Rol | Ver | Mutar |
| --- | --- | --- |
| owner/admin | sí | sí |
| member | sí | no |
| tournament_admin | como member | no |
| anon | no | no |

---

## 18. Pruebas SQL 014

**26/26 PASS** (incluye enroll, atomic rollback player, captain replace, deactivate, audit, grants).

---

## 19. Regresiones

| Suite | Resultado |
| --- | --- |
| 004 | PASS (cleanup audit_log) |
| 010 | PASS |
| 013 | PASS |
| 014 | PASS |

---

## 20–21. Frontend manual

No inventadas. Build confirma rutas. **Browser/PWA/375px no verificados** en esta sesión.

---

## 22–25. Validaciones

db lint OK · npm lint OK · build OK (rutas equipos) · migrations sync 014 · tipos regenerados.

---

## 26. git status

Sin commit. Working tree con F5 + 014.

---

## 27. Riesgos / pendientes

- **Resuelto (015):** exclusividad active/suspended por season.
- Retiro = soft `inactive`, no DELETE de roster row ni de player.
- Capitanía usa `p_player_id` (RPC 004), no `season_team_player_id`.
- Sin logos / Auth / invitaciones.
- Impacto futuro: disciplina y estadísticas deben respetar un plantel activo por season (sin doble conteo).

---

## 28. Mundial Compas

No tocado.
