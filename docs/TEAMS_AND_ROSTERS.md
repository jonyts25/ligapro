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

RPCs (004 + 020 + 021): `set_season_team_captain(p_season_team_id, p_player_id)` (solo owner/admin), `set_season_team_vice_captain(p_season_team_id, p_player_id)`. Al designar capitán se limpia vice en el mismo plantel.

**Vice de designación única (021):** capitán/subcapitán vinculado solo puede designar vice si el cargo está **vacío**; owner/admin puede designar o reemplazar en cualquier momento.

### Cuenta de capitán / vicecapitán (Migration 019, extendida 020)

Flujo F5 cuando `is_captain = true` **o** `is_vice_captain = true`:

1. Admin crea jugador + rol (`create_captain_player_with_invitation`) **o** designa capitán/vice y envía invitación (`invite_captain_to_roster`).
2. Tabla `captain_invitations` genera token + email (expira en 7 días). **Sin renombrar la tabla** — acepta filas de capitán o vicecapitán marcados.
3. Invitado se registra/inicia sesión y acepta (`accept_captain_invitation(p_token)`) → `players.profile_id = auth.uid()`.
4. **No** se crean cuentas Auth para jugadores sin rol de liderazgo.

Privilegios RLS del capitán o vicecapitán **vinculado** (y solo estos):

- Leer su `season_team`, plantel (`season_team_players`) y reservas de partidos donde participa (Migration 021).
- Leer partidos donde participa su `season_team`.
- Proponer y responder solicitudes de reagendado (`match_reschedule_requests` vía RPC).
- Marcar pago informal de jugadores de su plantel (`season_team_player_payment_marks` vía `set_player_payment_mark`).
- **Alta de jugadores** en su propio plantel vía `create_player_and_add_to_roster` / `add_player_to_season_team` (021); sujeto a `season_rules.max_roster_size` y `season_teams.roster_locked_by_captain`.

**No** puede: baja/status de jugadores, designar capitán, reemplazar vice si ya hay uno (salvo admin), cargos oficiales, resultados, finanzas del admin, ni ver otras organizaciones/equipos.

## Cuota de inscripción (Migration 021)

`season_rules.registration_fee` (numeric nullable). Si está definida, `enroll_team_in_season` crea automáticamente un `team_charge` (`charge_type = 'registration'`) en la misma transacción atómica.

## Candado de transferencia y verificación (Migration 023)

ADR: `docs/ADR/0009-verificacion-identidad-efimera.md` — **Opción C: sin almacenamiento de documentos.**

| Campo / tabla | Efecto |
| --- | --- |
| `season_rules.require_player_verification` | Si true, jugadores `pending`/`rejected` no se activan en roster de esa season (admin bypass) |
| `players.verification_status` | `not_required` \| `pending` \| `approved` \| `rejected` — persistente en org |
| `player_verification_reviews` | Historial de decisiones admin (sin documento adjunto) |
| `season_rules.transfer_lock_days` | Días tras baja antes de activar en otro plantel de la misma season (0 = off) |
| `player_transfer_lock_releases` | Excepción puntual admin con motivo |

### RPCs verificación

| RPC | Actor |
| --- | --- |
| `request_player_verification(p_player_id)` | owner/admin o capitán/sub del plantel donde el jugador está activo |
| `review_player_verification(p_player_id, p_approved, p_reason?)` | **solo owner/admin**; motivo obligatorio si rechazo |

Capitán/sub **no** aprueban ni rechazan — solo solicitan.

### RPC candado

| RPC | Actor |
| --- | --- |
| `release_player_transfer_lock(p_player_id, p_season_id, p_reason)` | owner/admin; motivo obligatorio |

Fecha de liberación para el candado: `season_team_players.updated_at` al pasar a `inactive`. Owner/admin no están sujetos al candado.

## Tope de plantel y candado (Migration 021)

| Campo | Efecto |
| --- | --- |
| `season_rules.max_roster_size` | Capitán/subcapitán rechazado al llegar al tope; admin sin límite |
| `season_teams.roster_locked_by_captain` | Si `true`, capitán no puede dar altas; admin sí |
| RPC `set_roster_lock(p_season_team_id, p_locked)` | Solo owner/admin |

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
| `enroll_team_in_season` | Inscribe team en season; cuota automática si `registration_fee` |
| `create_player_and_add_to_roster` | Crea player + roster; capitán/vice en equipo propio (021) |
| `create_captain_player_with_invitation` | Crea player + capitán + invitación email |
| `invite_captain_to_roster` | Invitación para capitán o vice ya en plantel |
| `accept_captain_invitation` | Invitado vincula su profile |
| `add_player_to_season_team` | Agrega o reactiva player existente; capitán/vice en equipo propio (021) |
| `set_season_team_player_status` | Cambia active/inactive/suspended (quita capitán/vice si aplica) |
| `deactivate_season_team_player` | Baja suave (= inactive) |
| `set_season_team_captain` | Capitanía (004; solo roster active) |
| `set_season_team_vice_captain` | Vicecapitanía (020/021; designación única para capitán) |
| `set_roster_lock` | Bloquea altas del capitán en plantel (021; owner/admin) |
| `set_player_payment_mark` | Marca informal de pago por jugador (capitán/vice) |
| `request_player_verification` | Solicita verificación de identidad (023) |
| `review_player_verification` | Aprueba/rechaza verificación (023; owner/admin) |
| `release_player_transfer_lock` | Libera candado de transferencia (023; owner/admin) |

Sin `organization_id` / `profile_id` de actor en firmas. SECURITY DEFINER + grants authenticated.

## Permisos

owner/admin: mutan roster e invitaciones. member: lee. tournament_admin: sin privilegio estructural. Capitán/vicecapitán vinculado: lectura plantel/equipo/reservas propias, calendario/reagendado, marcas de pago, **altas** de jugador en plantel propio (021).

## Portal del capitán (`/mi-equipo`)

Con Migration 021 aplicada, el portal desplegado en `main` (commit `e5ed883`) queda **funcional de punta a punta** en backend: RLS de lectura, `profiles.phone`, roster delegado (alta). Pendiente frontend: wiring de `getOpponentCaptainPhone` → `profiles.phone`, UI de bloqueos de cancha, dashboard de disponibilidad.

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
