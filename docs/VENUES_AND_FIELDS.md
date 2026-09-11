# Canchas y disponibilidad — LigaPro

## Organization vs field (modelo actual)

| Concepto | Tabla | Significado |
| --- | --- | --- |
| **Organization** | `organizations` | Cliente que opera LigaPro (empresa, liga, organizador). |
| **Field** | `fields` | Cancha o superficie registrada directamente bajo la organización (nombre, dirección opcional, superficie, activa/inactiva). |

Las canchas nuevas se crean con `organization_id` y `venue_id = null`. No hace falta crear una sede intermedia.

### Tabla `venues` (legacy)

| Concepto | Tabla | Estado |
| --- | --- | --- |
| **Venue** | `venues` | **Legacy.** Conservada para datos históricos y migración futura. **No se usa en altas nuevas** ni en rutas activas de la UI (`/canchas/*`). |

Campos legacy pueden tener `venue_id` apuntando a una fila en `venues`; el backfill copió `venues.address` → `fields.address` donde aplicaba.

## `is_active`

- `fields.is_active` (boolean, default `true`).
- Owner/admin pueden activar/desactivar. Members ven el estado.
- **No hay DELETE físico** en la UI.
- Se puede editar y reactivar canchas inactivas.

### Disponibilidad operativa efectiva

Un field no debe considerarse disponible para reservas/partidos si:

- `field.is_active = false`.

Ya **no** se exige que una venue padre esté activa para canchas nuevas (`venue_id` null).

**F6 (actualizado):** `schedule_match` exige `field.is_active`. Canchas inactivas no aceptan nuevas programaciones; reservas históricas se conservan. Sin reglas de `field_availability_rules` para el día = no se programa (no se asume 24/7). Ver `docs/FIXTURE_AND_SCHEDULING.md`.

## Disponibilidad habitual

Tabla: `field_availability_rules`.

- `day_of_week` 0–6 (Domingo–Sábado).
- `starts_at` / `ends_at` (`ends_at > starts_at`).
- Varios intervalos por día permitidos.
- Constraint de exclusión `no_overlapping_field_availability` (btree_gist + `tsrange` con bounds `[)`): solapes rechazados; **contiguos permitidos**.
- **No son reservas** ni partidos; son horario semanal base.

### Reemplazo atómico

RPC `replace_field_availability(p_field_id, p_intervals jsonb)`:

1. Autoriza owner/admin vía `auth.uid()`.
2. Resuelve organization desde el field (sin join a `venues`).
3. Valida JSON, horas, solapes.
4. Borra reglas del field e inserta las nuevas en una sola transacción.
5. Array vacío = sin disponibilidad.
6. Retorna reglas ordenadas por día y hora.

La UI guarda la semana únicamente mediante esta RPC.

## Bloqueos por torneo

Tabla separada: `season_field_blocks` — **no** es `field_reservations` ni bloqueo de partido individual.

| Columna | Notas |
| --- | --- |
| `season_id`, `field_id`, `organization_id` | Consistencia por triggers |
| `day_of_week` | 0–6 |
| `starts_at` / `ends_at` | `ends_at > starts_at` |

Reglas:

- Varios bloqueos de la **misma** season en el mismo field/día **permitidos** (p. ej. jueves + domingo).
- Dos **seasons distintas** no pueden solaparse en el mismo `field_id` + día + franja horaria (EXCLUDE intra-season + trigger cross-season).
- RPC `set_season_field_blocks(p_season_id, p_blocks jsonb)`: reemplazo atómico por season (mismo patrón que `replace_field_availability`); solo owner/admin.

`schedule_match` y `apply_recurring_slot_to_season` rechazan slots ocupados por bloqueo de **otra** season; bloqueo de la **misma** season no impide programar.

Vista org-wide de disponibilidad (solo lectura): `/organizaciones/{orgId}/canchas/disponibilidad`.

## Permisos

| Rol | Ver | Crear/editar canchas | Disponibilidad |
| --- | --- | --- | --- |
| owner | sí | sí | sí |
| admin | sí | sí | sí |
| member | sí | no | no |
| externo / anon | no | no | no |

## Rutas activas

```text
/organizaciones/{orgId}/canchas
/organizaciones/{orgId}/canchas/nueva
/organizaciones/{orgId}/canchas/{fieldId}
/organizaciones/{orgId}/canchas/{fieldId}/editar
/organizaciones/{orgId}/canchas/disponibilidad
```

Rutas `/sedes/*` redirigen a `/canchas/*` (bookmarks legacy).

## Limitaciones actuales

- Sin precios ni mapas en canchas.
- Sin páginas públicas de canchas (solo uso interno de la org).

## Siguiente paso

Deprecar por completo `venues` cuando no queden fields con `venue_id` en producción.
