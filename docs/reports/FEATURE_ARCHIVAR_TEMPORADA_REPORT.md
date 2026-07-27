# Reporte — Archivar temporada

**Fecha:** 2026-07-26  
**Alcance:** Investigación del estado `visibility = 'archived'` existente + cierre de huecos en UI y frontend. Sin migración nueva ni DELETE físico.

## 1. Hallazgos de investigación (antes de construir)

### 1.1 UI existente

| Pregunta | Hallazgo |
|----------|----------|
| ¿Existía botón «Archivar temporada»? | **No.** Solo un selector genérico «Estado» en `SeasonForm` con opción «Archivada», sin confirmación ni explicación. |
| ¿Acción inversa? | **No.** Mismo selector; se podía volver a otro estado sin flujo dedicado. |

### 1.2 Comportamiento previo de `archived`

| Área | Comportamiento antes |
|------|---------------------|
| Listado de temporadas del torneo | Mezcladas con activas (`getCompetitionWithSeasons` sin filtro). |
| Edición | Totalmente editable vía `/editar` y `update_season_with_rules`. |
| Página pública | `__resolve_public_season` exige `visibility = 'public'` → archivadas **no** aparecen en `get_public_season_*` (igual que draft/private/unlisted). |
| RPCs de escritura | `__assert_season_readable` valida membresía, **no** bloquea archivadas → captura, fixture, disciplina, finanzas, etc. siguen operativos en backend si se invocan directamente. |

### 1.3 Decisión de alcance (prompt UI)

- **Implementado en el prompt UI:** acciones dedicadas, separación de listados, bloqueo operativo en frontend, finanzas solo lectura.
- **Reportado como gap backend** (ver §7, ya cerrado).

---

## 7. Seguimiento — candado RPC (Migration 028)

**Fecha:** 2026-07-26  
**Objetivo:** `__assert_season_not_archived` en todas las escrituras relevantes; lectura sin cambios.

### 7.1 Helper central

| Función | Rol |
|---------|-----|
| `__assert_season_not_archived(p_season_id)` | Rechaza si `visibility = 'archived'` con mensaje claro |
| `__assert_season_not_archived_for_match` | Resuelve `season_id` desde `matches` |
| `__assert_season_not_archived_for_season_team` | Resuelve desde `season_teams` |
| `__assert_season_not_archived_for_season_team_player` | Resuelve vía STP |
| `__assert_season_not_archived_for_suspension` | Resuelve vía disciplina |
| `__assert_season_not_archived_for_match_event` | Resuelve vía evento → partido |
| `__assert_season_not_archived_for_team_charge` / `_payment` | Resuelve vía finanzas |
| `__assert_season_not_archived_for_knockout_round` | Resuelve vía ronda KO |
| `__assert_season_not_archived_for_captain_invitation` | Resuelve vía invitación capitán |

### 7.2 RPCs parcheadas (38 + excepción especial)

**Fixture / calendario:** `create_season_round_robin_fixture`, `create_season_knockout_bracket`, `generate_knockout_from_groups`, `schedule_match`, `unschedule_match`, `confirm_match_calendar`, `apply_recurring_slot_to_season`, `set_season_field_blocks`, `set_season_groups`, `assign_teams_to_groups`, `__schedule_match_core`

**Reagendado:** `propose_match_reschedule`, `respond_match_reschedule`, `resolve_match_reschedule`

**Captura:** `record_match_event`, `update_match_result`, `void_match_event`

**Disciplina:** `waive_discipline_suspension`, `adjust_discipline_suspension_length`, `create_administrative_suspension`

**Finanzas:** `void_team_charge`, `void_team_payment` + triggers INSERT en `team_charges` / `team_payments`

**Roster:** `enroll_team_in_season`, `create_player_and_add_to_roster`, `add_player_to_season_team`, `set_season_team_player_status`, `deactivate_season_team_player`, `set_season_team_captain`, `set_season_team_vice_captain`, `set_roster_lock`

