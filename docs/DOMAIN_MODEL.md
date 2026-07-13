# Domain Model — LigaPro

## Estado

**Diseño v0 congelado** + onboarding/branding (011) + sedes/canchas/disponibilidad (012 / Frontend F3) + torneos/temporadas/reglas (Frontend F4 sobre Migration 003).

Schema SQL: Migrations 001–012 (+ hardening) aplicadas en `ligapro-dev`. Pendiente: equipos en UI (F5), reservas, fixture, etc.

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
20. `team_charges` — **implementada (009)**
21. `team_payments` — **implementada (009)**
22. `audit_log` — **implementada (010)**

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

Alta de organización (Migration 011): RPC `create_organization_with_owner(p_name, p_brand_color DEFAULT NULL)` — transacción atómica, genera `slug` automáticamente, crea membresía `organization_owner` y exige **cero** membresías previas. Retorna `organization_id`.

| Columna branding (011) | Tipo | Notas |
|--------|------|--------|
| `brand_color` | text NULL | `#RRGGBB` mayúsculas o NULL (fallback LigaPro) |
| `logo_path` | text NULL | `<organization_id>/<uuid>.{png\|jpg\|jpeg\|webp}` — nunca URL completa |

Branding editable solo por owner/admin vía `update_organization_branding` / `set_organization_logo`. Logos en bucket público `organization-logos`. Ver `docs/ORGANIZATION_BRANDING.md`.

**Organization ≠ venue.** La organización es el cliente que opera LigaPro (complejo, liga, organizador). Las sedes físicas son `venues` / `fields`.

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
| `is_active` | boolean NOT NULL | default `true` (Migration 012); sin DELETE físico en UI |
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
| `is_active` | boolean NOT NULL | default `true` (Migration 012) |
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

Informativo (horarios habituales). Migration 012: exclusion constraint anti-solape (`no_overlapping_field_availability`, bounds `[)` → contiguos OK) + RPC `replace_field_availability` para reemplazo semanal atómico. La ocupación dura de partidos vive en `field_reservations` (aún sin UI). Ver `docs/VENUES_AND_FIELDS.md`.

## Bloque 003 — competitions, seasons, season_rules

`visibility` en `seasons` **todavía no** controla acceso público real: los miembros de la organización leen todas las seasons de su org vía RLS. El acceso anon/público llegará con vistas explícitas (ADR 0005). `format_type` admite `groups_knockout` / `knockout` como etiquetas; no existen tablas de groups/stages/brackets en este bloque. Permisos de captura por `season_roles` implementados en Migration 008.

**UI (Frontend F4):** módulo Torneos — CRUD competitions/seasons y edición de `season_rules` para owner/admin; members solo lectura. Categorías = competitions independientes (sin tabla `categories`). “Pendiente de equipos” es badge de presentación cuando no hay `season_teams`. Ver `docs/COMPETITIONS_AND_SEASONS.md`.

**Atomicidad (Migration 013):** `create_season_with_rules` y `update_season_with_rules` — season + rules en una sola transacción PostgreSQL. Sin compensación DELETE en la app.

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

## Bloque 009 — finanzas básicas por equipo/temporada

Registros **manuales** de cargos y pagos asociados a un `season_team`. LigaPro **no procesa dinero** ni integra pasarelas de pago en este bloque. No existe estado `paid`/`pending`: el saldo se **calcula** a partir de cargos y pagos activos (no anulados).

Solo `organization_owner` y `organization_admin` pueden ver y administrar finanzas. Captains, `organization_member`, `tournament_admin`, árbitros y delegados **no** tienen acceso todavía.

### `team_charges`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE; trigger exige igualdad con `season_teams.organization_id` |
| `season_team_id` | uuid NOT NULL | FK → `season_teams(id)` ON DELETE RESTRICT |
| `charge_type` | text NOT NULL | CHECK: `registration` \| `referee_fee` \| `fine` \| `other` |
| `description` | text nullable | |
| `amount` | numeric(12,2) NOT NULL | CHECK `> 0` |
| `currency` | text NOT NULL | default `MXN`; CHECK `currency = 'MXN'` (MVP); otras monedas requieren migración explícita |
| `due_date` | date nullable | |
| `created_by_profile_id` | uuid NOT NULL | FK → `profiles(id)` ON DELETE RESTRICT; trigger exige `= auth.uid()` y membresía en la org |
| `voided_at` | timestamptz nullable | anulación vía RPC `void_team_charge` |
| `voided_by_profile_id` | uuid nullable | FK → `profiles(id)` ON DELETE RESTRICT |
| `void_reason` | text nullable | all-or-none con campos de anulación |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Inmutable tras INSERT (sin UPDATE/DELETE directo). Corrección de errores: anular con motivo y crear registro nuevo.

### `team_payments`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE CASCADE; trigger tenant |
| `season_team_id` | uuid NOT NULL | FK → `season_teams(id)` ON DELETE RESTRICT |
| `amount` | numeric(12,2) NOT NULL | CHECK `> 0` |
| `currency` | text NOT NULL | default `MXN`; CHECK `currency = 'MXN'` (MVP); otras monedas requieren migración explícita |
| `payment_method` | text NOT NULL | CHECK: `cash` \| `transfer` \| `card` \| `other` |
| `reference` | text nullable | **privado** (solo owner/admin) |
| `notes` | text nullable | **privado** |
| `paid_at` | timestamptz NOT NULL | default `now()` |
| `recorded_by_profile_id` | uuid NOT NULL | FK → `profiles(id)` ON DELETE RESTRICT; trigger exige `= auth.uid()` y membresía |
| `voided_at` | timestamptz nullable | anulación vía RPC `void_team_payment` |
| `voided_by_profile_id` | uuid nullable | |
| `void_reason` | text nullable | all-or-none |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | trigger `set_updated_at` |

