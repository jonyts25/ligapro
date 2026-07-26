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

Altas normales de jugador: `profile_id` NULL. **Capitanes y vicecapitanes** (Migration 019 + 020): se puede invitar por correo para vincular cuenta Auth sin crear usuario sin acción del invitado.

Campos de roster: `jersey_number`, `is_captain`, `is_vice_captain`, `registration_status` (`active` \| `inactive` \| `suspended`).

No existe `position` en el schema.

## Capitanía y vicecapitanía

- **Capitán:** `season_team_players.is_captain`. Máximo uno por plantel (índice único parcial). Debe estar `active`.
- **Vicecapitán:** `is_vice_captain`. Máximo uno por plantel. Debe estar `active`. Un jugador **no** puede ser capitán y vice a la vez (CHECK).

RPCs (004 + 020): `set_season_team_captain(p_season_team_id, p_player_id)`, `set_season_team_vice_captain(p_season_team_id, p_player_id)`. Al designar uno se limpia el flag del otro en el mismo plantel.

### Cuenta de capitán / vicecapitán (Migration 019, extendida 020)

Flujo F5 cuando `is_captain = true` **o** `is_vice_captain = true`:

1. Admin crea jugador + rol (`create_captain_player_with_invitation`) **o** designa capitán/vice y envía invitación (`invite_captain_to_roster`).
2. Tabla `captain_invitations` genera token + email (expira en 7 días). **Sin renombrar la tabla** — acepta filas de capitán o vicecapitán marcados.
3. Invitado se registra/inicia sesión y acepta (`accept_captain_invitation(p_token)`) → `players.profile_id = auth.uid()`.
4. **No** se crean cuentas Auth para jugadores sin rol de liderazgo.

Privilegios RLS del capitán o vicecapitán **vinculado** (y solo estos):

- Leer partidos donde participa su `season_team`.
- Proponer y responder solicitudes de reagendado (`match_reschedule_requests` vía RPC).
- Marcar pago informal de jugadores de su plantel (`season_team_player_payment_marks` vía `set_player_payment_mark`).

**No** puede: editar roster, designar/quitar capitán, cargos oficiales, resultados, finanzas del admin, ni ver otras organizaciones/equipos.

## Marcas de pago internas (Migration 020)

Tabla `season_team_player_payment_marks`: una fila por jugador del roster (`marked_paid`, `notes`). Uso exclusivo del capitán/vicecapitán para llevar control informal.

- **No** relacionada con `team_charges`, `team_payments` ni `season_team_financial_summary`.
- Owner/admin: solo lectura (referencia futura); sin INSERT/UPDATE directo.
- RPC: `set_player_payment_mark(p_season_team_player_id, p_marked_paid, p_notes?)`.

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
- limpia `is_captain` e `is_vice_captain`
- **no** borra la fila `players`

Reactivar: `add_player_to_season_team` / `set_season_team_player_status(..., 'active')` solo si no ocupa otro plantel de la season.

## Operaciones atómicas (Migration 014 + 015 + 019 + 020)

| RPC | Uso |
| --- | --- |
| `enroll_team_in_season` | Inscribe team en season |
| `create_player_and_add_to_roster` | Crea player + roster; si roster falla, no queda player |
| `create_captain_player_with_invitation` | Crea player + capitán + invitación email |
| `invite_captain_to_roster` | Invitación para capitán o vice ya en plantel |
| `accept_captain_invitation` | Invitado vincula su profile |
| `add_player_to_season_team` | Agrega o reactiva player existente |
| `set_season_team_player_status` | Cambia active/inactive/suspended (quita capitán/vice si aplica) |
| `deactivate_season_team_player` | Baja suave (= inactive) |
| `set_season_team_captain` | Capitanía (004; solo roster active) |
| `set_season_team_vice_captain` | Vicecapitanía (020; solo roster active) |
| `set_player_payment_mark` | Marca informal de pago por jugador (capitán/vice) |

Sin `organization_id` / `profile_id` de actor en firmas. SECURITY DEFINER + grants authenticated.

## Permisos

owner/admin: mutan roster e invitaciones. member: lee. tournament_admin: sin privilegio estructural. Capitán/vicecapitán vinculado: calendario/reagendado + marcas de pago internas de su equipo (019 + 020).

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

Equipos elegibles para fixture F6: `registered` | `confirmed` (no `withdrawn`). Ver `docs/FIXTURE_AND_SCHEDULING.md`.

UI de aceptación de invitación, marcas de pago del capitán y flujo wa.me para avisos: fase frontend posterior a 020.

Siguiente: captura de resultados.