**Knockout:** `configure_knockout_round`, `set_knockout_tie_penalty_winner`, `advance_knockout_round`

**Capitán / pagos:** `invite_captain_to_roster`, `create_captain_player_with_invitation`, `accept_captain_invitation`, `set_player_payment_mark`

**Transferencia:** `release_player_transfer_lock`

**Excepción — `update_season_with_rules`:** bloquea edición mientras permanece archivada; **permite** archivar (`→ archived`) y reactivar (`archived → draft/private/unlisted/public`).

**Sin candado (fuera de alcance / no escritura de temporada):** `request_player_verification`, `review_player_verification` (acciones a nivel `players`, no mutan datos de temporada).

**Escrituras directas a tablas (sin RPC):** triggers en `season_roles`, `match_officials` + finanzas INSERT.

### 7.3 Tests SQL

`supabase/tests/028_season_archived_write_guard.sql` — rechazo en fixture archivado, no-regresión en activa, lectura OK, reactivación OK, bloqueo de edición archivada.

### 7.4 Commits

*(Completar tras commit)*

---

## 4. Estado backend

Candado RPC implementado en Migration 028 — ver §7.

---

## 2. Entregado

### 2.1 Acciones dedicadas (owner/admin)

- **`SeasonArchivePanel`** en la página de la temporada:
  - «Archivar temporada…» con confirmación y texto explicativo (datos conservados; deja de ser pública si lo era).
  - «Reactivar…» con selector de visibilidad (`draft` / `private` / `unlisted` / `public`, default `private`).
- Server actions: `archiveSeasonAction`, `reactivateSeasonAction` → `update_season_with_rules` (sin migración).
- **`SeasonForm`:** `archived` excluido del selector; nota para usar la acción dedicada.
- **`parseSeasonForm`:** rechaza `archived` en create/edit (evita bypass por formulario).

### 2.2 Listados operativos

- **`SeasonList`:** secciones «Temporadas activas» / «Temporadas archivadas».
- **`pickLatestActiveSeason`:** el listado de torneos usa la última temporada no archivada como `latestSeason`.

### 2.3 Solo lectura vs. escritura (frontend)

- **`SeasonArchivedBanner`** en layout de temporada archivada.
- **Redirect** desde `/editar` si archivada.
- **Bloqueo operativo** (`canManageActiveSeason`) en:
  - Calendario (generar fixture, captura admin)
  - Bracket admin
  - Disciplina admin / verificación
  - Equipos (inscribir, gestión)
  - Partidos (captura, programar, reagendar, oficiales, anular eventos)
  - Redirect en: `/grupos`, `/canchas`, `/fixture/generar`, `/equipos/inscribir`
- **Finanzas:** consulta histórica con `readOnly` (sin cargos, pagos ni anulaciones).
- **`SeasonStandingsNav`:** oculta Grupos/Canchas cuando archivada; mantiene Finanzas para consulta.

### 2.4 Lib y tests

- `src/lib/competitions/season-visibility.ts` — helpers compartidos.
- `src/lib/competitions/season-visibility.test.ts` — 4 tests.
- Glob de tests actualizado en `package.json`.

---

## 3. Conservación de datos

Archivar usa solo `visibility = 'archived'`. No hay DELETE ni desvinculación en cascada. Partidos, resultados, cargos, disciplina y demás datos históricos permanecen intactos (validado por diseño: misma RPC de update de reglas, sin RPCs destructivas).

---

## 4. Gap pendiente (backend)

Las RPCs de escritura (captura, fixture, disciplina, finanzas, reagendado, knockout, grupos, etc.) **no** validan hoy si la temporada está archivada. El frontend bloquea la gestión habitual, pero un cliente que llame RPCs directamente aún podría escribir. Recomendación futura: helper SQL `__assert_season_not_archived` + aplicación sistemática en mutaciones.

---

## 5. Verificación

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npm test` | ✅ (74 tests) |

---

## 6. Commit

`211b582` — feat(seasons): dedicated archive flow with read-only operational UI
