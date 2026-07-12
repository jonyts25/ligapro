# Domain Model — LigaPro

## Estado

**Diseño v0 congelado.**

Schema SQL: Migration 001 (identidad) + Migration 002 (venues/fields/reglas) aplicadas en `ligapro-dev`. El resto de entidades sigue pendiente.

## Entidades aprobadas (22)

1. `profiles` — **implementada (001)**
2. `organizations` — **implementada (001)**
3. `organization_members` — **implementada (001)**
4. `venues` — **implementada (002)**
5. `fields` — **implementada (002)**
6. `field_availability_rules` — **implementada (002)**
7. `field_reservations`
8. `competitions`
9. `seasons`
10. `season_rules`
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

### Relaciones (001 + 002)

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
```

## Notas

- El dominio puro vive en `src/lib/domain/` como TypeScript sin dependencias de framework.
- Tipos generados: `src/types/database.ts`.
- Helpers RLS reutilizados desde 001: `is_member_of`, `has_role_in_org`.
