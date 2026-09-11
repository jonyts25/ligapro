# Auditoría de trabajo — 2026-09-11

Auditoría contra criterios de aceptación del trabajo implementado en `main` (commit `63311f4` y anteriores de la misma sesión). Basada en revisión del código fuente, no en memoria de la sesión ni solo en el handoff.

---

## Tabla resumen

| # | Pieza | Estado | Nota |
|---|--------|--------|------|
| 1 | Torneo único (season oculta + formato/duración) | **Completo con gap** | Lock simétrico OK; quedan URLs `/temporadas/`, copy “temporada” y pickers org-wide |
| 2 | Importar plantel entre torneos | **Completo** | Warn-only por `max_roster_size`; origen intacto |
| 3 | Canchas sin sedes | **Completo con gap** | Código y rutas OK; docs obsoletos, componentes huérfanos, sin tests, migración remota pendiente |
| 4 | Grilla disponibilidad org-wide | **Completo** | Solo lectura; canchas sin reglas semanales → celdas `unconfigured` |
| 5 | Pagos parciales | **Completo con gap** | Sobrepago permitido; advertencia post-guardado en verde; `totalCredit` no se muestra |
| 6 | Cards de cancha | **Completo con gap** | “Sin configurar” OK; contador de bloqueos no filtra por semana pese al copy |
| 7 | Disciplina sin verificación | **Completo** | UI de verificación fuera de Disciplina; redirect a `?tab=activas`; datos/RPCs intactos |
| 8 | Fix selector de jornada | **Completo con gap** | Fix funcional con `<Link>` + `force-dynamic`; causa raíz solo en handoff, tab dice “Todas” |
| 9 | Filtro de equipos por torneo | **Completo con gap** | Default + nav desde torneo OK; wizard y query params parciales sin corregir |
| 10 | Árbitro invitado por link | **Completo con gap** | Flujo autenticado intacto; invalidación de token solo si cierra el invitado; sin prueba RPC real |

---

## Detalle por pieza

### 1. Torneo único

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Formato bloqueado igual que duración tras fixture o partidos programados? | **Sí.** `isSeasonMatchDurationLocked` delega a `isSeasonFormatLocked` (`src/lib/competitions/season-edit-guards.ts`). Ambos flags se aplican en UI (`SeasonForm` → `CompetitionSetupFields`) y en servidor (`updateSeasonAction` preserva `formatType` y `matchDurationMinutes` cuando corresponde). Lock dispara con `fixtureGenerated` (cualquier partido) **o** `scheduledMatches > 0` (reserva confirmada). |
| ¿Quedó texto visible “temporada” en vez de “torneo”? | **Sí, en varios sitios.** Ejemplos verificados: `torneos/nuevo/page.tsx` L20 (“configurarás temporadas”), `equipos/[seasonTeamId]/page.tsx` L85 (“Equipos de la temporada”), `oficiales/page.tsx` L49 (“Oficiales de temporada”), `canchas/page.tsx` (season scope) L51, `SeasonArchivePanel`, `SeasonDeletePanel`, mensajes en `competitions/actions.ts`. El detalle del torneo ya usa `competitionName` como título y “Configuración del torneo” en el formulario. |

**Qué falta (gap)**

- No existe flag de “season oculta”; la season es un registro normal en draft. URLs siguen en `/temporadas/{seasonId}`.
- El selector de season no desapareció del todo: hubs org (`calendario`, `disciplina`, `finanzas`) piden “Elige una temporada”; `equipos/page.tsx` tiene picker de torneo/season.
- `createSeasonAction` sigue en código (sin ruta activa); `SeasonList.tsx` es código muerto.
- **Bug menor de lock:** `groupsAdvancePerGroup` se deshabilita en UI cuando hay lock, pero `updateSeasonAction` no lo preserva en servidor — un POST manipulado podría cambiarlo (`actions.ts` L533–537 vs L500–506).

---

### 2. Importar plantel entre torneos

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Respeta `max_roster_size` con advertencia, no bloqueo? | **Sí.** `buildRosterImportOverCapacityWarning` solo genera string; `importRosterToSeasonTeam` inserta todos los jugadores activos posibles (`src/lib/teams/import-roster.ts`). Admin no está sujeto al cap en RPC (`add_player_to_season_team`). Advertencia en UI previa (`RosterImportSection`) y post-inscripción vía query param. |
| ¿Roster de origen intacto? | **Sí.** Solo SELECT sobre `season_team_players` del origen; inserts van al destino. Test en `roster-import.test.ts`. |

**Gap:** Ninguno funcional relevante. Preview de over-capacity usa conteo total de activos; post-import usa `importedCount` — puede diferir si hay skips por conflicto.

---

