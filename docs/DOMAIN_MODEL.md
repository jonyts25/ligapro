# Domain Model — LigaPro

## Estado

**Diseño v0 congelado.**

Schema SQL: Migrations 001–008 aplicadas en `ligapro-dev` (hasta season_roles + captura controlada). Pendiente: team_charges, vistas públicas, descuento automático de suspensiones, etc.

## Entidades aprobadas (22)

1. `profiles` — **implementada (001)**
2. `organizations` — **implementada (001)**
3. `organization_members` — **implementada (001)**
4. `venues` — **implementada (002)**
5. `fields` — **implementada (002)**
6. `field_availability_rules` — **implementada (002)**
7. `field_reservations` — **implementada (005)**
8. `competitions` — **implementada (003)**
9. `seasons` — **implementada (003)**
10. `season_rules` — **implementada (003)**
11. `season_roles` — **implementada (008)**
12. `teams` — **implementada (004)**
13. `players` — **implementada (004)**
14. `season_teams` — **implementada (004)**
15. `season_team_players` — **implementada (004)**
16. `matches` — **implementada (006a)**
17. `match_officials` — **implementada (006a)**
18. `match_events` — **implementada (006b)**
19. `discipline_suspensions` — **implementada (007)**
20. `team_charges`
21. `team_payments`
22. `audit_log`

## Bloque 001 — identidad y multi-tenancy

### `profiles`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `email` | text NOT NULL | |
| `display_name` | text nullable | |
| `created_at` | timestamptz | default `now()` |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Creación: trigger `AFTER INSERT ON auth.users` (`handle_new_user`), no desde el cliente. Si el trigger falla, el signup completo aborta.

### `organizations`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `name` | text NOT NULL | |
| `slug` | text NOT NULL | UNIQUE |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |
| `created_by` | uuid NOT NULL | FK → `profiles(id)` |

Alta de organización: RPC `create_organization_with_owner(name, slug)` (transacción atómica + primer owner).

### `organization_members`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `profile_id` | uuid NOT NULL | FK → `profiles(id)` ON DELETE CASCADE |
| `role` | text NOT NULL | CHECK: `organization_owner` \| `organization_admin` \| `organization_member` |
| `created_at` | timestamptz | |

UNIQUE `(organization_id, profile_id)`. Varios owners permitidos; trigger impide quedar en cero owners (con bypass controlado al borrar la organización).

## Bloque 002 — infraestructura física de canchas

Visibilidad pública **NO** aplica todavía a estas tablas: solo miembros autenticados de la organización (RLS). Las vistas públicas llegan en un bloque posterior (ADR 0005).

### `venues`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `name` | text NOT NULL | |
| `address` | text nullable | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### `fields`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `venue_id` | uuid NOT NULL | FK → `venues(id)` ON DELETE CASCADE |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE; denormalizado para RLS; trigger exige igualdad con el venue padre |
| `name` | text NOT NULL | ej. "Campo 1" |
| `surface_type` | text nullable | texto libre (pasto, sintético, …); sin ENUM en MVP |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### `field_availability_rules`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `field_id` | uuid NOT NULL | FK → `fields(id)` ON DELETE CASCADE |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE; trigger exige igualdad con el field padre |
| `day_of_week` | integer NOT NULL | CHECK 0–6 |
| `starts_at` | time NOT NULL | |
| `ends_at` | time NOT NULL | CHECK `ends_at > starts_at` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Informativo (horarios habituales). **No** detecta traslapes entre reglas; la ocupación dura vive en `field_reservations` (bloque futuro).

## Bloque 003 — competitions, seasons, season_rules

`visibility` en `seasons` **todavía no** controla acceso público real: los miembros de la organización leen todas las seasons de su org vía RLS. El acceso anon/público llegará con vistas explícitas (ADR 0005). `format_type` admite `groups_knockout` / `knockout` como etiquetas; no existen tablas de groups/stages/brackets en este bloque. Permisos de captura por `season_roles` implementados en Migration 008.

