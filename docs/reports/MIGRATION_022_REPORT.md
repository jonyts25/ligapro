# Migration 022 — Scorekeeper, ventana de captura, anulación de eventos

**Archivo:** `supabase/migrations/20260717000000_scorekeeper_capture_window_void_events.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0008-cedula-arbitral-ventana-y-correccion.md`

## Objetivos

1. Rol `scorekeeper` habilitado para captura (season_roles + match_officials confirmado)
2. Ventana de tiempo de captura (`America/Mexico_City`) con bypass owner/admin/tournament_admin
3. Anulación de eventos vía `void_match_event` (sin UPDATE de contenido)

## 1. Scorekeeper

| Cambio | Detalle |
| --- | --- |
| `season_roles_role_check` | Incluye `scorekeeper` |
| `can_capture_match` | Mismo criterio que referee/delegate + `match_officials.role = 'scorekeeper'` confirmado |
| RLS INSERT | Policy `match_events_insert_confirmed_official` extendida a scorekeeper |

## 2. Ventana de captura

| Función | Rol |
| --- | --- |
| `__match_capture_window_open(p_match_id)` | true si `now()` ∈ [reserva confirmada `starts_at`, 09:00 día siguiente MX) |
| `__match_capture_window_bypass(p_match_id)` | true para owner/admin o `tournament_admin` |
| `__assert_match_capture_window(p_match_id)` | Lanza «La ventana de captura para este partido ya cerró» |

Aplicada en:

- Trigger `match_events_enforce_capture_rules` (vía `__assert_match_capture_window`)
- RPC `record_match_event`
- RPC `update_match_result` (bypass efectivo: solo roles autorizados ya tienen bypass)

Sin reserva confirmada: `false` para roles de campo; admin/tournament_admin bypass.

## 3. Anulación de eventos

Columnas en `match_events`:

- `voided_at timestamptz`
- `voided_by_profile_id uuid` → `profiles`
- `void_reason text`
- CHECK todo-o-nada (patrón `team_charges`)

RPC `void_match_event(p_event_id, p_reason)`:

- Solo owner/admin; motivo obligatorio no vacío
- Trigger `match_events_prevent_mutation` + flag `app.match_event_void`
- **Idempotencia:** segunda llamada falla con «already voided»
- **No** revierte `discipline_suspensions` automáticamente

Read models actualizados (`voided_at IS NULL`):

- `get_season_top_scorers`
- `get_season_discipline_summary`
- `get_public_season_scorers`

Trigger `match_events_generate_discipline_suspensions` **sin cambios** — corre en INSERT; anulación es posterior.

## Pruebas

`supabase/tests/022_scorekeeper_capture_window_void.sql` — **15/15 PASS**

Parche compatibilidad: `017_match_capture_frontend.sql` — reserva confirmada en `match_open` para ventana (25/25 PASS).

## Tipos TS

`src/types/database.ts` regenerado.

## Docs actualizados

- `docs/MATCH_OPERATION_AND_CAPTURE.md`
- `docs/FIXTURE_AND_SCHEDULING.md`
- `docs/STANDINGS_AND_PUBLIC_PAGES.md`
- `docs/DOMAIN_MODEL.md`

## Fuera de alcance (confirmado)

Asistencias, modalidad de juego, selector `format_type`, edición de contenido de eventos, reversión automática de disciplina al anular.
