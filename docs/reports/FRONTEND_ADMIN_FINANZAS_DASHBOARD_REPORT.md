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

## Seguridad UI — confirmación explícita (2026-07-26)

Los paneles admin **no se renderizan** para `organization_member` ni para capitán/vicecapitán. Las server actions siguen con `requireOrganizationAdmin` como segunda línea.

| Superficie | Gate de página / render | Member | Capitán/vice* | Owner/admin |
| --- | --- | --- | --- | --- |
| `/finanzas` | `requireOrganizationAdmin` → 404 | 404 | 404 | ✓ panel completo |
| Link Finanzas en nav | `SeasonStandingsNav` solo si `canManage` | oculto | N/A† | visible |
| `DisciplineAdminPanel` | `{canManage && <...>}` en disciplina | oculto | N/A† | visible |
| `MatchRescheduleAdminPanel` | `{canManage && <...>}` en partido | oculto | N/A† | visible |
| Link Programar/Reprogramar | `{canManage && ...}` en partido | oculto | N/A† | visible |
| `MatchOfficialsManager` forms | prop `canManage={false}` | solo lectura | N/A† | gestión |

\* **Capitán/vice hoy:** no son `organization_members`; el layout `(protected)/organizaciones/[organizationId]` exige membresía → **404 antes de cualquier página**, incluido `.../partidos/[matchId]`. El portal del capitán (siguiente prompt) debe reutilizar `isOrganizationAdminRole` / no montar estos paneles.

† Sin acceso al shell de org en el frontend actual.

**Ruta compartida `.../partidos/[matchId]`:** el panel de reagendado y el link de programación están detrás de `canManage = isOrganizationAdminRole(membership.role)`. Un member ve timeline/disciplina del partido; no ve formularios admin. La query `getMatchRescheduleRequest` solo corre si `canManage`.

**Tests automatizados:** `src/lib/auth/admin-ui-access.test.ts` — matriz de visibilidad para member vs admin vs sin membresía (proxy capitán). Ejecutar con `npm test`.

**Prueba manual pendiente (cuando exista portal capitán):** iniciar sesión como capitán vinculado, abrir detalle de partido propio, confirmar ausencia de textos «Calendario y reagendado», «Confirmar reagendado», «Confirmar calendario», formularios de finanzas/disciplina admin.

## Verificación

- `npm run lint` ✓
- `npm run build` ✓
- `npm test` ✓ (fixtures + admin-ui-access)

## Fuera de alcance (confirmado)

Portal capitán/vice, wa.me, push, cambios de schema, `schedule_match` / slot recurrente.
