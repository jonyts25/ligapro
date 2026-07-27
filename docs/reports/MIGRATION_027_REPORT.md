# Migration 027 — Staff de plataforma y panel interno de facturación

**Archivo:** `supabase/migrations/20260722000000_platform_staff_billing.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0012-staff-plataforma-facturacion.md`

## Objetivos

1. Tabla `platform_staff` poblada solo manualmente en Supabase (sin acceso cliente).
2. Helper `is_platform_staff(profile_id)`.
3. RPC `set_platform_billing_status` — única vía app para cambiar `seasons.platform_billing_status` (solo platform staff).
4. RPC `get_platform_billing_overview` — lectura mínima cross-org para panel interno.
5. Frontend `/plataforma/facturacion` fuera del namespace de organizaciones.

## Seguridad

| Regla | Implementación |
| --- | --- |
| Sin UI/RPC para gestionar staff | `REVOKE ALL` en `platform_staff`; RLS sin policies |
| Staff no lee tablas operativas | Solo las dos RPCs de facturación |
| No roles de org | `set_platform_billing_status` / overview exigen `is_platform_staff(auth.uid())` |
| Ruta aparte | `/plataforma/facturacion`; `notFound()` si no es staff |
| Trigger 021 | Bypass controlado vía `app.platform_billing_status_rpc` (patrón `void_match_event`) |

## Schema

### `platform_staff`

- `id`, `profile_id` UNIQUE → `profiles`, `granted_at`, `granted_by_profile_id`
- Sin acceso anon/authenticated

## RPCs

| RPC | Actor | Notas |
| --- | --- | --- |
| `is_platform_staff(p_profile_id)` | authenticated | Helper booleano |
| `set_platform_billing_status(season_id, status, reason?)` | platform staff | Valida CHECK; actualiza temporada |
| `get_platform_billing_overview()` | platform staff | org, temporada, status, equipos inscritos, has_fixture |

## Frontend

- **`/plataforma/facturacion`** — tabla con filtro por estado, confirmación en dos pasos antes de cambiar.
- **`PlatformStaffLink`** — enlace discreto en `/seleccionar-organizacion` solo si `is_platform_staff`.
- Sin enlace en nav de organización.

## Pruebas

`supabase/tests/027_platform_staff_billing.sql` — **11/11 PASS**

Cubre: outsider/owner/admin rechazados en set y overview, sin SELECT directo en `platform_staff`, status inválido, staff cross-org, overview con campos esperados.

Nota: test no re-ejecutable sin limpieza manual (UUIDs fijos + `audit_log` append-only).

## Tipos TS

`src/types/database.ts` regenerado (`npx supabase gen types typescript --project-id akgcamaegpboewsbbevl`).

## Docs actualizados

- `docs/FIXTURE_AND_SCHEDULING.md` — sección facturación 021+027
- `docs/DOMAIN_MODEL.md` — `platform_staff`, columna seasons
- `docs/ADR/0012-staff-plataforma-facturacion.md`

## Commit

`7efd53d` — feat(027): platform staff billing panel and RPCs

## Fuera de alcance (confirmado)

Gestión de membership en staff desde app, acceso operativo a orgs, roles internos de staff, nav org hacia panel.

## Seguimiento

- **Fix enlace una org:** `18fd52a` — `PlatformStaffNavLink` en AppShell de organización (`docs/reports/FIX_ENLACE_PLATFORM_STAFF_REPORT.md`).
