# Fixture y programación de partidos (F6)

## Alcance

Generación atómica de fixture **round-robin de liga** (una vuelta / ida y vuelta), calendario por jornadas y programación manual de partidos con reserva de cancha.

Migration 025 añade motor de **eliminación directa** (`format_type = 'knockout'`) — ver ADR 0011. Migration 026 añade fase de **grupos** (`groups_knockout`) reutilizando round-robin por grupo y bracket 025 para la eliminatoria.

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

Índice único parcial `(season_id, round_number, sequence_in_round)` cuando `season_group_id IS NULL` y no es knockout.  
Migration 026: índice adicional `(season_id, season_group_id, round_number, sequence_in_round)` para fixtures por grupo.
Índice único parcial: una reserva `confirmed`+`match` por `match_id`.

## Persistencia

RPC `create_season_round_robin_fixture(p_season_id, p_mode, p_matches, p_group_id default NULL)`:

- Solo owner/admin.
- Valida JSON estricto, equipos elegibles (`registered`/`confirmed`), fixture matemático completo.
- Sin `p_group_id`: rechaza si la season ya tiene matches (liga simple; sin regenerar en F6).
- Con `p_group_id`: solo equipos asignados a ese grupo (`season_teams.season_group_id`); rechaza si **ese grupo** ya tiene matches; persiste `matches.season_group_id`.
- Requiere `seasons.platform_billing_status = 'pagado'` antes de generar fixture (Migration 021; candado pierde efecto práctico una vez existen matches).
- Inserta atómicamente; no crea reservas ni fechas.

**Fixture multi-grupo:** no hay wrapper SQL (`create_all_group_fixtures`); el frontend genera round-robin en TS (`src/lib/fixtures/round-robin.ts`) y llama la RPC **una vez por grupo**.

## Motor knockout (Migration 025)

Archivo: `supabase/migrations/20260720000000_knockout_bracket_engine.sql`  
ADR: `docs/ADR/0011-motor-eliminacion-directa-y-grupos.md`

Solo `format_type = 'knockout'`. **No** modifica `create_season_round_robin_fixture`.

### Schema

| Objeto | Rol |
| --- | --- |
| `season_knockout_rounds` | Rondas del bracket (`round_number`, `round_label`, `bracket_size`, `is_two_legs`) |
| `season_knockout_ties` | Llave por `bracket_slot` dentro de una ronda; `penalty_winner_season_team_id` a nivel de llave (agregado ida-vuelta), no por partido |
| `matches.knockout_round_id` / `bracket_slot` | Partidos de eliminatoria; `round_number`/`sequence_in_round` quedan NULL |

**Byes:** fila en `season_knockout_ties` con `away_season_team_id IS NULL`; el equipo avanza sin partido en esa ronda.

**Etiquetas de ronda:** derivadas automáticamente del `bracket_size` y `round_number` (`Octavos`, `Cuartos`, `Semifinal`, `Final`).

### RPCs (owner/admin)

| RPC | Efecto |
| --- | --- |
| `create_season_knockout_bracket(p_season_id, p_seed_mode default 'random')` | Ronda 1 únicamente: potencia de 2, byes, sorteo aleatorio. Gate `__assert_season_platform_billing_active`. Equipos `registered`/`confirmed`. Internamente usa `__create_knockout_bracket_from_slots`. |
| `configure_knockout_round(p_round_id, p_is_two_legs)` | Antes de que partidos salgan de `scheduled`; agrega/elimina pierna 2 con localía invertida. |
| `set_knockout_tie_penalty_winner(p_round_id, p_bracket_slot, p_winner_season_team_id)` | Solo si marcador (single) o agregado (two legs) está empatado. |
| `advance_knockout_round(p_season_id, p_round_number)` | Requiere todas las llaves resueltas; empareja ganadores por posición de bracket (slot 1 vs 2, 3 vs 4…). No pre-genera rondas futuras. Final resuelta → devuelve campeón. |
| `get_season_knockout_champion(p_season_id)` | Lectura del campeón si la final está resuelta. |

Rondas 2+ se crean **solo** vía `advance_knockout_round`. Programación sigue siendo `schedule_match` / `unschedule_match` sobre `matches` normales.

### Público (F8)

`get_public_season_matches` expone de forma aditiva `knockout_round_number`, `bracket_slot`, `leg_number` y usa `round_label` de la ronda knockout cuando aplica.

## Fase de grupos (Migration 026)

