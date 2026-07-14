# Fixture y programación de partidos (F6)

## Alcance

Generación atómica de fixture **round-robin de liga** (una vuelta / ida y vuelta), calendario por jornadas y programación manual de partidos con reserva de cancha.

No incluye: captura de resultados, eventos, árbitros, standings, playoffs, páginas públicas ni regeneración destructiva.

## Motor

Archivo puro: `src/lib/fixtures/round-robin.ts`.

- Algoritmo de círculo, determinista por orden de entrada.
- Números pares: `n-1` jornadas, `n/2` partidos.
- Números impares: `n` jornadas, `(n-1)/2` partidos y un descanso (bye) por jornada; el bye **no** se persiste como match.
- Doble vuelta: continúa numeración e invierte localía.

Tests: `npm test` (`src/lib/fixtures/round-robin.test.ts`).

## Schema (Migration 016)

Columnas en `matches` (nullable para partidos manuales futuros):

- `round_number` (> 0)
- `leg_number` (1 | 2)
- `sequence_in_round` (> 0)

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
- El exclusion constraint `no_overlapping_reservations` protege concurrencia.

RPC `unschedule_match(p_match_id)`:

- Cancela la reserva confirmada y limpia `matches.field_reservation_id`.
- No borra el partido.
- Bloquea si status es `in_progress` o `finished`.

## Semántica UI

| Concepto | Criterio |
| --- | --- |
| Pendiente | sin `field_reservation_id` / sin reserva confirmada |
| Programado | reserva confirmada vinculada |
| Descanso | equipo elegible ausente en la jornada (derivado) |

## Permisos

| Rol | Fixture / programar | Ver |
| --- | --- | --- |
| owner/admin | sí | sí |
| organization_member | no | sí |
| tournament_admin | no (estructura) | sí (como miembro si aplica) |
| externos/anon | no | no |

## Rutas

- `.../temporadas/[seasonId]/fixture/generar`
- `.../temporadas/[seasonId]/calendario`
- `.../temporadas/[seasonId]/partidos/[matchId]`
- `.../temporadas/[seasonId]/partidos/[matchId]/programar`
- Hubs: `/organizaciones/[id]/calendario` y `/partidos`

## Siguiente paso

Captura de resultados y eventos (F7): ver `docs/MATCH_OPERATION_AND_CAPTURE.md`.