Mismas reglas de inmutabilidad y anulación que `team_charges`.

### Modelo de saldo

Vista privada `season_team_financial_summary` (`security_invoker = true`):

| Columna | Definición |
|--------|------------|
| `total_active_charges` | SUM(`team_charges.amount`) WHERE `voided_at IS NULL` |
| `total_active_payments` | SUM(`team_payments.amount`) WHERE `voided_at IS NULL` |
| `balance_due` | cargos − pagos (negativo = saldo a favor; permitido) |
| `currency` | agrupada por moneda; en MVP solo existe `MXN` |
| `next_due_date` | MIN(`due_date`) de cargos activos con fecha |

Incluye `season_teams` sin movimientos (ceros en MXN). **MVP: únicamente MXN.** La columna `currency` se conserva para ampliación futura; habilitar otras monedas requiere una migración explícita que amplíe el CHECK. La vista agrupa por `currency` para no mezclar monedas si eso ocurre más adelante.

RPCs: `void_team_charge(p_charge_id, p_reason)`, `void_team_payment(p_payment_id, p_reason)` — solo owner/admin; motivo obligatorio; sin restauración.

### Relaciones (001–009)

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
season_teams 1──* team_charges
organizations 1──* team_charges (denormalizado)
profiles 1──* team_charges (created_by / voided_by)
season_teams 1──* team_payments
organizations 1──* team_payments (denormalizado)
profiles 1──* team_payments (recorded_by / voided_by)
season_teams 0..1──* season_team_financial_summary (vista)
organizations 1──* audit_log
profiles 0..1──* audit_log (actor_profile_id)
```

## Bloque 010 — audit_log inmutable

Trazabilidad automática de cambios administrativos, deportivos, disciplinarios y financieros. Escrita **solo** por triggers Postgres (`audit_row_change`); la UI no crea auditorías. Append-only: sin UPDATE/DELETE de aplicación.

### `audit_log`

| Columna | Tipo | Notas |
|--------|------|--------|
| `id` | uuid PK | default `gen_random_uuid()` |
| `organization_id` | uuid NOT NULL | FK → `organizations(id)` ON DELETE **RESTRICT** (orgs con historial no se borran físicamente; archivar en el futuro) |
| `actor_profile_id` | uuid nullable | FK → `profiles(id)` ON DELETE SET NULL; `auth.uid()` o NULL |
| `entity_type` | text NOT NULL | `TG_TABLE_NAME` |
| `entity_id` | uuid NOT NULL | `id` de la fila afectada |
| `action` | text NOT NULL | CHECK: `insert` \| `update` \| `delete` |
| `before_data` | jsonb nullable | NULL en INSERT |
| `after_data` | jsonb nullable | NULL en DELETE |
| `changed_fields` | text[] NOT NULL | default `{}`; excluye `updated_at`; UPDATE sin cambios reales no genera fila |
| `source` | text NOT NULL | default `database_trigger`; CHECK también `system_trigger` (reservado) |
| `created_at` | timestamptz | sin `updated_at` |

Para `organizations`, `organization_id = organizations.id`.

### Entidades auditadas

`organizations`, `organization_members`, `venues`, `fields`, `field_availability_rules`, `field_reservations`, `competitions`, `seasons`, `season_rules`, `season_roles`, `teams`, `players`, `season_teams`, `season_team_players`, `matches`, `match_officials`, `match_events`, `discipline_suspensions`, `team_charges`, `team_payments`.

**No auditadas:** `profiles` (identidad global sin tenancy org), `audit_log` (sin recursión).

### Exclusiones de snapshots (privacidad)

| Tabla | Columnas excluidas |
|-------|-------------------|
| `team_payments` | `reference`, `notes` |
| `team_charges` | `description` |
| `discipline_suspensions` | `notes` |
| `players` | ninguna adicional (schema actual sin teléfono/email/DOB/docs) |
| `organization_members` | ninguna adicional (solo ids/role) |

### RLS

SELECT solo `organization_owner` / `organization_admin`. Sin policies INSERT/UPDATE/DELETE. `GRANT SELECT` a `authenticated`; `REVOKE ALL` de PUBLIC/anon.

**Guarantee (010b):** Un usuario de aplicación no puede omitir, modificar ni eliminar auditorías, aunque establezca `app.skip_audit` o `app.audit_allow_delete`. Esas variables ya no tienen efecto en código productivo.

Teardown de pruebas (runner privilegiado únicamente): `DISABLE TRIGGER USER` en tablas auditadas + `audit_log_prevent_mutation`; sin flags de sesión ni RPCs de cleanup.

## Notas

- El dominio puro vive en `src/lib/domain/` como TypeScript sin dependencias de framework.
- Tipos generados: `src/types/database.ts`.
- Helpers RLS reutilizados desde 001: `is_member_of`, `has_role_in_org`.
