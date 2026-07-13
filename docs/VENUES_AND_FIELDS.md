# Sedes, canchas y disponibilidad — LigaPro

## Organization vs venue vs field

| Concepto | Tabla | Significado |
| --- | --- | --- |
| **Organization** | `organizations` | Cliente que opera LigaPro (empresa, liga, organizador, complejo). |
| **Venue** | `venues` | Sede física (Complejo Miura, Unidad Norte, Sucursal Centro). |
| **Field** | `fields` | Cancha o superficie dentro de una sede (Cancha 1, Fútbol 7). |

Una organization puede tener muchas venues. Una venue puede tener muchos fields. No se crean fields sin venue.

## `is_active`

- `venues.is_active` y `fields.is_active` (boolean, default `true`) — Migration 012.
- Owner/admin pueden activar/desactivar. Members ven ambos estados.
- **No hay DELETE físico** en la UI.
- Desactivar una venue **no** cambia automáticamente `fields.is_active`.
- Se puede editar y reactivar registros inactivos.

### Disponibilidad operativa efectiva (fases posteriores)

Un field no debe considerarse disponible para reservas/partidos si:

- `field.is_active = false`, o
- su venue tiene `is_active = false`.

En F3 aún no existen reservas ni partidos; la regla queda documentada para F4+.

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
2. Resuelve organization desde el field.
3. Valida JSON, horas, solapes.
4. Borra reglas del field e inserta las nuevas en una sola transacción.
5. Array vacío = sin disponibilidad.
6. Retorna reglas ordenadas por día y hora.

La UI guarda la semana únicamente mediante esta RPC.

## Permisos

| Rol | Ver | Crear/editar venues/fields | Disponibilidad |
| --- | --- | --- | --- |
| owner | sí | sí | sí |
| admin | sí | sí | sí |
| member | sí | no | no |
| externo / anon | no | no | no |

## Rutas

```text
/organizaciones/{orgId}/sedes
/organizaciones/{orgId}/sedes/nueva
/organizaciones/{orgId}/sedes/{venueId}
/organizaciones/{orgId}/sedes/{venueId}/editar
```

## Limitaciones F3

- Sin reservas (`field_reservations` no se usa en UI).
- Sin partidos ni asignación de horarios.
- Sin precios ni mapas.
- Sin páginas públicas de sedes.

## Siguiente paso

Calendario / reservas sobre estas reglas y el estado activo efectivo.
