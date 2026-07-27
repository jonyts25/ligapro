# ADR 0012 — Staff de plataforma y panel interno de facturación

**Estado:** Aceptado  
**Migration:** 027 (`20260722000000_platform_staff_billing.sql`)

## Contexto

Migration 021 introdujo `seasons.platform_billing_status` como candado operativo (fixture/bracket/slots) sin vía de cambio desde la app. El estado se gestionaba solo en Supabase dashboard. Con volumen creciente, se necesita un panel interno acotado sin mezclar roles de organización.

## Decisión

1. **`platform_staff`** — tabla de operadores LigaPro, poblada **solo manualmente** en Supabase. Sin RPC/UI de alta/baja. `REVOKE ALL` para anon/authenticated; RLS sin policies (cero acceso cliente).

2. **`is_platform_staff(profile_id)`** — helper `SECURITY DEFINER` que consulta la tabla internamente.

3. **`set_platform_billing_status`** — única vía app para cambiar `platform_billing_status`. Autorización **exclusivamente** `is_platform_staff(auth.uid())`, nunca roles de org. Bypass controlado del trigger 021 vía `app.platform_billing_status_rpc`.

4. **`get_platform_billing_overview`** — lectura mínima cross-org: org, temporada, estado, conteo equipos inscritos, boolean fixture. Sin datos operativos (roster, finanzas, disciplina, eventos).

5. **Frontend** — ruta `/plataforma/facturacion` fuera de `/organizaciones/...`. Gate `notFound()` si no es staff. Sin enlace en nav de organización.

## Consecuencias

- Admin de una org **no** obtiene privilegios de facturación de plataforma.
- Platform staff **no** accede a tablas operativas de clientes; solo las dos RPCs anteriores.
- Quién es staff sigue siendo decisión manual en Supabase (service role / SQL).

## Fuera de alcance

Gestión de membership en `platform_staff` desde la app, roles internos de staff, acceso de staff a finanzas/roster/disciplina de orgs.
