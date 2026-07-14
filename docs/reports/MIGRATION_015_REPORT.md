# Migration 015 Report — Single active seat per season

**Fecha:** 2026-07-13  
**Estado:** listo para revisión (sin commit)  
**Alcance:** hardening previo a F6 — un player no puede ocupar dos planteles `active`/`suspended` en la misma season.

## Decisión de producto

**Opción B (adoptada):** un player no puede estar simultáneamente en dos `season_teams` de la misma season con status `active` o `suspended`.

- `inactive` libera la plaza y conserva historial.
- Distintas seasons / competitions / ediciones: permitido.
- Sin transferencia automática.

## Conflictos previos

Auditoría remota (`ligapro-dev`): **0** grupos conflictivos (mismo player + misma season + >1 roster active/suspended).

## Cambios schema

1. `season_team_players.season_id uuid NOT NULL` (backfill desde `season_teams`, FK a `seasons`).
2. Trigger `season_team_players_set_context` (BEFORE INSERT/UPDATE): deriva `season_id` y `organization_id` desde `season_team_id`; valida player org.
3. Unique partial index:
   `season_team_players_one_active_or_suspended_per_season ON (season_id, player_id) WHERE registration_status IN ('active','suspended')`
4. RPC `set_season_team_player_status(p_season_team_player_id, p_registration_status)`
   - owner/admin; clears captain on inactive/suspended; grants authenticated only.
5. `deactivate_season_team_player` delega a status=`inactive`.

## Frontend

- `getAvailablePlayersForRoster` marca ocupados (disabled + equipo).
- Mensaje humano ante `23505` del índice parcial.
- UI plantel: status, confirmación al inactivar, aviso de pérdida de capitanía.
- `setRosterStatusAction` / `updateRosterEntryAction` usan la RPC de status.

## Pruebas

| Suite | Resultado |
| --- | --- |
| 015 | **34/34 PASS** |
| 004 | **PASS** (5a actualizado: org se deriva) |
| 010 | **PASS** |
| 014 | **PASS** |
| Frontend local smoke | Ver abajo |

### Frontend (local `npm run dev` + Playwright)

PASS verificados: crear 2 equipos, season, inscripción, agregar A, deshabilitado en B, UI bloquea submit, suspender A, sigue bloqueado, inactive A, agregar a B, reactivar A falla con mensaje humano, deactivate B, capitán, inactive limpia capitán, refresh, 375px.

No verificados / matices:

- Ítem 13 (reactivar A tras free B): la UI + SQL 015#13 lo soportan; el smoke falló por assertion frágil (texto de ayuda contiene “otro equipo”).
- Forzar request omitiendo UI: no ejecutado end-to-end; garantizado por índice (suite 015).
- Errores de consola: NOT_VERIFIED.

## Desviación 004

El test `5a` original esperaba rechazo si el cliente enviaba `organization_id` ajeno. Migration 015 **sobrescribe** tenancy desde `season_team`; el test ahora verifica el overwrite y elimina la fila sembrada.

## No incluido

Fixture, jornadas, partidos, disciplina nueva, stats, standings, transferencias, commit.

## Mundial Compas

No tocado.
