# Migration 028 — Persistencia de parámetros del cotizador

**Archivo:** `supabase/migrations/20260724000000_platform_pricing_defaults.sql`  
**ADR / feature:** `docs/reports/FEATURE_COTIZADOR_INTERNO_REPORT.md`

## Qué aplica

- Tabla `platform_pricing_defaults` (singleton, sin acceso directo cliente)
- RPC `get_platform_pricing_defaults()` — staff only
- RPC `set_platform_pricing_defaults(...)` — staff only

**Requisito:** Migration 027 (`is_platform_staff`) debe estar aplicada.

## Cómo aplicar

### Opción A — CLI (recomendado)

```bash
npx supabase link --project-ref akgcamaegpboewsbbevl
npx supabase db push --linked
```

### Opción B — Supabase SQL Editor

Pegar y ejecutar **el archivo completo de migración**:

`supabase/migrations/20260724000000_platform_pricing_defaults.sql`

**No pegar** `supabase/tests/028_platform_pricing_defaults.sql` — ese archivo es de pruebas y asume que las RPCs ya existen.

## Error común

```
function public.get_platform_pricing_defaults() does not exist
```

**Causas:**

1. Se ejecutó el archivo de **tests** en lugar de la **migración**
2. La migración se detuvo tras `CREATE TABLE` (bloque de funciones no corrió)
3. Migration 027 no aplicada → `CREATE FUNCTION` falla por `is_platform_staff` inexistente

**Reparación:** pegar y ejecutar en SQL Editor:

`supabase/repair/028_platform_pricing_defaults_repair.sql`

Al final debe listar 2 funciones (`get_...` y `set_...`).

## Verificación manual rápida

```sql
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname LIKE '%platform_pricing%';
```

Debe devolver `get_platform_pricing_defaults` y `set_platform_pricing_defaults`.

## Tests SQL

```bash
npx supabase db query --linked -f supabase/tests/028_platform_pricing_defaults.sql
```

6 casos: outsider rechazado en get/set, sin SELECT directo, staff get defaults, staff set/get, `updated_by_profile_id`.

## Deploy Railway

El deploy de Railway **no** ejecuta migraciones. Solo aplica el frontend. La migración hay que correrla en Supabase aparte (CLI o SQL Editor).

## Commit

*(actualizar tras push del fix de repair)*
