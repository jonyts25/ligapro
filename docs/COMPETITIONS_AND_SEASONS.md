# Competitions and Seasons — Frontend F4

## Competition vs season

| Concepto | Qué es | Ejemplo |
| --- | --- | --- |
| **Competition** | Estructura competitiva persistente de la organización | Liga Dominical Fútbol 7 Libre |
| **Season** | Edición concreta de esa competencia | Apertura 2026 |

Cardinalidad: `organization 1→* competitions 1→* seasons 1→1 season_rules`.

## Categorías en el MVP

No existe tabla `categories`. Si una “categoría” tiene equipos, reglas, calendario o campeón distintos, se modela como **otra competition**.

```text
Liga Dominical Libre
Liga Dominical Veteranos +35
```

## Schema real usado (Migration 003)

### `competitions`

`id`, `organization_id`, `name`, `created_at`, `updated_at`

Sin descripción, sin `is_active`, sin tipo/formato a nivel competence.

### `seasons`

`competition_id`, `organization_id`, `name`, `slug` (único por org), `format_type`, `visibility`, `starts_on`, `ends_on`

- `format_type`: `round_robin` | `round_robin_double` | `groups_knockout` | `knockout`
- `visibility`: `draft` | `private` | `unlisted` | `public` | `archived` (etiqueta de estado; **no** abre acceso público todavía)
- CHECK: `ends_on >= starts_on` cuando ambas fechas existen

### `season_rules` (1:1)

Creada automáticamente por trigger `seasons_create_default_rules` al insertar season.

Columnas: `points_win/draw/loss`, `allow_draws`, `match_duration_minutes`, `minimum_rest_minutes`, `yellow_card_limit`, `suspension_matches`

CHECK: `points_win >= points_draw >= points_loss`

No hay columnas de tiempos extra, penales, máximo de equipos ni inscripción abierta/cerrada.

## Pendiente de equipos

Badge de **presentación** cuando `count(season_teams) = 0`. No es una columna nueva.

## Creación y edición atómicas (Migration 013)

Crear o editar una temporada y sus reglas es una **operación atómica de PostgreSQL**.
No puede quedar una season con reglas parciales o defaults accidentales.

| RPC | Uso |
| --- | --- |
| `create_season_with_rules(...)` | INSERT season → trigger default rules → UPDATE rules; todo en una transacción |
| `update_season_with_rules(...)` | UPDATE season + UPDATE rules en la misma transacción |

- SECURITY DEFINER; `search_path = public`; sin `organization_id` / `profile_id` en la firma
- Autorización owner/admin resolviendo org desde competition/season
- REVOKE EXECUTE de PUBLIC/anon; GRANT solo a authenticated
- Si el UPDATE de reglas falla (p. ej. CHECK de puntos), **no queda season nueva**
- La UI **no** usa INSERT/UPDATE separados ni DELETE compensatorio

## Permisos F4

| Rol | Ver | Crear/editar competitions | Crear/editar seasons/rules |
| --- | --- | --- | --- |
| `organization_owner` | sí | sí | sí |
| `organization_admin` | sí | sí | sí |
| `organization_member` | sí | no | no |
| `tournament_admin` (season_role) | solo lectura org como member | no | no |
| anon / externo | no | no | no |

## Rutas

```text
/organizaciones/[organizationId]/torneos
/organizaciones/[organizationId]/torneos/nuevo
/organizaciones/[organizationId]/torneos/[competitionId]
/organizaciones/[organizationId]/torneos/[competitionId]/editar
/organizaciones/[organizationId]/torneos/[competitionId]/temporadas/nueva
/organizaciones/[organizationId]/torneos/[competitionId]/temporadas/[seasonId]
/organizaciones/[organizationId]/torneos/[competitionId]/temporadas/[seasonId]/editar
```

## Limitaciones

- Sin DELETE físico en UI
- Competition solo edita `name`
- Sin equipos / fixture / partidos / páginas públicas (F5+)
- `visibility = public` no implica acceso anon

## Siguiente paso (F5) — hecho en Frontend F5

Inscripción de equipos (`season_teams`), planteles y capitanía. Ver `docs/TEAMS_AND_ROSTERS.md`.

Siguiente: fixture / partidos.
