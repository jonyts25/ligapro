# Frontend — Branding de organizador en páginas públicas + crédito "Powered by"

**Alcance:** conectar branding F2 existente a `/publico/[organizationId]/[seasonSlug]` sin migración nueva.

## RPCs públicas (F8)

`get_public_season_overview` **ya incluía** de forma aditiva:

- `organization_name`
- `organization_logo_path`
- `organization_brand_color`

No se modificó ninguna RPC — las subpáginas (posiciones, calendario, etc.) obtienen el layout vía `PublicSeasonShell` → `getPublicSeasonOverview`.

`logo_path` se resuelve en frontend con `getOrganizationLogoPublicUrl` → bucket público `organization-logos` (sin signed URLs).

## Frontend

| Pieza | Detalle |
| --- | --- |
| `src/lib/platform/config.ts` | `PLATFORM_NAME` y `PLATFORM_HOME_URL` — único lugar para rebranding del nombre |
| `mapPublicSeasonOverviewToBranding` | Reusa `mapOrganizationBranding` + `sanitizeAccentForCss` |
| `PublicSeasonHeader` | `OrganizationBrand` (variant `compact`) + nombre org/torneo |
| `PublicSeasonShell` | `--organization-accent` vía `sanitizeAccentForCss` (igual que admin) |
| `PoweredByFooter` | "Powered by {PLATFORM_NAME}" con link a `/` |

## Fallbacks / regresión

- Sin logo → iniciales vía `OrganizationBrand` (misma lógica que admin).
- Sin `brand_color` → `--organization-accent` queda en default `--brand` de `globals.css` (sin override en shell).
- **Contraste de acento:** no existe mecanismo de fallback por contraste bajo en admin ni público; pendiente futuro (no improvisado aquí).

## Fuera de alcance (confirmado)

Tier/suscripción, layout/tipografía custom, cambios a bucket `organization-logos`, datos sensibles.

## Calidad

- `npm run lint` / `npm run build` / `npm test` → PASS

## Commit

`cbbf227` — `feat(public): apply org branding and powered-by footer on public season pages`  
Push: `origin/main`