### `competitions`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `name` | text NOT NULL | ej. "Liga Dominical Miura" |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### `seasons`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `competition_id` | uuid NOT NULL | FK → `competitions(id)` ON DELETE CASCADE |
| `organization_id` | uuid NOT NULL | denormalizado; trigger exige igualdad con competition padre |
| `name` | text NOT NULL | ej. "Apertura 2026" |
| `slug` | text NOT NULL | UNIQUE `(organization_id, slug)` |
| `format_type` | text NOT NULL | CHECK: `round_robin` \| `round_robin_double` \| `groups_knockout` \| `knockout` |
| `visibility` | text NOT NULL | default `draft`; CHECK: `draft` \| `private` \| `unlisted` \| `public` \| `archived` |
| `starts_on` | date nullable | |
| `ends_on` | date nullable | CHECK `ends_on >= starts_on` cuando ambos no null |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Al insertar una season, un trigger AFTER INSERT crea automáticamente la fila `season_rules` con defaults.

### `season_rules`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `season_id` | uuid NOT NULL | FK → `seasons(id)` ON DELETE CASCADE; UNIQUE (1:1) |
| `organization_id` | uuid NOT NULL | denormalizado; trigger exige igualdad con season padre |
| `points_win` | integer NOT NULL | default 3; CHECK ≥ 0 |
| `points_draw` | integer NOT NULL | default 1; CHECK ≥ 0 |
| `points_loss` | integer NOT NULL | default 0; CHECK ≥ 0 |
| | | CHECK `points_win >= points_draw >= points_loss` |
| `allow_draws` | boolean NOT NULL | default true |
| `match_duration_minutes` | integer NOT NULL | default 90; CHECK > 0 |
| `minimum_rest_minutes` | integer NOT NULL | default 0; CHECK ≥ 0 |
| `yellow_card_limit` | integer NOT NULL | default 5; CHECK > 0 |
| `suspension_matches` | integer NOT NULL | default 1; CHECK > 0 |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Columnas tipadas (no JSON). Sin `season_rule_templates`.

## Bloque 004 — teams, players, season_teams, season_team_players

El **capitán** vive únicamente en `season_team_players.is_captain` (máximo uno por `season_team` vía UNIQUE parcial). No existe `season_role` de captain. `profile_id` en `players` es opcional; no es requisito de BD para ser capitán. Permisos de capitán a nivel RLS / `season_roles` son un bloque futuro. Sin acceso anon/público todavía.

### `teams`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `name` | text NOT NULL | identidad persistente (no ligada a una season) |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### `players`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE |
| `profile_id` | uuid nullable | FK → `profiles(id)` ON DELETE SET NULL; UNIQUE parcial `(organization_id, profile_id)` WHERE NOT NULL |
| `full_name` | text NOT NULL | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### `season_teams`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `season_id` | uuid NOT NULL | FK → `seasons(id)` ON DELETE CASCADE |
| `team_id` | uuid NOT NULL | FK → `teams(id)` ON DELETE CASCADE |
| `organization_id` | uuid NOT NULL | denormalizado; trigger exige igualdad con season Y team |
| `display_name` | text nullable | si NULL, la app usa `teams.name` |
| `group_name` | text nullable | manual para `groups_knockout` |
| `registration_status` | text NOT NULL | default `registered`; CHECK `registered` \| `confirmed` \| `withdrawn` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

UNIQUE `(season_id, team_id)`.

### `season_team_players`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `season_team_id` | uuid NOT NULL | FK → `season_teams(id)` ON DELETE CASCADE |
| `player_id` | uuid NOT NULL | FK → `players(id)` ON DELETE CASCADE |
| `organization_id` | uuid NOT NULL | denormalizado; trigger exige igualdad con season_team Y player |
| `jersey_number` | integer nullable | CHECK > 0; UNIQUE parcial por `season_team_id` |
| `is_captain` | boolean NOT NULL | default false; UNIQUE parcial un capitán por team; CHECK debe ser `active` |
| `registration_status` | text NOT NULL | default `active`; CHECK `active` \| `inactive` \| `suspended` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

UNIQUE `(season_team_id, player_id)`. Cambio de capitán: RPC `set_season_team_captain` (atómico).

## Bloque 005 — field_reservations

**Única fuente de verdad** del calendario físico de canchas (ADR 0004). Todo lo que ocupa un field (partido, mantenimiento, renta, cierre, bloqueo) vive aquí. Protegida por constraint `EXCLUDE` (`no_overlapping_reservations`) sobre `field_id` + `tstzrange(starts_at, ends_at)` **solo cuando** `status = 'confirmed'`. Rangos adyacentes (`[)`) no chocan.