### 3. Canchas sin sedes

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| Canchas directas bajo org, sin sede intermedia | **Sí en código.** `createFieldAction` inserta `venue_id: null` (`src/lib/venues/actions.ts`). Rutas `/canchas/*` operativas. Migración `20260829130000_fields_direct_organization.sql` en repo. |
| Tabla `venues` conservada | **Sí.** No eliminada; redirects legacy en `/sedes/*`. |

**Confirmación de los 4 gaps reportados**

| # | Gap | Confirmado |
|---|-----|------------|
| 1 | `docs/VENUES_AND_FIELDS.md` describe modelo viejo | **Sí.** L11: “No se crean fields sin venue”; regla F6 exige `venue.is_active`; rutas solo `/sedes/*`. |
| 2 | `docs/resumen-trabajo-2026-09-11.md` dice Prompt 3 “No iniciado” | **Sí.** L74 y L180 contradice commit `63311f4`. |
| 3 | `VenueCard`, `VenueList`, `VenueForm` huérfanos | **Sí.** Cero imports desde páginas. También huérfanos: `FieldList.tsx`, `FieldAvailabilityOverviewClient.tsx`, `VerificationReviewPanel.tsx`, `SeasonList.tsx` (competitions). |
| 4 | Sin tests de `venue_id` null / detalle sin sede | **Sí.** En `src/lib/venues/` solo existe `organization-availability-grid.test.ts`. |

**Gaps adicionales**

- Migración **no verificada aplicada** en Supabase remoto (MCP no configurado con `project_id` en esta sesión).
- `getOrganizationFieldCards` cuenta **todos** los `season_field_blocks` del field, no “esta semana” (ver pieza 6).
- `countActiveVenues` en billing sigue consultando tabla `venues` para métrica `sedes`.
- Legacy `sedes/[venueId]/editar` redirige a `sedes/[venueId]` (no a cancha concreta); funciona porque `[venueId]/page.tsx` resuelve la primera cancha del venue.

---

### 4. Grilla disponibilidad org-wide

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Solo lectura? | **Sí.** Página declara “Solo lectura”; sin acciones de guardado. Click en celda bloqueada abre popover informativo (`OrganizationAvailabilityGrid.tsx`). |
| ¿Cancha sin disponibilidad semanal? | **Sí.** `hasWeeklyAvailability: false` → todas las celdas `unconfigured`, fila etiquetada “Sin configurar”. Test en `organization-availability-grid.test.ts`. Si ninguna cancha tiene reglas, rango horario default 08:00–22:00. |

**Gap:** Ninguno funcional.

---

### 5. Pagos parciales

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Pago que excede saldo se permite con advertencia? | **Sí, no se rechaza.** `recordPaymentAction` inserta siempre; `buildOverpaymentWarning` devuelve mensaje si aplica (`src/lib/finance/actions.ts`, `balance.ts`). |
| ¿Resumen distingue cobrado vs pendiente? | **Sí.** `SeasonFinanceSummary` muestra Total cargos / Total cobrado / Total pendiente (`SeasonFinancePanel.tsx` L412–426). |

**Gaps**

- Advertencia de sobrepago llega **después** del submit, con estilo de éxito (verde), no como confirmación previa ni warning visual.
- `summarizeSeasonFinanceTotals` calcula `totalCredit` pero **no se renderiza** en la UI de resumen.
- Sin preview client-side en `RecordPaymentForm`.

---

### 6. Cards de cancha

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Badge “Sin configurar” sin disponibilidad semanal? | **Sí.** `fieldCardStatusLabel` en `field-cards.ts` L12–13 cuando `!hasWeeklyAvailability`. |
| ¿No rompe con canchas nuevas sin bloqueos? | **Sí.** Cancha nueva sin reglas → “Sin configurar”. Con reglas y 0 bloqueos → “0 bloqueos activos esta semana”. |

**Gap**

- El copy dice “esta semana” pero `getOrganizationFieldCards` (`queries.ts` L77–80) cuenta **todos** los bloqueos históricos del field sin filtro temporal. Etiqueta engañosa si hay bloqueos de otras temporadas/días.

---

### 7. Disciplina sin verificación

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿“Verificación de identidad” fuera de UI sin borrar datos/RPCs? | **Sí.** `disciplina/page.tsx` no importa `VerificationReviewPanel`; TODO L29–30 documenta legacy. Tablas/RPCs en migraciones y `database.ts` intactos. Panel huérfano en `components/verification/`. Verificación sigue en roster/captura (diseño intencional). |
| ¿Crear sanción redirige a activas? | **Sí.** `createAdministrativeSuspensionAction` → `redirect(...?tab=activas)` (`discipline/actions.ts` L202–204). Tabs `activas`/`nueva` en `DisciplineAdminPanel`. |

