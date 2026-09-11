# Resumen de trabajo — 11 sep 2026 (ligapro)

Documento para revisión de Claude / handoff. Describe todo lo solicitado hoy y el estado de implementación en la rama de trabajo **sin commitear** (working tree).

---

## Contexto general

- **Stack:** Next.js 16 + Supabase
- **Estado:** cambios locales implementados; **171 tests pasan**; **`npm run build` exitoso**
- **No commiteado** al momento de este documento
- **Migración pendiente de aplicar en BD remota:** `supabase/migrations/20260829120000_guest_match_official_invites.sql`

---

## 1. Grilla de disponibilidad de canchas (org-wide)

**Pedido:** Vista de disponibilidad a nivel organización — filas = canchas, columnas = días × horas, bloqueos por torneo, solo lectura, con tests.

**Implementado:**

| Área | Archivos |
|------|----------|
| Lógica bloqueos org | `src/lib/season-fields/organization-blocks.ts` + test |
| Modelo grilla | `src/lib/venues/organization-availability-grid.ts` + test |
| Datos | `src/lib/venues/availability-grid-data.ts` |
| UI | `src/components/venues/OrganizationAvailabilityGrid.tsx` |
| Página | `src/app/(protected)/organizaciones/[organizationId]/canchas/disponibilidad/page.tsx` |
| Redirect legacy | `sedes/disponibilidad/page.tsx` → redirige a `/canchas/disponibilidad` |
| Query bloqueos | `getOrganizationSeasonFieldBlocks()` en `src/lib/season-fields/queries.ts` |

**Notas:** Fuente de bloqueos = `season_field_blocks` (misma que el editor en tab Canchas del torneo).

---

## 2. Finanzas — pagos parciales

**Pedido:** Pagos parciales con saldo, historial, resumen agregado del torneo (no solo marcar pagado binario).

**Implementado:**

| Área | Archivos |
|------|----------|
| Cálculo saldo | `src/lib/finance/balance.ts` — `computeTeamBalance`, `buildOverpaymentWarning`, `summarizeSeasonFinanceTotals` |
| Tests | `src/lib/finance/balance.test.ts` |
| Acción | `recordPaymentAction` en `src/lib/finance/actions.ts` (permite parciales + advertencia sobrepago); `markTeamPaidAction` queda como alias deprecated |
| Queries | `src/lib/finance/queries.ts` — join `profiles!recorded_by_profile_id(display_name)` → `recordedByName` |
| Types | `FinancePaymentRow.recordedByName` |
| UI | `src/components/finance/SeasonFinancePanel.tsx` — resumen torneo (cargos/cobrado/pendiente), saldo por equipo, formulario **Registrar pago**, historial con fecha/método/registrador |

**Notas:** No hubo migración nueva; `team_payments` ya existía. Vista `season_team_financial_summary` sigue siendo la fuente de `balance_due`.

---

## 3. Listado de canchas en tarjetas

**Pedido:** Reemplazar tabla por cards con nombre, superficie, badge Activa/Inactiva, conteo de bloqueos vigentes esta semana (o "Sin configurar" si no hay disponibilidad semanal). Click → detalle. Grid responsive 2–3 cols desktop / 1 mobile.

**Implementado:**

| Área | Archivos |
|------|----------|
| Datos + labels | `src/lib/venues/field-cards.ts`, `getOrganizationFieldCards()` en `queries.ts` |
| UI | `src/components/venues/FieldCard.tsx`, `FieldCardGrid.tsx` |
| Página | `src/app/(protected)/organizaciones/[organizationId]/sedes/page.tsx` (título "Canchas") |
| Nav | `nav-items.ts` — label **Canchas** (slug sigue `sedes`) |

**Comportamiento:**

- Badge estado: Activa / Inactiva
- Si `hasWeeklyAvailability === false` → badge **Sin configurar** (sin conteo de bloqueos)
- Si hay disponibilidad → `"X bloqueo(s) activo(s) esta semana"` (conteo simple, sin detalle)
- Canchas recién creadas sin bloqueos → conteo 0, no rompe
- Cards enlazan a `/sedes/[venueId]` (modelo venue→field legacy; **Prompt 3 canchas sin sedes no implementado**)

---

## 4. Disciplina — reestructuración

**Pedido:**

