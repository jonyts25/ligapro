# Domain Model — LigaPro

## Estado

**Diseño v0 congelado.**

Schema SQL: Migrations 001 (identidad) + 002 (venues/fields) + 003 (competitions/seasons/rules) aplicadas en `ligapro-dev`. El resto de entidades sigue pendiente.

## Entidades aprobadas (22)

1. `profiles` — **implementada (001)**
2. `organizations` — **implementada (001)**
3. `organization_members` — **implementada (001)**
4. `venues` — **implementada (002)**
5. `fields` — **implementada (002)**
6. `field_availability_rules` — **implementada (002)**
7. `field_reservations`
8. `competitions` — **implementada (003)**
9. `seasons` — **implementada (003)**
10. `season_rules` — **implementada (003)**
11. `season_roles`
12. `teams`
13. `players`
14. `season_teams`
15. `season_team_players`
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

### Relaciones (001 + 002 + 003)

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
organizations 1──* competitions
competitions 1──* seasons
organizations 1──* seasons (denormalizado)
seasons 1──1 season_rules
organizations 1──* season_rules (denormalizado)
```

## Notas

- El dominio puro vive en `src/lib/domain/` como TypeScript sin dependencias de framework.
- Tipos generados: `src/types/database.ts`.
- Helpers RLS reutilizados desde 001: `is_member_of`, `has_role_in_org`.