**Gap:** Sin suite TS de disciplina (tabs/redirect); solo tests SQL genéricos en `supabase/tests/`.

---

### 8. Fix selector de jornada

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Causa raíz documentada? | **Parcialmente.** Documentada en `docs/resumen-trabajo-2026-09-11.md` §5: hipótesis `router.push` vs RSC; fix `<Link scroll={false}>` + `force-dynamic`. **No** hay comentario en código fuente (`MatchdayTabs.tsx`, `calendario/page.tsx`). |
| ¿“Todas las jornadas” restaura vista completa? | **Sí funcionalmente.** Tab “Todas” omite query `jornada` → `parseSelectedRound` → `"all"` → `filterFixtureRoundsByJornada` devuelve todos los rounds. Test en `calendar-filter.test.ts`. Label UI es **“Todas”**, no “Todas las jornadas”. |

**Gap:** Documentación de causa raíz solo en handoff; etiqueta de tab abreviada.

---

### 9. Filtro de equipos por torneo

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Default torneo más reciente sin query params? | **Sí.** `pickDefaultOrganizationSeason` ordena por `startsOn ?? createdAt` desc; redirect canónico en `equipos/page.tsx` L38–46. |
| ¿Nav desde torneo preselecciona? | **Sí** cuando pathname coincide `/torneos/{compId}/temporadas/{seasonId}/...` → `buildOrganizationEquiposHref` en nav (`nav-items.ts`, `season-picker.ts`). |

**Gaps**

- Rutas del wizard (`/torneos/asistente/{compId}/{seasonId}/...`) **no** parsean contexto → Equipos no preselecciona.
- Query params parciales/inválidos caen al default **sin** redirect correctivo (solo redirect cuando ambos params ausentes).
- Existe página separada `.../temporadas/[seasonId]/equipos` sin filtro org-level; algunos links van ahí en vez de `/equipos?...`.
- Sin tests unitarios de `season-picker.ts`.

---

### 10. Árbitro invitado por link

**Preguntas de aceptación**

| Pregunta | Respuesta |
|----------|-----------|
| ¿Camino autenticado sin regresión? | **Sí verificado en código.** `/captura/page.tsx` sin referencias guest; permisos vía `getUserMatchCapturePermissions` y RPCs existentes. Guest es ruta paralela `/invitacion-arbitral/[token]`. Formularios eligen action según token (`MatchScoreForm`, `MatchEventForm`). Tests de paridad en `guest-official.test.ts`. |
| ¿Token invalidado tras cerrar partido? | **Parcial — solo cierre por invitado.** `guest_update_match_result` hace `invite_expires_at = now()` (`20260829120000_guest_match_official_invites.sql` L353–357). Validación en `__fetch_valid_guest_official` rechaza `invite_expires_at <= now()`. **No** se invalida si cierra un árbitro autenticado o admin vía `update_match_result`. Link puede seguir siendo legible (snapshot) hasta expiry natural aunque captura esté deshabilitada en UI. |

**Prueba real**

- **No ejecutada en esta auditoría.** Requiere Supabase con migración `20260829120000` aplicada y llamada RPC post-close. Tests unitarios cubren permisos TS y cálculo de expiry, **no** el UPDATE en DB.
- Estado remoto de migraciones: **no verificado** (sin `project_id` en MCP).

---

## Bugs encontrados hoy que no vienen de un prompt anterior

| Bug / deuda | Severidad | Ubicación |
|-------------|-----------|-----------|
| Componentes huérfanos acumulados (`Venue*`, `FieldList`, `FieldAvailabilityOverviewClient`, `VerificationReviewPanel`, `SeasonList`) | Baja (mantenimiento) | `src/components/venues/`, `verification/`, `competitions/` |
| Copy “bloqueos activos esta semana” cuenta todos los bloqueos | Media (UX engañosa) | `src/lib/venues/queries.ts` + `field-cards.ts` |
| `groupsAdvancePerGroup` editable vía POST cuando format está locked | Baja (seguridad menor) | `src/lib/competitions/actions.ts` |
| Documentación de dominio desactualizada | Media | `docs/VENUES_AND_FIELDS.md`, `docs/resumen-trabajo-2026-09-11.md` |
| Migraciones SQL nuevas posiblemente sin aplicar en remoto | **Alta (prod)** | `20260829120000_guest_match_official_invites.sql`, `20260829130000_fields_direct_organization.sql` |
| Token guest no expira al cerrar partido por admin/referee autenticado | Media (seguridad/UX) | SQL guest migration |
| Redirect legacy `sedes/[venueId]/editar` → `sedes/[venueId]` (extra hop) | Muy baja | `sedes/[venueId]/editar/page.tsx` |
| Métrica billing `sedes` sigue contando tabla `venues` separada de canchas | Baja | `tier-limits-queries.ts` |