`match_id` tiene FK real → `matches(id)` (cerrado en Migration 006a) y CHECK `reservation_type <> 'match' OR match_id IS NOT NULL`.

### `field_reservations`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations`; trigger exige igualdad con field padre |
| `field_id` | uuid NOT NULL | FK → `fields(id)` ON DELETE CASCADE |
| `reservation_type` | text NOT NULL | CHECK: `match` \| `maintenance` \| `private_rental` \| `closed` \| `manual_block` |
| `match_id` | uuid nullable | FK → `matches(id)` ON DELETE SET NULL (006a); requerido si type = `match` |
| `starts_at` | timestamptz NOT NULL | |
| `ends_at` | timestamptz NOT NULL | CHECK `ends_at > starts_at` |
| `title` | text nullable | útil para tipos distintos de `match` |
| `status` | text NOT NULL | default `confirmed`; CHECK `confirmed` \| `cancelled` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

## Bloque 006a — matches + match_officials

Captura de resultado por oficiales / `match_events` **no** está en este bloque (006b). Matches solo se crean/editan por owner/admin. `field_reservation_id` es opcional (fixture antes que horario).

### `matches`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `season_id` | uuid NOT NULL | FK → `seasons` |
| `organization_id` | uuid NOT NULL | trigger vs season padre |
| `home_season_team_id` | uuid NOT NULL | FK → `season_teams`; trigger exige misma `season_id` |
| `away_season_team_id` | uuid NOT NULL | FK → `season_teams`; ≠ home; misma season |
| `field_reservation_id` | uuid nullable | FK → `field_reservations` ON DELETE SET NULL |
| `status` | text NOT NULL | default `scheduled`; CHECK scheduled/in_progress/finished/cancelled/walkover |
| `home_score` / `away_score` | integer nullable | ≥ 0; ambos NULL o ambos NOT NULL |
| `round_label` | text nullable | ej. "Jornada 3", "Semifinal" |
| `created_at` / `updated_at` | timestamptz | |

### `match_officials`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `match_id` | uuid NOT NULL | FK → `matches` |
| `organization_id` | uuid NOT NULL | trigger vs match padre |
| `profile_id` | uuid NOT NULL | FK → `profiles` |
| `role` | text NOT NULL | CHECK referee/assistant/delegate/scorekeeper |
| `status` | text NOT NULL | default `assigned`; CHECK assigned/confirmed/declined |
| `created_at` / `updated_at` | timestamptz | |

UNIQUE `(match_id, profile_id, role)`.

## Bloque 006b — match_events

Solo registro de eventos en cancha. Generación de suspensiones vía trigger (007). **Captura controlada (008):** owner/admin conservan CRUD completo; captura aditiva para tournament_admin y oficiales confirmados (ver Bloque 008).

FK a `season_team_players` (no a `players`) para anclar el evento al roster temporada/equipo. El catálogo incluye `substitution_in` / `substitution_out` **sin** validación de alineación — decisión deliberada; se revisará tras entrevistas reales.

### `match_events`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `match_id` | uuid NOT NULL | FK → `matches` |
| `organization_id` | uuid NOT NULL | trigger vs match padre |
| `season_team_player_id` | uuid NOT NULL | FK → `season_team_players`; trigger exige home o away del match |
| `event_type` | text NOT NULL | CHECK goal/own_goal/yellow_card/red_card/substitution_in/substitution_out/injury |
| `minute` | integer NOT NULL | CHECK 0–130 |
| `notes` | text nullable | texto libre |
| `created_at` / `updated_at` | timestamptz | |

## Bloque 007 — discipline_suspensions

Suspensiones por tarjeta roja directa, acumulación de amarillas, o administrativas.  
`matches_remaining` es informativo/manual en este bloque: el descuento automático por partido jugado queda pendiente del generador de fixture.

**Generación automática** (`AFTER INSERT ON match_events`, SECURITY DEFINER):
- `red_card` → fila `direct_red` con `matches_remaining = season_rules.suspension_matches`
- `yellow_card` → si el conteo de amarillas de ese `season_team_player` en la misma season es múltiplo exacto de `season_rules.yellow_card_limit` → fila `accumulation` (source = la tarjeta que cruzó el umbral)
- Otros `event_type` → no-op