1. Eliminar sección "Verificación de identidad" (UI only; no borrar datos)
2. Dos tabs: **Sanciones activas** / **Nueva sanción administrativa**
3. Export solo en tab activas (arriba a la derecha)
4. Formulario solo en tab nueva (sin tabla debajo)
5. Tras crear sanción → redirect a tab activas
6. Correr tests de discipline

**Implementado:**

| Área | Cambio |
|------|--------|
| Página | `disciplina/page.tsx` — quitado `VerificationReviewPanel`; export y `DisciplineTable` solo en tab `activas` |
| Panel admin | `DisciplineAdminPanel.tsx` — tabs vía URL `?tab=activas\|nueva` |
| Acción | `createAdministrativeSuspensionAction` → `redirect(...?tab=activas)` |
| TODO legacy | Comentario en `disciplina/page.tsx` señalando `players.verification_status` y `player_verification_reviews` |

**Tests:** No hay suite dedicada `discipline/*.test.ts`; suite general pasa.

---

## 5. Calendario — selector de jornada roto

**Pedido:** Diagnosticar si `disabled` mal calculado o `onChange`/filtro no actualiza; corregir causa raíz; test de filtro por jornada; correr tests calendar/matches.

**Implementado:**

| Área | Archivos |
|------|----------|
| Helpers filtro | `src/lib/fixtures/calendar-filter.ts` — `parseSelectedRound`, `filterFixtureRoundsByJornada` |
| Test | `src/lib/fixtures/calendar-filter.test.ts` |
| Tabs jornada | `MatchdayTabs.tsx` — `router.push` → `<Link scroll={false}>` + prop `basePath` |
| Página | `calendario/page.tsx` — `export const dynamic = "force-dynamic"` + uso de helpers |

**Hipótesis del bug:** navegación client con `router.push` no refrescaba RSC; fix con `<Link>` + `force-dynamic`.

---

## 6. Equipos — filtro por torneo

**Pedido:** Mismo selector de torneo que Partidos/Calendario/Disciplina/Finanzas; filtrar equipos inscritos en season del torneo; default = torneo más reciente; preselección al entrar desde un torneo.

**Implementado:**

| Área | Archivos |
|------|----------|
| Opciones torneo | `src/lib/organizations/queries.ts` — `listOrganizationSeasonOptions()` |
| Default / resolve | `src/lib/organizations/season-picker.ts` — `pickDefaultOrganizationSeason`, `resolveOrganizationSeasonSelection`, `parseSeasonContextFromPathname`, `buildOrganizationEquiposHref` |
| Picker UI | `src/components/organizations/OrganizationSeasonPicker.tsx` |
| Página | `equipos/page.tsx` — query `?seasonId=&competitionId=`, `getSeasonTeams()` + `SeasonTeamList` |
| Redirect default | Si no hay query params → redirect al torneo default |
| Nav contextual | `Sidebar`, `MobileNavigation`, `MobileMoreDrawer` — link Equipos lleva query params cuando la URL está dentro de `/torneos/.../temporadas/...` |

---

## 7. Árbitro invitado por link (sin cuenta)

**Pedido:** Segundo camino paralelo al árbitro autenticado — link de un solo uso por partido, sin login, mismos permisos que referee confirmado (captura + cerrar finished/walkover, nunca cancelled), validación server-side en cada request, invalidar token al cerrar, botón en MatchOfficialsManager, tests.

**Implementado:**

### Migración (`20260829120000_guest_match_official_invites.sql`)

- `match_officials`: `invite_token`, `invite_expires_at`, `guest_name`; `profile_id` nullable si hay token
- Constraints: `profile_id OR invite_token`; unique parcial en token
- RPCs SECURITY DEFINER (grant anon + authenticated):
  - `__fetch_valid_guest_official` (interno)
  - `get_guest_official_invite`
  - `set_guest_official_name`
  - `get_guest_match_snapshot`, `get_guest_match_roster`, `get_guest_match_timeline`
  - `guest_record_match_event`
  - `guest_update_match_result` — cierra partido, guarda `guest_name` vía `set_match_context`, invalida token (`invite_expires_at = now()`)

### App

