# Fixture y programación de partidos (F6)

## Alcance

Generación atómica de fixture **round-robin de liga** (una vuelta / ida y vuelta), calendario por jornadas y programación manual de partidos con reserva de cancha.

Migration 019 añade: estado dual de calendario, reagendado por consenso entre capitanes, slot recurrente bulk y confirmación admin. Ver ADR 0006.

No incluye: captura de resultados, eventos, árbitros, standings, playoffs, páginas públicas ni regeneración destructiva. No incluye swap de rival entre jornadas (manual admin, modelo existente).

## Motor

Archivo puro: `src/lib/fixtures/round-robin.ts`.

- Algoritmo de círculo, determinista por orden de entrada.
- Números pares: `n-1` jornadas, `n/2` partidos.
- Números impares: `n` jornadas, `(n-1)/2` partidos y un descanso (bye) por jornada; el bye **no** se persiste como match.
- Doble vuelta: continúa numeración e invierte localía.

Tests: `npm test` (`src/lib/fixtures/round-robin.test.ts`).

## Schema (Migration 016 + 019)

Columnas en `matches` (nullable para partidos manuales futuros):

- `round_number` (> 0)
- `leg_number` (1 | 2)
- `sequence_in_round` (> 0)
- `calendar_status` (`programado` | `confirmado`, default `programado`) — Migration 019

Índice único parcial `(season_id, round_number, sequence_in_round)`.
Índice único parcial: una reserva `confirmed`+`match` por `match_id`.

## Persistencia

RPC `create_season_round_robin_fixture(p_season_id, p_mode, p_matches)`:

- Solo owner/admin.
- Valida JSON estricto, equipos elegibles (`registered`/`confirmed`), fixture matemático completo.
- Rechaza si la season ya tiene matches (sin regenerar en F6).
- Inserta atómicamente; no crea reservas ni fechas.

## Programación

Timezone de producto: `America/Mexico_City`.

RPC `schedule_match(p_match_id, p_field_id, p_starts_at)`:

- Calcula `ends_at` en servidor: `match_duration_minutes + minimum_rest_minutes`.
- Valida field/venue activos y disponibilidad semanal del día.
- Crea o actualiza la única `field_reservation` del partido (source of truth de ocupación).
- Deja `calendar_status = programado`.
- El exclusion constraint `no_overlapping_reservations` protege concurrencia.

RPC `unschedule_match(p_match_id)`:

- Cancela la reserva confirmada y limpia `matches.field_reservation_id`.
- No borra el partido.
- Bloquea si status es `in_progress` o `finished`.

RPC `confirm_match_calendar(p_match_id)` (019):

- Solo owner/admin.
- Requiere reserva confirmada existente; valida no solape con otras reservas.
- Pone `calendar_status = confirmado` (gatillo futuro de avisos; sin push en 019).

## Slot recurrente (019)

Config en `season_rules`:

- `recurring_slot_field_id` — cancha objetivo (owner/admin la configura antes)
- `recurring_slot_day_of_week` / `recurring_slot_start_time` — persistidos al aplicar

RPC `apply_recurring_slot_to_season(p_season_id, p_day_of_week, p_start_time)`:

- Solo owner/admin; season con fixture y `starts_on` definido.
- Programa partidos **sin** `field_reservation_id` por jornada (`round_number` + día/hora).
- Resultado siempre `programado`; fallos parciales no abortan (JSON con `scheduled`, `skipped_already_scheduled`, `failed`).

## Reagendado por consenso (019)

Tabla `match_reschedule_requests`. TTL default **72 h** (`season_rules.reschedule_request_ttl_hours`).

| RPC | Actor |
| --- | --- |
| `propose_match_reschedule` | Capitán activo con `profile_id` (equipo local o visitante) |
| `respond_match_reschedule` | Capitán del **rival** |
| `resolve_match_reschedule(confirm)` | owner/admin → aplica slot + `confirmado` |
| `resolve_match_reschedule(no_availability)` | owner/admin → cierra sin tocar match |

Estados: `proposed` → `approved_by_opponent` \| `rejected_by_opponent` \| `expired` → `confirmed_by_admin` \| `no_availability`.

Un solo request abierto por partido. Expiración lazy en RPCs (sin cron).

WhatsApp: solo deep-links `wa.me` del lado cliente (sin API en 019).

## Semántica UI

| Concepto | Criterio |
| --- | --- |
| Pendiente | sin `field_reservation_id` / sin reserva confirmada |
| Programado | reserva confirmada + `calendar_status = programado` |
| Confirmado | reserva + `calendar_status = confirmado` |
| Descanso | equipo elegible ausente en la jornada (derivado) |

## Permisos

| Rol | Fixture / programar | Reagendado | Ver |
| --- | --- | --- | --- |
| owner/admin | sí | resolver | sí |
| organization_member | no | no | sí |
| capitán (profile vinculado) | no | proponer/responder propios partidos | partidos de su equipo |
| tournament_admin | no (estructura) | no | sí (como miembro si aplica) |
| externos/anon | no | no | no (vistas públicas vía RPC F8) |

## Rutas

- `.../temporadas/[seasonId]/fixture/generar`
- `.../temporadas/[seasonId]/calendario`
- `.../temporadas/[seasonId]/partidos/[matchId]`
- `.../temporadas/[seasonId]/partidos/[matchId]/programar`
- Hubs: `/organizaciones/[id]/calendario` y `/partidos`

## Siguiente paso

Standings y página pública (F8): ver `docs/STANDINGS_AND_PUBLIC_PAGES.md`. Captura: `docs/MATCH_OPERATION_AND_CAPTURE.md`. Avisos push/WhatsApp al confirmar calendario: fase posterior a 019.
