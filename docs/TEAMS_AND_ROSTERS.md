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

## Un plantel activo por season (Migration 015)

Un player **no** puede estar `active` o `suspended` en dos `season_teams` de la **misma** season.

Garantía PostgreSQL:

```text
UNIQUE (season_id, player_id)
WHERE registration_status IN ('active', 'suspended')
```

- `inactive` libera la plaza (historial conservado).
- Permitido en otra season / competition / edición.
- Sin transferencia automática: primero `inactive` en el plantel anterior, luego agregar/activar en el nuevo.
- `season_id` en `season_team_players` se deriva por trigger desde `season_team_id` (no lo elige el frontend).

RPC de status: `set_season_team_player_status(p_season_team_player_id, p_registration_status)`.

## Retirar del plantel

RPC `deactivate_season_team_player(p_season_team_player_id)` (wrapper de status=`inactive`):

- pone `registration_status = inactive`
- limpia `is_captain`
- **no** borra la fila `players`

Reactivar: `add_player_to_season_team` / `set_season_team_player_status(..., 'active')` solo si no ocupa otro plantel de la season.

## Operaciones atómicas (Migration 014 + 015)

| RPC | Uso |
| --- | --- |
| `enroll_team_in_season` | Inscribe team en season |
| `create_player_and_add_to_roster` | Crea player + roster; si roster falla, no queda player |
| `add_player_to_season_team` | Agrega o reactiva player existente |
| `set_season_team_player_status` | Cambia active/inactive/suspended (quita capitán si aplica) |
| `deactivate_season_team_player` | Baja suave (= inactive) |
| `set_season_team_captain` | Capitanía (004; solo roster active) |

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
