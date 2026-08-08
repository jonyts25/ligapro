# ADR 0017 — Tier-gating Básico / Premium

**Estado:** Aceptado  
**Migration:** `20260808200000_cotizador_tier_teams_jornada.sql`

## Contexto

Hasta ahora todas las organizaciones tenían acceso uniforme. Se introduce distinción comercial **Básico** vs **Premium** con un único punto de verificación.

## Decisiones

### 1. Almacenamiento

- `organizations.plan_tier` text: `'basico'` | `'premium'`, default `'basico'` (existentes y nuevas).
- Cambio solo vía RPC `set_organization_plan_tier(p_organization_id, p_tier)` — `SECURITY DEFINER`, `is_platform_staff` exclusivamente, audit trigger.

### 2. Punto único de verificación

- SQL: `organization_has_premium(p_organization_id uuid) RETURNS boolean` — `STABLE`, `SECURITY DEFINER`.
- TypeScript: `tieneAccesoPremium(organizationId)` en `src/lib/billing/premium-access.ts` — wrapper del RPC; **único** lugar en frontend/backend app donde se resuelve Premium.
- Prohibido esparcir `plan_tier === 'premium'` en UI o actions.

### 3. Features detrás del gate (entrada)

| Feature | Gate |
| --- | --- |
| Resumen de jornada IA | Sí — implementado |
| Patrocinios + conteo exposición | Sí — reservado (tabla aún no migrada) |
| Perfiles carrera / rivalidades / reconocimientos | Sí — reservado (futuro) |
| Crónica por partido | **No** — permanece Básico |

### 4. Comportamiento sin acceso

- Backend: RPCs Premium rechazan con error claro (`ERRCODE P0001`).
- Frontend: ocultar entrada (no deshabilitar botón).

### 5. UI staff

- Selector de tier en `/plataforma/facturacion` (misma pantalla, sección organizaciones).
- RPC lectura: `get_platform_organizations_billing()` devuelve org + tier.

## Consecuencias

- Marca de agua «Powered by Ligera» en público (ADR-0013) puede ligarse a este tier en trabajo futuro; no se implementa aquí.

## Fuera de alcance

Facturación automática por tier, self-serve upgrade, Stripe.
