# Frontend admin — Finanzas, Dashboard, reagendado, disciplina, vicecapitán

**Alcance:** solo frontend sobre RPCs/tablas existentes (Migrations 009, 018, 019, 020). Sin migraciones nuevas.

## Rutas nuevas / extendidas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `.../temporadas/[seasonId]/finanzas` | owner/admin (`requireOrganizationAdmin`) | Ledger oficial: cargos, pagos, void |
| `.../temporadas/[seasonId]/dashboard` | miembros org (lectura) | Posiciones + goleo + disciplina en una vista |
| `.../temporadas/[seasonId]/disciplina` | miembros + panel admin | Extendida con ajustes de sanción |
| `.../partidos/[matchId]` | admin: panel reagendado | Resolución + confirmación calendario |
| Roster equipo | admin | Designar vicecapitán |

## 1. Finanzas (admin)

- **Queries:** `src/lib/finance/queries.ts` — `getSeasonFinanceOverview` vía `season_team_financial_summary` + detalle `team_charges`/`team_payments` activos.
- **Actions:** `addTeamChargesAction`, `markTeamPaidAction`, `voidTeamChargeAction`, `voidTeamPaymentAction`.
- **UI:** `SeasonFinancePanel` — estado derivado `pagado` / `pendiente` / `sin_cargos`; cargo multi-equipo; marcar pagado por saldo; void con motivo.
- **No** muestra `season_team_player_payment_marks`.

## 2. Dashboard de liga

- **Página:** `dashboard/page.tsx` — RPCs `get_season_standings`, `get_season_top_scorers`, `get_season_discipline_summary`.
- Solo lectura; accesible a `organization_member`.

## 3. Resolución de reagendado (admin)

- **Query:** `getMatchRescheduleRequest` — request abierto (`proposed` \| `approved_by_opponent`).
- **Actions:** `resolveMatchRescheduleAction`, `confirmMatchCalendarAction`.
- **UI:** `MatchRescheduleAdminPanel` en detalle de partido.
  - `proposed`: informativo (sin acción admin).
  - `approved_by_opponent`: confirm / no_availability (+ notas opcionales).
  - Partido programado + `calendar_status = programado`: `confirm_match_calendar`.

## 4. Ajuste de disciplina (admin)

- **Queries:** `getActiveDisciplineSuspensions`, `getSeasonRosterPlayerOptions`.
- **Actions:** `waiveDisciplineSuspensionAction`, `adjustDisciplineSuspensionAction`, `createAdministrativeSuspensionAction` — motivo obligatorio en UI y RPC.
- **UI:** `DisciplineAdminPanel` sobre tabla resumen existente.

## 5. Vicecapitán

- **Action:** `setViceCaptainAction` → RPC `set_season_team_vice_captain`.
- **UI:** `RosterPlayerCard` + `ViceCaptainBadge`; mismo patrón que capitán.

## Navegación

`SeasonStandingsNav` ampliado: **Dashboard** (todos), **Finanzas** (solo `canManage`).

## Verificación

- `npm run lint` ✓
- `npm run build` ✓
- `npm test` ✓ (16/16)

## Fuera de alcance (confirmado)

Portal capitán/vice, wa.me, push, cambios de schema, `schedule_match` / slot recurrente.