### `discipline_suspensions`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | trigger vs season_team_player padre |
| `season_team_player_id` | uuid NOT NULL | FK → `season_team_players` |
| `source_match_event_id` | uuid nullable | FK → `match_events`; obligatorio salvo `administrative`; mismo jugador |
| `suspension_type` | text NOT NULL | CHECK direct_red/accumulation/administrative |
| `matches_remaining` | integer NOT NULL | ≥ 0; ajuste manual por admin |
| `matches_served` | integer NOT NULL | default 0; ≥ 0 |
| `status` | text NOT NULL | default `active`; CHECK active/served/waived |
| `notes` | text nullable | |
| `created_at` / `updated_at` | timestamptz | |

## Bloque 008 — season_roles y captura controlada

**Elegibilidad de temporada ≠ asignación a partido.** Un `season_role` solo habilita captura en conjunción con `match_officials.status = 'confirmed'` para referee/delegate. Membership en `organization_members` es obligatoria antes de recibir un season_role (trigger).

### Matriz de captura (Migration 008)

| Rol | match_events | matches (marcador/status) | match_officials |
|-----|--------------|---------------------------|-----------------|
| organization_owner / organization_admin | CRUD completo (policies 006b) | UPDATE completo (006a) | CRUD (006a) |
| tournament_admin | **INSERT** en cualquier match de su season; sin UPDATE/DELETE directo | `update_match_result()` RPC únicamente | sin cambios |
| referee / delegate | **INSERT** en su match si season_role + confirmed; sin UPDATE/DELETE directo | **no** (RPC rechaza) | sin cambios |
| assistant / scorekeeper | sin permisos nuevos | sin permisos nuevos | sin cambios |

`discipline_suspensions`: sin cambios; trigger SECURITY DEFINER de 007 sigue generando suspensiones aunque el evento lo inserte un capturador autorizado.

### `season_roles`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | |
| `organization_id` | uuid NOT NULL | trigger vs season padre |
| `season_id` | uuid NOT NULL | FK → `seasons` |
| `profile_id` | uuid NOT NULL | FK → `profiles`; debe existir en `organization_members` |
| `role` | text NOT NULL | CHECK tournament_admin / referee / delegate |
| `created_at` / `updated_at` | timestamptz | |

FK compuesta → `organization_members(organization_id, profile_id)` ON DELETE CASCADE. `has_season_role` exige membresía vigente (JOIN a `organization_members`).

Helpers: `has_season_role`, `can_capture_match`, RPC `update_match_result`.

**Pendiente:** RPC segura para corregir/anular eventos con reconciliación de `discipline_suspensions` (007 solo genera en INSERT).

### Relaciones (001–008)

```text
auth.users 1──1 profiles
profiles 1──* organizations (created_by)
organizations 1──* organization_members
profiles 1──* organization_members
organizations 1──* venues
venues 1──* fields
organizations 1──* fields (denormalizado)
fields 1──* field_availability_rules
organizations 1──* field_availability_rules (denormalizado)
fields 1──* field_reservations
organizations 1──* field_reservations (denormalizado)
matches 0..1──* field_reservations (match_id)
organizations 1──* competitions
competitions 1──* seasons
organizations 1──* seasons (denormalizado)
seasons 1──1 season_rules
organizations 1──* season_rules (denormalizado)
organizations 1──* teams
organizations 1──* players
profiles 0..1──* players (opcional, por org)
seasons 1──* season_teams
teams 1──* season_teams
organizations 1──* season_teams (denormalizado)
season_teams 1──* season_team_players
players 1──* season_team_players
organizations 1──* season_team_players (denormalizado)
seasons 1──* matches
season_teams 1──* matches (home/away)
field_reservations 0..1──* matches (field_reservation_id)
matches 1──* match_officials
profiles 1──* match_officials
organizations 1──* match_officials (denormalizado)
matches 1──* match_events
season_team_players 1──* match_events
organizations 1──* match_events (denormalizado)
season_team_players 1──* discipline_suspensions
match_events 0..1──* discipline_suspensions (source)
organizations 1──* discipline_suspensions (denormalizado)
seasons 1──* season_roles
profiles 1──* season_roles
organizations 1──* season_roles (denormalizado)
```

## Notas

- El dominio puro vive en `src/lib/domain/` como TypeScript sin dependencias de framework.
- Tipos generados: `src/types/database.ts`.
- Helpers RLS reutilizados desde 001: `is_member_of`, `has_role_in_org`.
