# Frontend — Canchas, portal capitán (WhatsApp + alta), disponibilidad

**Fecha:** 2026-07-26  
**Base:** Migration 021 aplicada (`03b0443`)  
**Alcance:** WhatsApp en portal, perfil/teléfono capitán, alta de jugador por capitán, bloqueos de cancha por temporada (admin), dashboard de disponibilidad (admin, solo lectura).  
**Sin migraciones ni RPCs nuevos.**

---

## Resumen

Se completó el frontend pendiente de Migration 021: el portal del capitán puede contactar rivales vía `wa.me` cuando hay `profiles.phone`, capturar su propio teléfono, y dar de alta jugadores nuevos con mensajes claros de rechazo. En admin: invitaciones con teléfono opcional para armar el link de WhatsApp, bloqueos de cancha por temporada, y vista de disponibilidad cruzada por cancha/semana.

---

## 1. WhatsApp en portal del capitán

### `getOpponentCaptainPhone`

Implementado en `src/lib/captain/queries.ts`:

1. Resuelve el `season_team_id` rival del partido.
2. Consulta `season_team_players` activos con `is_captain` o `is_vice_captain`.
3. Prioriza capitán sobre subcapitán.
4. Lee `profiles.phone` vía `players.profile_id`.
5. Retorna el primer teléfono no nulo, o `null` si ninguno lo tiene.

El botón WhatsApp en `CaptainMatchReschedulePanel` sigue deshabilitado con explicación cuando el resultado es `null`.

### Perfil del capitán

| Ruta | Descripción |
| --- | --- |
| `/mi-equipo/perfil` | Formulario mínimo: nombre para mostrar + teléfono (`profiles.display_name`, `profiles.phone`) |

- Acción: `updateCaptainProfileAction` en `src/lib/captain/actions.ts`.
- Nav: enlace «Mi perfil» en `CaptainShell`.

### Admin — teléfono en invitación

Campo opcional **solo en formulario** (no se persiste en `captain_invitations`):

| Formulario | Archivo |
| --- | --- |
| Invitar capitán (jugador nuevo) | `CreateCaptainPlayerForm.tsx` |
| Invitar capitán en plantel existente | `InviteCaptainToRosterForm.tsx` en `RosterPlayerCard` |

Tras crear la invitación, `InviteLinkResult` muestra URL de invitación + deep-link `wa.me` si se capturó teléfono. El teléfono persistente del capitán es el que guarde en su perfil tras aceptar.

---

## 2. Alta de jugador por capitán

### Flujo RPC

Se usa **`create_player_and_add_to_roster`** (mismo flujo que admin «crear jugador nuevo»), no `add_player_to_season_team`.

Acción: `createPlayerAndAddCaptainAction` → RPC con actor capitán/vice.

### UI

- Formulario en `/mi-equipo/[seasonTeamId]` vía `CaptainAddPlayerForm` dentro de `CaptainRosterPanel`.
- Campos: nombre completo, número de jersey.
- Plantel listado sigue **solo lectura** — sin botones de baja, edición de status ni capitanía.

### Errores humanizados

`src/lib/captain/roster-errors.ts` + tests:

| Condición RPC | Mensaje UI |
| --- | --- |
| `max_roster_size` | Tope de N jugadores alcanzado |
| `roster_locked_by_captain = true` | Liga bloqueó altas; contactar admin |
| Jugador activo en otro equipo de la misma season | Conflicto de cupo en temporada |

---

## 3. Bloqueo de cancha por torneo (admin)

| Ruta | Descripción |
| --- | --- |
| `.../temporadas/[seasonId]/canchas` | Editor de bloqueos por temporada |

- Nav: enlace «Canchas» en `SeasonStandingsNav`.
- Componente: `SeasonFieldBlocksEditor` — reutiliza patrón de intervalos (día, inicio, fin) similar a `replace_field_availability` en F3.
- Acción: `setSeasonFieldBlocksAction` → RPC `set_season_field_blocks`.
- Errores: `humanizeSeasonFieldBlocksError` traduce choque cross-season y solapes intra-formulario.

---

## 4. Dashboard de disponibilidad (admin, solo lectura)

| Ruta | Descripción |
| --- | --- |
| `.../sedes/disponibilidad` | Vista semanal por cancha |

### Decisión: queries cliente vs RPC

**Elegido: 3 queries paralelas desde el cliente** (`src/lib/venues/availability-overview.ts`), **sin** RPC `get_field_availability_overview`.

**Por qué:**

- Las tres fuentes ya tienen RLS y SELECT expuesto a admins de organización.
- El cruce es merge en memoria por `field_id` + rango de fechas/semana — lógica de presentación, no de negocio.
- Evita una migración/RPC adicional cuando el volumen por cancha/semana es acotado.
- Si el cruce crece (muchas canchas × muchas seasons), una RPC futura sería optimización, no requisito funcional.

**Fuentes cruzadas:**

| Fuente | Tipo en UI |
| --- | --- |
| `field_availability_rules` | Disponible (regla recurrente) |
| `field_reservations` | Ocupado por partido (+ season) |
| `season_field_blocks` | Reservado por torneo |

Sin acciones de reserva, pago ni edición en esta pantalla.

---

## Archivos nuevos / principales

| Área | Archivos |
| --- | --- |
| Captain perfil/alta | `CaptainProfileForm`, `CaptainAddPlayerForm`, `mi-equipo/perfil/page.tsx`, `roster-errors.ts` |
| Captain queries/actions | `getOpponentCaptainPhone`, `getCaptainProfile`, `updateCaptainProfileAction`, `createPlayerAndAddCaptainAction` |
| Admin invitaciones | `CreateCaptainPlayerForm`, `InviteCaptainToRosterForm`, `InviteLinkResult`, acciones en `teams/actions.ts` |
| Bloqueos temporada | `src/lib/season-fields/*`, `SeasonFieldBlocksEditor`, `canchas/page.tsx` |
| Disponibilidad | `availability-overview.ts`, `FieldAvailabilityOverview*`, `sedes/disponibilidad/page.tsx` |

---

## Verificación

```bash
npm run lint    # OK
npm run build   # OK
npm test        # 51/51 PASS (incl. roster-errors.test.ts)
```

### Checklist funcional

- [x] WhatsApp rival: habilitado solo con `profiles.phone` del capitán/sub rival
- [x] Capitán captura teléfono propio en `/mi-equipo/perfil`
- [x] Admin invita con teléfono opcional para `wa.me` (no persistido en invitación)
- [x] Alta jugador capitán con mensajes para tope, bloqueo y conflicto de season
- [x] Plantel portal sin acciones de baja/edición
- [x] Bloqueos cancha con error legible cross-season
- [x] Disponibilidad solo lectura, 3 fuentes cruzadas

---

## Fuera de alcance (confirmado)

WhatsApp Business API, panel `platform_billing_status`, baja/edición de roster por capitán, cambios de schema, RPC `get_field_availability_overview`.
