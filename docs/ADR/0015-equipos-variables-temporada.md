# ADR 0015 — Equipos variables durante la temporada

**Estado:** Aceptado  
**Migration:** `20260809100000_season_teams_status_void_match.sql`

## Contexto

`season_teams.registration_status` (`registered` | `confirmed` | `withdrawn`)
modela el flujo de inscripción y ya excluye equipos `withdrawn` del fixture.
Se necesita un estado operativo distinto (`activo` | `retirado` | `suspendido`)
con efecto temporal, corrección auditada y tratamiento de partidos futuros al
retiro, sin borrar la inscripción.

## Decisiones

### 1. Columnas en `season_teams`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `status` | text | `activo` \| `retirado` \| `suspendido`, default `activo` |
| `status_effective_at` | timestamptz | Momento del último cambio de `status` |

Coexiste con `registration_status`; no se unifican.

### 2. RPC `set_season_team_status`

- `SECURITY DEFINER`; owner/admin (scoped vía `has_role_in_org_scoped` cuando
  aplica).
- Parámetros: `p_season_team_id`, `p_status`, `p_reason` (obligatorio, no vacío).
- Actualiza `status` + `status_effective_at = now()`.
- Audit trigger estándar en `season_teams`.
- **No** es DELETE; el registro permanece.

### 3. Partidos futuros al retirar

Al pasar a `retirado`, la RPC anula partidos **programados** (`status =
'scheduled'`) donde el equipo es local o visitante, usando nueva RPC
`void_match` (mismo patrón de voiding que finanzas/eventos):

- Columnas en `matches`: `voided_at`, `voided_by_profile_id`, `void_reason`.
- Razón fija: `"equipo retirado"`.
- Partidos ya jugados (`finished`, `walkover`, `in_progress`, etc.) no se tocan.

### 4. Regla de tabla: `walkover_en_retiro`

Campos en `season_rules`:

| Campo | Default | Uso |
| --- | --- | --- |
| `walkover_en_retiro` | `false` | Si true, void → `walkover` a favor del rival |
| `walkover_retiro_winner_goals` | `3` | Goles del ganador (walkover) |
| `walkover_retiro_loser_goals` | `0` | Goles del perdedor |

Si `walkover_en_retiro = false`, void → `cancelled` (excluido de posiciones,
como hoy).

`create_season_with_rules` **no cambia de firma**; defaults vía migración.
`update_season_with_rules` se extiende con los nuevos campos opcionales.

### 5. Cierre de inscripciones

- `season_rules.fecha_limite_inscripcion` (date, nullable).
- `enroll_team_in_season` rechaza inscripciones nuevas después de esa fecha
  (comparación `current_date > fecha_limite_inscripcion`) con mensaje explícito.

## Consecuencias

- Retiro operativo ≠ retiro de inscripción (`withdrawn`); el admin puede usar
  el que corresponda.
- Standings siguen usando statuses `finished`/`walkover`; cancelled queda fuera.

## Fuera de alcance

- Reingreso a media temporada.
- Anular partidos por `suspendido` (solo `retirado` dispara void masivo).
