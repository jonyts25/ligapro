# Fix — Enlace Facturación de plataforma inalcanzable (una org)

**Fecha:** 2026-07-26  
**Relacionado:** Migration 027 (`PlatformStaffLink`)

## Causa

`resolveAuthDestination` envía a usuarios con **exactamente una** membresía directo a `/organizaciones/{id}/inicio`, sin pasar por `/seleccionar-organizacion`. El enlace a Facturación solo vivía en esa página, así que un platform staff owner de una sola liga nunca lo veía tras el login.

Tabla de enrutamiento confirmada en `src/lib/auth/resolve-auth-destination.ts`:

| Membresías | Destino |
| --- | --- |
| 0 | onboarding o `/mi-equipo` (capitanías) |
| 1 | `/organizaciones/{id}/inicio` |
| 2+ | `/seleccionar-organizacion` |

No se modificó esta lógica (sin regresión para usuarios normales).

## Solución (opción 1)

Enlace persistente en el **AppShell de organización**, visible solo si `is_platform_staff`:

- Nuevo componente `PlatformStaffNavLink` (server) en el footer del sidebar desktop.
- Misma entrada en el drawer móvil («Más módulos») vía prop `platformStaffNav`.
- Se mantiene `PlatformStaffLink` en `/seleccionar-organizacion` para usuarios multi-org.

Archivos tocados:

- `src/components/platform-billing/PlatformStaffLink.tsx`
- `src/components/layout/AppShell.tsx`, `Sidebar.tsx`, `TopBar.tsx`, `MobileMoreDrawer.tsx`
- `src/app/(protected)/organizaciones/[organizationId]/layout.tsx`

## Verificación

- Platform staff + 1 org → enlace «Facturación de plataforma» en sidebar al entrar a la org.
- Usuario no staff → no ve sección «LigaPro interno».
- `npm run lint` / `npm run build` / `npm test` ✅

## Commit

`18fd52a` — fix(nav): show platform billing link in org AppShell
