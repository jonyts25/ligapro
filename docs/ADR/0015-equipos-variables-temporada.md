# ADR 0015 — Equipos variables durante la temporada

**Estado:** Aceptado  
**Migration:** `20260808200000_cotizador_tier_teams_jornada.sql`

## Contexto

Un equipo puede retirarse o suspenderse a mitad de temporada sin borrar su inscripción. Los partidos ya jugados permanecen; los futuros deben anularse con trazabilidad. La tabla de posiciones debe comportarse según reglas configurables por temporada.

## Decisiones

### 1. Estado operativo en `season_teams`

Nuevas columnas (independientes de `registration_status` de inscripción):

| Columna | Tipo | Valores | Default |
| --- | --- | --- | --- |
| `status` | text | `activo`, `retirado`, `suspendido` | `activo` |
| `status_effective_at` | timestamptz | — | `now()` |

`registration_status` (`registered` / `confirmed` / `withdrawn`) sigue modelando el flujo de alta; `status` modela operación en curso de temporada.

### 2. RPC `set_season_team_status`

- `SECURITY DEFINER`, owner/admin de la org.
- Parámetros: `p_season_team_id`, `p_status`, `p_reason` (obligatorio), `p_effective_at` opcional.
- Audit trigger estándar (`audit_row_change`).
- No DELETE — el registro permanece.

### 3. Anulación de partidos futuros al retirarse

Al pasar a `retirado`, la RPC void automáticamente partidos **programados** (`scheduled`, sin `voided_at`) donde participa el equipo, vía nueva RPC `void_match(p_match_id, p_reason)` con razón fija `"equipo retirado"`.

Patrón void en `matches` (nuevo, análogo a `match_events` / `team_charges`):

- Columnas `voided_at`, `voided_by_profile_id`, `void_reason` (all-or-none CHECK).
- Trigger inmutable salvo flag `app.match_void = 'true'`.
- Partidos ya `finished`, `in_progress`, `cancelled`, `walkover` o ya voided no se tocan.

### 4. Regla de tabla: `walkover_en_retiro`

En `season_rules`:

| Campo | Tipo | Default |
| --- | --- | --- |
| `walkover_en_retiro` | boolean | `false` |
| `walkover_retiro_home_goals` | integer | 3 |
| `walkover_retiro_away_goals` | integer | 0 |

- `walkover_en_retiro = true`: partidos voided por `"equipo retirado"` cuentan en `get_season_standings` como victoria walkover para el rival, con marcador configurable.
- `walkover_en_retiro = false`: esos partidos se excluyen del cálculo (no cuentan para nadie).

### 5. Cierre de inscripciones

- `seasons.fecha_limite_inscripcion` (date, nullable).
- `enroll_team_in_season` rechaza altas nuevas después de esa fecha (comparación `current_date`) con mensaje explícito.
- No bloquea cambios de status ni operaciones sobre equipos ya inscritos.

## Consecuencias

- Fixture existente puede quedar con huecos; no se regenera automáticamente.
- Equipos `suspendido` no voidan partidos (solo `retirado` dispara void masivo).

## Fuera de alcance

Reingreso a media temporada, regeneración automática de fixture, suspensión con void de partidos.
