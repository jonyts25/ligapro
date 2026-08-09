# ADR 0017 — Tier-gating Básico / Premium

**Estado:** Aceptado  
**Migration:** `20260809100000_season_teams_status_void_match.sql`

## Contexto

Hasta ahora todas las organizaciones tenían acceso a todas las features. Se
introduce por primera vez un plan por organización con punto único de verificación.

## Decisiones

### 1. Almacenamiento

- Columna `organizations.plan_tier`: `'basico'` | `'premium'`, default `'basico'`
  para existentes y nuevas.

### 2. Cambio de tier (staff plataforma)

- RPC `set_organization_plan_tier(p_organization_id, p_plan_tier)`.
- `SECURITY DEFINER`; solo `is_platform_staff(auth.uid())`.
- Audit trigger en `organizations`.

### 3. Punto único de verificación

- SQL: `organization_has_premium(p_organization_id uuid) RETURNS boolean`
  — única función que resuelve Premium en backend.
- TypeScript: `tieneAccesoPremium(organizationId)` en
  `src/lib/organizations/premium-access.ts` — llama al RPC; **ningún otro
  código compara `plan_tier` directamente**.

### 4. Features detrás del gate (entrada)

| Feature | Gate |
| --- | --- |
| Resumen de jornada IA | Sí |
| Patrocinios + conteo exposición | Sí (cuando exista UI) |
| Perfiles carrera / rivalidades / reconocimientos | Reservado |
| Crónicas por partido | **No** (Básico) |

### 5. Comportamiento sin acceso

- Backend: RPC rechaza con error claro.
- Frontend: ocultar navegación/acciones, no botones deshabilitados.

### 6. UI staff

- Selector de tier en `/plataforma/facturacion` (por organización), no pantalla
  nueva.

## Consecuencias

- Nuevas features premium deben usar solo `organization_has_premium` /
  `tieneAccesoPremium`.

## Fuera de alcance

- Facturación automática por tier.
- Límites de uso / metering.
