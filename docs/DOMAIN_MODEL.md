# Domain Model — LigaPro

## Estado

**Diseño v0 congelado.**

Schema SQL: Migrations 001–005 aplicadas en `ligapro-dev` (identidad, venues/fields, competitions/seasons, teams/players, field_reservations). El resto de entidades sigue pendiente.

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
11. `season_roles`
12. `teams` — **implementada (004)**
13. `players` — **implementada (004)**
14. `season_teams` — **implementada (004)**
15. `season_team_players` — **implementada (004)**
16. `matches`
17. `match_officials`
18. `match_events`
19. `discipline_suspensions`
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

`visibility` en `seasons` **todavía no** controla acceso público real: los miembros de la organización leen todas las seasons de su org vía RLS. El acceso anon/público llegará con vistas explícitas (ADR 0005). `format_type` admite `groups_knockout` / `knockout` como etiquetas; no existen tablas de groups/stages/brackets en este bloque. `season_roles` / `tournament_admin` quedan para un bloque futuro.

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

`match_id` es uuid nullable **sin FK todavía** — se agregará en Migration 006 vía `ALTER TABLE` cuando exista `matches`. Pendiente 006 también: CHECK de que `match_id` no sea NULL cuando `reservation_type = 'match'`.

### `field_reservations`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations`; trigger exige igualdad con field padre |
| `field_id` | uuid NOT NULL | FK → `fields(id)` ON DELETE CASCADE |
| `reservation_type` | text NOT NULL | CHECK: `match` \| `maintenance` \| `private_rental` \| `closed` \| `manual_block` |
| `match_id` | uuid nullable | **sin FK en 005**; FK → `matches` en 006 |
| `starts_at` | timestamptz NOT NULL | |
| `ends_at` | timestamptz NOT NULL | CHECK `ends_at > starts_at` |
| `title` | text nullable | útil para tipos distintos de `match` |
| `status` | text NOT NULL | default `confirmed`; CHECK `confirmed` \| `cancelled` |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

### Relaciones (001–005)

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
```

## Notas

- El dominio puro vive en `src/lib/domain/` como TypeScript sin dependencias de framework.
- Tipos generados: `src/types/database.ts`.
- Helpers RLS reutilizados desde 001: `is_member_of`, `has_role_in_org`.
