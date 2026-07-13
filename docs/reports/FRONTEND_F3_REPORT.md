# Frontend F3 + Migration 012 — Reporte de entrega

**Fecha:** 2026-07-13  
**Base:** `ec8e523` — `feat: frontend F2 organization onboarding and branding`  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Check | Resultado |
| --- | --- |
| Working tree limpio | Sí |
| Commit F2 | `ec8e523` |
| Migrations 001–011 sync | Sí |
| Schema venues/fields/rules | Confirmado (sin is_active previo) |
| Opción B aprobada | Sí (migración + F3) |
| Mundial Compas | No tocado |

---

## 2–5. Migration 012

**Archivo:** `supabase/migrations/20260713015139_venues_fields_active_and_availability_replace.sql`  
**Push:** aplicado · local = remote

### Schema agregado

- `venues.is_active boolean NOT NULL DEFAULT true`
- `fields.is_active boolean NOT NULL DEFAULT true`

### Constraint solapamiento

`no_overlapping_field_availability` EXCLUDE USING gist:

- `field_id =`
- `day_of_week =`
- `tsrange(date'2000-01-01'+starts_at, date'2000-01-01'+ends_at) &&` (bounds `[)`)

Contiguos OK; solapes rechazados.

### RPC

`replace_field_availability(p_field_id uuid, p_intervals jsonb)` → setof rules ordenadas.  
SECURITY DEFINER; REVOKE PUBLIC/anon; GRANT authenticated; sin `organization_id`/`profile_id` externos.

Hardening posterior (sin cambiar comportamiento): `20260713021350_fix_availability_rpc_variable_names.sql` — elimina shadowed variables de plpgsql.

---

## 6. Archivos

### Creados

```
supabase/migrations/20260713015139_venues_fields_active_and_availability_replace.sql
supabase/tests/012_venues_fields_availability.sql
docs/VENUES_AND_FIELDS.md
docs/reports/FRONTEND_F3_REPORT.md
src/lib/venues/{types,queries,actions,availability-validation}.ts
src/components/venues/{VenueList,VenueCard,VenueForm,FieldList,FieldForm,FieldAvailabilityEditor}.tsx
src/app/.../sedes/{page,nueva/page,[venueId]/page,[venueId]/editar/page}.tsx
```

### Modificados

```
nav-items.ts (Sedes activa)
inicio/page.tsx + OrganizationDashboardDemo (métricas reales)
src/types/database.ts
docs/DOMAIN_MODEL.md
supabase/tests/002_venues_fields_isolation.sql (cleanup post-finance/audit; UIDs únicos)
```

---

## 7–11. Rutas / Actions / UI

| Ruta | Acceso |
| --- | --- |
| `/sedes` | miembros |
| `/sedes/nueva` | owner/admin |
| `/sedes/[venueId]` | miembros (tenant check) |
| `/sedes/[venueId]/editar` | owner/admin |

**Actions:** `createVenueAction`, `updateVenueAction`, `createFieldAction`, `updateFieldAction`, `replaceFieldAvailabilityAction`

**Helpers:** `getOrganizationVenues`, `getVenueWithFields`, `getFieldAvailability`, `getOrganizationVenueStats`

**UI:** listado, forms, editor semanal multi-intervalo, badges Activa/Inactiva, aviso venue inactiva en fields.

---

## 12. Matriz de permisos

| Rol | Ver | Mutar venues/fields | Disponibilidad |
| --- | --- | --- | --- |
| owner/admin | sí | sí | sí (RPC) |
| member | sí | no | no |
| externo | notFound | — | — |

---

## 13. Pruebas 012 — 32/32 PASS

01–32 individuales PASS (incl. overlap RPC+constraint, empty array, atomic preserve, audit, grants).

---

## 14. Regresiones

| Suite | Resultado |
| --- | --- |
| 002 | 8/8 PASS (cleanup endurecido; UIDs sin colisión 010) |
| 010 | 51/51 PASS |
| 011 | 40/40 PASS |
| 012 | 32/32 PASS |

---

## 15. Pruebas frontend reales (API autenticada)

Cuenta `f1smoke…` / org F2:

| Caso | Resultado |
| --- | --- |
| Crear venue | PASS (`Unidad Norte F3`) |
| Crear 2 fields | PASS |
| Desactivar venue; fields conservan is_active | PASS |
| Contiguos + multi-día vía RPC | PASS (3 reglas) |
| Solape rechazado; reglas previas intactas | PASS |
| Build incluye rutas sedes | PASS |
| lint | PASS |

### Validación visual (product owner)

**Aprobada funcionalmente** por el product owner antes del cierre de hardening. Incluye flujo de sedes/canchas/disponibilidad en UI.

---

## 16. No verificadas (browser UI)

Casos no re-ejecutados en este cierre de hardening (ya cubiertos o pendientes menores):

- Member vs owner en UI (detalle de roles)
- Mobile 375px / PWA standalone / hydration / consola (checklist exhaustivo)
- Vaciar semana desde UI
- IDs otra org en browser

---

## 17–21. Validaciones (post-hardening)

| Check | Resultado |
| --- | --- |
| suite 012 | **32/32 PASS** |
| regresión 002 | **8/8 PASS** |
| db lint | **Sin errores ni warnings** (`results: []`) |
| npm lint | PASS |
| build | PASS |
| migration list | 001–012 + `20260713021350` sync |
| git status | dirty, sin commit |

### Hardening Migration

**Archivo:** `supabase/migrations/20260713021350_fix_availability_rpc_variable_names.sql`  
**Motivo:** eliminar warnings `plpgsql shadowed variables` de `replace_field_availability` sin editar la 012 ya aplicada.  
**Cambio:** `CREATE OR REPLACE` con locales renombrados (`v_loop_idx`, `v_outer_idx`, `v_inner_idx`, alias `ven` / `rule_row`); misma firma, lógica, grants y seguridad.

---

## 22. Riesgos / desviaciones

1. ~~db lint shadowed vars~~ → **corregido** vía hardening `20260713021350`.
2. Suite 002: cleanup + UIDs actualizados para coexistir con finance/audit (aserciones intactas).
3. Checklist browser exhaustivo no re-corrido en el cierre de hardening (PO ya aprobó F3 funcionalmente).
4. Datos smoke reales creados en org F2 (venue/fields de prueba).

---

## 23. Mundial Compas

**No tocado.**
