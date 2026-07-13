# Teams and Rosters — Frontend F5

## Team vs season_team

| Concepto | Tabla | Qué es |
| --- | --- | --- |
| **Team** | `teams` | Identidad persistente en la organización (`name`) |
| **Season team** | `season_teams` | Inscripción de un team en una season |

El mismo team puede participar en varias temporadas. UNIQUE `(season_id, team_id)`.

Campos de inscripción: `display_name` (opcional), `group_name` (informativo; no se administran grupos), `registration_status` (`registered` \| `confirmed` \| `withdrawn`).

## Player vs roster

| Concepto | Tabla | Qué es |
| --- | --- | --- |
| **Player** | `players` | Persona en la org (`full_name`; `profile_id` opcional) |
| **Roster** | `season_team_players` | Participación en un `season_team` |

F5 no crea Auth users ni invita por correo. `profile_id` queda NULL en altas normales.

Campos de roster: `jersey_number`, `is_captain`, `registration_status` (`active` \| `inactive` \| `suspended`).

No existe `position` en el schema.

## Capitanía

Solo `season_team_players.is_captain`. Máximo uno por plantel (índice único parcial). Debe estar `active`.

RPC existente (004): `set_season_team_captain(p_season_team_id, p_player_id)`.

## Retirar del plantel

RPC `deactivate_season_team_player(p_season_team_player_id)`:

- pone `registration_status = inactive`
- limpia `is_captain`
- **no** borra la fila `players`

Reactivar: `add_player_to_season_team` sobre la misma pareja (reactiva si estaba inactivo).

## Dos equipos en la misma season

El schema **permite** que un mismo `player` esté en dos `season_teams` de la misma season (no hay UNIQUE por season+player). Decisión pendiente de producto; F5 no impone regla adicional.

## Operaciones atómicas (Migration 014)

| RPC | Uso |
| --- | --- |
| `enroll_team_in_season` | Inscribe team en season |
| `create_player_and_add_to_roster` | Crea player + roster; si roster falla, no queda player |
| `add_player_to_season_team` | Agrega o reactiva player existente |
| `deactivate_season_team_player` | Baja suave del plantel |
| `set_season_team_captain` | Capitanía (004) |

Sin `organization_id` / `profile_id` de actor en firmas. SECURITY DEFINER + grants authenticated.

## Permisos

owner/admin: mutan. member: lee. tournament_admin: sin privilegio estructural. Capitán: dato deportivo, no permiso de app.

## Rutas

```text
/organizaciones/[organizationId]/equipos
/organizaciones/[organizationId]/equipos/nuevo
/organizaciones/[organizationId]/equipos/[teamId]
/organizaciones/[organizationId]/equipos/[teamId]/editar
.../temporadas/[seasonId]/equipos
.../temporadas/[seasonId]/equipos/inscribir
.../temporadas/[seasonId]/equipos/[seasonTeamId]
```

## Limitaciones / siguiente paso

Sin logos, fixture, partidos, finanzas, invitaciones Auth. Siguiente: fixture (F6+).
