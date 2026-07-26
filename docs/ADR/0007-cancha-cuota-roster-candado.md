# ADR 0007 — Bloqueo de cancha por torneo, cuota automática, roster delegado, subcapitán único, candado de facturación

**Estado:** Aceptada (Migration 021)  
**Fecha:** 2026-07-26

## Contexto

El portal del capitán (`/mi-equipo`, commit `e5ed883`) expuso huecos de backend: RLS de lectura insuficiente, ausencia de `profiles.phone`, y necesidad de reglas operativas para bloqueos de cancha entre torneos, cuota de inscripción, altas delegadas al capitán y activación comercial de temporadas.

## Decisiones

### 0. Cierre de bloqueantes del portal

- RLS SELECT para capitán/subcapitán vinculado en `season_teams`, `season_team_players`, `field_reservations` (partidos propios), reutilizando `is_active_captain_or_vice_of_season_team`.
- Columna `profiles.phone` nullable; RLS existente de perfil propio cubre lectura/edición.

### 1. `season_field_blocks`

- Tabla **separada** de `field_reservations`.
- Misma season: varios bloqueos permitidos (días distintos o franjas no solapadas).
- Seasons distintas: no solape en mismo field/día/hora (EXCLUDE + trigger cross-season).
- RPC `set_season_field_blocks`: reemplazo atómico; solo owner/admin.
- `schedule_match` / `apply_recurring_slot_to_season`: rechazan bloqueo de **otra** season.

### 2. Cuota de inscripción

- `season_rules.registration_fee` nullable.
- `enroll_team_in_season` crea `team_charge` (`registration`) en la misma transacción si hay fee.

### 3. Roster delegado (solo alta)

- Capitán/subcapitán vinculado puede `create_player_and_add_to_roster` / `add_player_to_season_team` en **su** equipo.
- Sin baja, status, capitanía ni subcapitanía (salvo regla 4).
- `max_roster_size` y `roster_locked_by_captain` aplican solo al capitán; admin bypass.
- RPC `set_roster_lock` solo owner/admin.

### 4. Subcapitán de designación única

- Capitán/subcapitán: designa vice solo si cargo vacío.
- Owner/admin: designa o reemplaza siempre.

### 5. Candado de facturación LigaPro

- `seasons.platform_billing_status` (`pendiente` | `pagado` | `vencido`).
- Gate en fixture y slot recurrente si `≠ pagado`.
- Sin escritura app: REVOKE + trigger; gestión manual en Supabase.

## Fuera de alcance (021)

- UI de bloqueos, disponibilidad cruzada, alta de jugador en dashboard capitán.
- Panel admin de `platform_billing_status`.
- RPC `get_field_availability_overview` (pendiente frontend).

## Consecuencias

- Portal capitán backend-complete; frontend debe cablear `profiles.phone` y pantallas admin/capitán en prompt siguiente.
- Tests 019/020 actualizados: `platform_billing_status = 'pagado'` en setup de fixture.