| Área | Archivos |
|------|----------|
| Validación / permisos TS | `src/lib/matches/guest-official.ts` |
| Tests | `src/lib/matches/guest-official.test.ts` |
| Queries públicas | `src/lib/matches/guest-queries.ts` |
| Server actions guest | `src/lib/matches/guest-actions.ts` |
| Invitar (admin) | `createGuestOfficialInviteAction` en `actions.ts` |
| Ruta pública | `src/app/invitacion-arbitral/[token]/page.tsx` |
| Nombre guest | `GuestOfficialNameForm.tsx` |
| UI admin | `MatchOfficialsManager.tsx` — botón "Invitar por link (sin cuenta)" + `InviteLinkResult` |
| Forms captura | `MatchScoreForm`, `MatchEventForm` — prop opcional `guestInviteToken` |
| Oficiales list | `getMatchOfficials` — soporta filas guest (`isGuestInvite`, `guestInviteActive`) |
| Types | `database.ts` — columnas guest + firmas RPC |

**Expiración invite:** `min(7 días, fecha partido + 1 día)`.

**Camino autenticado:** sin cambios en `getUserMatchCapturePermissions`, `updateMatchResultAction`, RPC `update_match_result`.

---

## 8. Lo que NO se pidió / NO se hizo hoy

| Item | Estado |
|------|--------|
| **Prompt 3 — canchas sin sedes** (migración `address` en fields, `venue_id` nullable, etc.) | **No iniciado** |
| Commit / push | **No hecho** (pendiente solicitud explícita) |
| Aplicar migración guest en Supabase remoto | **Pendiente** (`supabase db push` o equivalente) |

---

## Archivos nuevos (untracked)

```
src/app/(protected)/organizaciones/[organizationId]/canchas/disponibilidad/page.tsx
src/app/invitacion-arbitral/[token]/page.tsx
src/components/matches/GuestOfficialNameForm.tsx
src/components/organizations/OrganizationSeasonPicker.tsx
src/components/venues/FieldCard.tsx
src/components/venues/FieldCardGrid.tsx
src/components/venues/OrganizationAvailabilityGrid.tsx
src/lib/finance/balance.ts
src/lib/finance/balance.test.ts
src/lib/fixtures/calendar-filter.ts
src/lib/fixtures/calendar-filter.test.ts
src/lib/matches/guest-actions.ts
src/lib/matches/guest-official.ts
src/lib/matches/guest-official.test.ts
src/lib/matches/guest-queries.ts
src/lib/organizations/queries.ts
src/lib/organizations/season-picker.ts
src/lib/season-fields/organization-blocks.ts
src/lib/season-fields/organization-blocks.test.ts
src/lib/venues/availability-grid-data.ts
src/lib/venues/field-cards.ts
src/lib/venues/organization-availability-grid.ts
src/lib/venues/organization-availability-grid.test.ts
supabase/migrations/20260829120000_guest_match_official_invites.sql
```

---

## Verificación ejecutada

```bash
npm test   # 171 tests, 0 fallos
npm run build   # OK (TypeScript + static generation)
```

**Script de test actualizado** en `package.json` para incluir:
`finance/**`, `venues/**`, `season-fields/**` (además de los paths existentes).

---

## Checklist de revisión manual sugerida

- [ ] Aplicar migración guest en Supabase y smoke-test `/invitacion-arbitral/[token]`
- [ ] Grilla disponibilidad `/canchas/disponibilidad` con org que tenga canchas + bloqueos
- [ ] Cards en `/sedes` — cancha sin disponibilidad semanal muestra "Sin configurar"
- [ ] Disciplina tabs + redirect post-creación
- [ ] Calendario — seleccionar jornada filtra partidos; "Todas" restaura vista
- [ ] Equipos — picker torneo, default, nav desde torneo preselecciona
- [ ] Finanzas — registrar pago parcial, ver historial y resumen agregado
- [ ] MatchOfficialsManager — generar link guest, capturar y cerrar partido; link expirado rechazado
- [ ] Confirmar camino árbitro con cuenta sigue igual

---

## Riesgos / deuda conocida

1. **Guest capture:** roster/timeline/disciplina en página pública usan RPCs SECURITY DEFINER; disciplina en guest page va vacía (no requerido en prompt).
2. **Field cards** siguen modelo venue→field; detalle en `/sedes/[venueId]`, no ruta cancha-first.
3. **Types `database.ts`** actualizados manualmente para guest; regenerar con Supabase CLI tras aplicar migración.
4. **Verificación identidad:** UI removida; datos y RPCs (`request_player_verification`, `review_player_verification`, tablas) intactos.

---

*Generado para handoff — ligapro, 2026-09-11*
