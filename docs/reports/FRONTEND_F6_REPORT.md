# Frontend F6 — Fixture, jornadas y programación

**Fecha:** 2026-07-13  
**Base:** Migration 015 (`95c23ae`)  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Check | Resultado |
| --- | --- |
| Working tree limpio al inicio | Sí |
| Commit Migration 015 | Presente en `main` |
| Migrations 001–015 sync | Sí; 016 añadida y pushed |
| Schema matches / reservations leído | Completo (006a / 005) |
| Mundial Compas | No tocado |

### Schema real (pre-016)

`matches`: home/away `season_team`, `status`, scores, `round_label`, `field_reservation_id`, timestamps. **Sin** `round_number` / `leg_number` / `sequence_in_round` / `scheduled_at` / `field_id` directo.

`field_reservations`: tipos + status confirmed/cancelled + exclusion anti-solape + FK match.

Equipos elegibles: `season_teams.registration_status` ∈ `registered` \| `confirmed`.

---

## 2. Decisión Migration 016

**Sí — necesaria** para columnas de jornada/vuelta/secuencia + RPCs atómicas de fixture y programación.

**Archivo:** `supabase/migrations/20260714001500_fixture_and_match_scheduling.sql`  
**Push:** aplicado · local = remote (`20260714001500`)

### Columnas

`matches.round_number`, `leg_number`, `sequence_in_round` (nullable + CHECKs).

### RPCs

| Función | Rol |
| --- | --- |
| `create_season_round_robin_fixture` | Fixture atómico |
| `schedule_match` | Programar / reprogramar + reservation |
| `unschedule_match` | Dejar pendiente |

---

## 3. Motor + unit tests

- `src/lib/fixtures/round-robin.ts`
- `npm test` → **16/16 PASS**
- Dependencia: `tsx` (dev)

---

## 4–5. Persistencia / programación

- Validación matemática en RPC (no solo motor cliente).
- No regeneración si ya hay matches.
- `ends_at` server-side; TZ `America/Mexico_City`.
- Disponibilidad semanal obligatoria; sin reglas ⇒ rechazo.
- Reserva única confirmed por match; exclusion constraint para choques.

---

## 6–7. Archivos

### Creados (principales)

```
supabase/migrations/20260714001500_fixture_and_match_scheduling.sql
supabase/tests/016_fixture_and_scheduling.sql
docs/FIXTURE_AND_SCHEDULING.md
docs/reports/FRONTEND_F6_REPORT.md
src/lib/fixtures/*
src/components/fixtures/*
.../fixture/generar, calendario, partidos/[matchId], programar
.../organizaciones/[id]/calendario, partidos
```

### Modificados

Readiness, nav, dashboard, competitions types/queries, domain docs, `database.ts`, `package.json`.

---

## 8. Rutas / actions / helpers

**Actions:** `createSeasonFixtureAction`, `scheduleMatchAction`, `unscheduleMatchAction`  
**Helpers:** `getSeasonFixtureContext`, `getSeasonMatchesGroupedByRound`, `getMatchSchedulingDetails`, `getActiveVenuesAndFields`, `getFieldAvailabilityForDate`, `getSeasonFixtureStats`, `getOrganizationMatchStats`

---

## 9. Matriz de permisos

| Acción | owner/admin | member | tournament_admin | anon |
| --- | --- | --- | --- | --- |
| Generar fixture | sí | no | no | no |
| Ver calendario | sí | sí | sí* | no |
| Programar / unschedule | sí | no | no | no |

\*si es miembro org.

---

## 10. Pruebas SQL

| Suite | Resultado |
| --- | --- |
| **016** | **40/40 PASS** |
| **015** | **34/34 PASS** |
| **010** | PASS (filas passed en output) |
| **005** | Falló cleanup por FK `audit_log` residual (ambiente; no regresión de F6) |
| **006a** | Mismo patrón FK audit en cleanup |

db lint: warnings menores unused vars en RPC (`v_a`/`v_b`/`v_res`) — no bloqueantes.

---

## 11. Frontend

| Check | Resultado |
| --- | --- |
| npm lint | PASS |
| npm build | PASS |
| npm test | 16/16 PASS |
| Pruebas manuales UI W (1–28) | **No verificadas** en esta sesión (faltan smoke browser) |

---

## 12. Riesgos / desviaciones

- Tests 005/006a: cleanup histórico vs `audit_log` FK puede fallar en DB compartida.
- Nav global Calendario/Partidos es hub por temporada (no calendario multi-season).
- `create_season_with_rules` tipos gen regeneraron fechas como `string`; se ajustaron a `string \| null` en `database.ts`.
- Pruebas frontend reales W pendientes de ejecución manual.

---

## 13. Confirmaciones

- Sin service role en app.
- Sin captura de resultados / playoffs / Mundial Compas.
- **Sin commit** (detención para revisión).