No se encontraron imports rotos ni fallos de TypeScript en el árbol actual (build pasa).

---

## Resultado real de `npm test` y `npm run build`

Ejecutados el **2026-09-11** sobre commit `63311f4` (post-push):

### `npm test`

```
ℹ tests 171
ℹ suites 75
ℹ pass 171
ℹ fail 0
ℹ duration_ms ~694
```

### `npm run build`

```
✓ Compiled successfully
✓ TypeScript check passed
✓ Static pages generated (23/23)
Exit code: 0
```

Advertencia conocida de Next.js: edge runtime deshabilita SSG en alguna ruta (sin impacto en esta auditoría).

---

## Qué haría falta para llamar esto listo para producción

Opinión honesta, no optimista:

1. **Aplicar migraciones en Supabase remoto** y smoke-test manual: crear cancha sin sede, programar partido, invitar árbitro guest, cerrar partido y verificar token invalidado.
2. **Actualizar documentación de dominio** (`VENUES_AND_FIELDS.md`) y archivar o corregir el handoff viejo; evitar que el próximo agente/humano siga el modelo venue→field.
3. **Cerrar gaps de producto “torneo único”** si el criterio era eliminar la noción de temporada del usuario: unificar copy, reducir pickers org-wide, decidir qué hacer con multi-season (hoy solo hay warning en código).
4. **Eliminar o marcar explícitamente código muerto** (Venue*, panels huérfanos) para reducir confusión y superficie de mantenimiento.
5. **Tests de integración faltantes:** guest token invalidation (SQL), canchas `venue_id: null`, season-picker defaults — el suite TS actual no cubre las piezas más riesgosas de hoy.
6. **Ajustes UX menores antes de prod:** advertencia de sobrepago en finanzas (pre-submit + estilo warning), contador real de bloqueos por semana en cards, invalidar guest token también cuando cierra un admin/referee autenticado.
7. **Checklist de regresión manual** en staging: flujo árbitro autenticado completo, import plantel over-capacity, calendario jornada “Todas”, disciplina tabs + export.

**Veredicto:** El código compila, los tests existentes pasan, y la funcionalidad core de las 10 piezas está **mayormente operativa**. No lo consideraría “production-ready” hasta aplicar migraciones en remoto, corregir docs, y cerrar al menos los gaps de seguridad/UX del guest token y la migración de canchas. El resto (copy, huérfanos, tests) es deuda tolerable a corto plazo pero debería entrar en el mismo sprint de hardening, no posponerse indefinidamente.

---

## Cierre post-auditoría (2026-09-11, commits posteriores a `63311f4`)

| Gap / ítem | Estado | Commit / nota |
|------------|--------|---------------|
| Hub Equipos/Partidos/Calendario/Finanzas pide “crear temporada” | **Cerrado** | `9fac0db` — auto-redirect al torneo default; causa raíz: hubs legacy con lista picker, no filtro de visibility |
| `docs/VENUES_AND_FIELDS.md` modelo viejo | **Cerrado** | docs actualizados a canchas directas |
| Componentes huérfanos (`Venue*`, `FieldList`, etc.) | **Cerrado** | archivos eliminados |
| Tests `venue_id` null / detalle sin sede | **Cerrado** | `f8c542b` — `field-model.ts`, `field-direct.test.ts`, `actions.ts` |
| Copy bloqueos “esta semana” engañoso | **Cerrado** | `1c58ff1` — label “bloqueos de torneo”; query excluye seasons archivadas |
| Guest token no invalida al cerrar admin/referee | **Cerrado** | `5157038` — migración `20260829140000_invalidate_guest_invite_on_match_close.sql` |
| Wizard / query params parciales en Equipos | **Cerrado** | `a03eb42` + lógica en `9fac0db` (`season-picker.test.ts`) |
| Copy “temporada” en flujo torneo | **Parcial** | strings principales del torneo actualizados; quedan casos en miembros/plataforma/RBAC |
| Disciplina hub auto-redirect | **Cerrado** | `9fac0db` + redirect en hub disciplina |
| Migraciones remotas Supabase | **Pendiente ops** | aplicar `20260829120000`, `20260829130000`, `20260829140000` |
| Pagos: warning pre-submit / `totalCredit` | **Abierto** | fuera de scope de este cierre |
| `groupsAdvancePerGroup` lock server-side | **Abierto** | fuera de scope |

### Tests / build tras cierre

Ejecutados tras commits `f8c542b`…`a03eb42` y cierre de copy UI:

```
ℹ tests 181 (+10 vs auditoría original)
ℹ suites 82
ℹ pass 181
ℹ fail 0
npm run build → exit 0 (TypeScript + static pages OK)
```
