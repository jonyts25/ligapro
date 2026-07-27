# Fix — Nav Finanzas y Disciplina

## Problema

Finanzas y Disciplina ya existían como rutas de **temporada** (`.../temporadas/[seasonId]/finanzas` y `.../disciplina`), pero el **panel lateral de organización** seguía marcándolas como `Próximamente` porque `src/components/layout/nav-items.ts` tenía `available: false` desde antes de conectar esas pantallas.

## Dónde estaba el placeholder

| Ubicación | Rol |
| --- | --- |
| `src/components/layout/nav-items.ts` | `disciplina` y `finanzas` con `available: false` |
| `src/components/layout/NavItemLink.tsx` | Renderiza badge "Próximamente" cuando `available === false` |
| `src/components/layout/MobileNavigation.tsx` | Mismo patrón en nav móvil inferior |

**Confirmado:** el placeholder vive en el nav de **organización** (`Sidebar` / `MobileNavigation` vía `getOrganizationNavItems`), no en `SeasonStandingsNav` (nav de temporada), donde Finanzas y Disciplina ya enlazaban correctamente para admins.

No se encontraron placeholders residuales en el home de organización ni en tarjetas del dashboard para estas dos pantallas.

## Criterio de enlace (UX)

Mismo patrón que **Partidos** y **Calendario** org-level:

1. El ítem lateral apunta a un **hub de organización**: `/organizaciones/[organizationId]/disciplina` o `/finanzas`.
2. El hub lista temporadas ordenadas por `created_at` descendente (más reciente primero).
3. Cada fila enlaza a la pantalla real de esa temporada.
4. Sin temporadas → `EmptyState` sensato (no 404).

No se inventó "temporada activa": el usuario elige la temporada en el hub.

**Permisos (sin cambios):**

- **Disciplina:** visible en nav para todos los miembros; hub con `requireOrganizationMembership`; pantalla de temporada ya existente.
- **Finanzas:** ítem de nav solo owner/admin (`canManageSettings`, igual que Configuración); hub con `requireOrganizationAdmin`; pantalla de temporada ya existente.

## Cambios

- `nav-items.ts`: habilitar enlaces; ocultar Finanzas a no-admin; `isActiveRoute` resalta también rutas de temporada.
- Nuevas páginas hub: `disciplina/page.tsx`, `finanzas/page.tsx`.
- Tests: `nav-items.test.ts` (+ glob en `package.json`).

## Verificación

- Rutas hub registradas en build: `/organizaciones/[organizationId]/disciplina` y `/finanzas`.
- Enlaces apuntan a rutas de temporada existentes (no 404).
- `npm run lint`, `npm test`, `npm run build` OK.
- No queda "Próximamente" para Finanzas/Disciplina en nav (solo Configuración sigue como placeholder legítimo).

## Commit

`c595a89` — `fix(nav): link Finanzas and Disciplina from org sidebar`  
Push: `origin/main`