Archivo: `supabase/migrations/20260721000000_groups_knockout_phase.sql`  
ADR: `docs/ADR/0011-motor-eliminacion-directa-y-grupos.md`

Solo `format_type = 'groups_knockout'`. Reutiliza round-robin (por grupo) y motor knockout 025 (eliminatoria).

### Schema

| Objeto | Rol |
| --- | --- |
| `season_groups` | Grupos nombrados por season (`name` único por season) |
| `season_teams.season_group_id` | Asignación real equipo→grupo (**no** toca `group_name`, que sigue siendo informativo) |
| `matches.season_group_id` | Partidos de fase de grupos; excluyente con `knockout_round_id` |
| `season_rules.groups_advance_per_group` | Cuántos clasifican por grupo a la eliminatoria |

### RPCs (owner/admin)

| RPC | Efecto |
| --- | --- |
| `set_season_groups(p_season_id, p_group_names jsonb)` | Reemplazo atómico de definiciones de grupo (array de strings). No elimina grupos con matches. |
| `assign_teams_to_groups(p_season_id, p_assignments jsonb)` | Asigna `{season_team_id, group_id}`; valida misma season/org. |
| `generate_knockout_from_groups(p_season_id)` | Standings finales por grupo → siembra R1 del bracket vía `__create_knockout_bracket_from_slots`. Requiere `groups_advance_per_group` y fixture de grupo completo (sin partidos sin resultado). Billing gate. |

**Cruce R1 (simple):** si `G=2` grupos → `T[i,r] vs T[j, K+1-r]` (ej. 1A vs 2B). Si `K=1` y `G` par → primeros de grupos opuestos (`i` vs `i+G/2`). Si no encaja → emparejamiento aleatorio evitando mismo grupo cuando hay candidato. Ver reporte 026 para límites.

Rondas 2+ siguen con `advance_knockout_round` (025).

## Facturación de plataforma (Migration 021 + 027)

Columna `seasons.platform_billing_status`: `'pendiente'` (default) \| `'pagado'` \| `'vencido'`.

- Candado en `create_season_round_robin_fixture`, `create_season_knockout_bracket`, `generate_knockout_from_groups` y `apply_recurring_slot_to_season` si `≠ 'pagado'`.
- **Migration 021:** `REVOKE UPDATE (platform_billing_status)` + trigger que rechaza cambios con `auth.uid()` presente (sin vía app).
- **Migration 027:** tabla `platform_staff` (población manual en Supabase; sin acceso cliente). RPC `set_platform_billing_status(season_id, status, reason?)` — solo `is_platform_staff(auth.uid())`; bypass controlado del trigger vía `app.platform_billing_status_rpc`. RPC `get_platform_billing_overview()` — lectura mínima cross-org para panel `/plataforma/facturacion`. Sin UI/RPC para gestionar quién es staff.

## Programación

Timezone de producto: `America/Mexico_City`.

RPC `schedule_match(p_match_id, p_field_id, p_starts_at)`:

- Calcula `ends_at` en servidor: `match_duration_minutes + minimum_rest_minutes`.
- Valida field/venue activos y disponibilidad semanal del día.
- Rechaza si el slot cae en `season_field_block` de **otra** season (Migration 021).
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
- Requiere `seasons.platform_billing_status = 'pagado'` (Migration 021).
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

**UI admin (frontend):** en detalle de partido, owner/admin ven `MatchRescheduleAdminPanel` — propuesta pendiente (informativa), aprobada por rival (confirmar / sin disponibilidad), y confirmación directa de calendario (`confirm_match_calendar`) en partidos programados.

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
| tournament_admin | no (estructura) | no | sí (como miembro si aplica); captura con bypass de ventana |
| scorekeeper (confirmado) | no | no | captura en partido asignado (dentro de ventana) |
| externos/anon | no | no | no (vistas públicas vía RPC F8) |

## Rutas

- `.../temporadas/[seasonId]/fixture/generar`
- `.../temporadas/[seasonId]/calendario`
- `.../temporadas/[seasonId]/partidos/[matchId]`
- `.../temporadas/[seasonId]/partidos/[matchId]/programar`
- Hubs: `/organizaciones/[id]/calendario` y `/partidos`

## Siguiente paso

Standings y página pública (F8): ver `docs/STANDINGS_AND_PUBLIC_PAGES.md`. Captura: `docs/MATCH_OPERATION_AND_CAPTURE.md`. Avisos push/WhatsApp al confirmar calendario: fase posterior a 019.
