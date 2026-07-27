# Feature — Cotizador interno de precio (platform staff)

**Ruta:** `/plataforma/cotizador`  
**ADR:** `docs/ADR/0012-staff-plataforma-facturacion.md` (mismo gate `is_platform_staff`)

## Qué es

Calculadora hipotética de precio por torneo para staff LigaPro. Las **líneas de cotización** viven en React state (efímeras); los **parámetros de precio** persisten en Supabase (Migration 028).

## Fórmula (multi-línea)

Por cada línea de torneo:

```
Subtotal línea = precio_base × equipos × mult_duración (de esa línea)
```

Sobre el total combinado de todas las líneas:

```
Total antes de volumen = Σ subtotales
Descuento volumen      = total × (1 − mult_volumen)   cuando mult < 1
Total final            = total antes de volumen × mult_volumen
```

El multiplicador de volumen cuenta **cuántas líneas/torneos** tiene la cotización (1–2, 3–5 o 6+), no se aplica por línea.

## Parámetros default (editables, persistidos)

| Parámetro | Default |
| --- | --- |
| Precio base / equipo | $200 MXN |
| Duración hasta 3 meses | ×1.0 |
| Duración 4–6 meses | ×1.6 |
| Duración 7–12 meses | ×2.6 |
| Volumen 1–2 torneos | ×1.0 |
| Volumen 3–5 torneos | ×0.9 |
| Volumen 6+ torneos | ×0.8 |

Si la tabla está vacía la primera vez, `get_platform_pricing_defaults` devuelve estos defaults de código.

## Persistencia (Migration 028)

**Tabla:** `platform_pricing_defaults` — fila singleton (`id = 1`). `REVOKE ALL` + RLS sin policies (mismo patrón que `platform_staff`).

**RPCs (solo `is_platform_staff`):**

| RPC | Rol |
| --- | --- |
| `get_platform_pricing_defaults()` | Lee valores guardados o defaults de código |
| `set_platform_pricing_defaults(...)` | Upsert + `updated_by_profile_id` |

**Frontend:** al cargar `/plataforma/cotizador` trae params vía RPC; al editar, autoguardado con debounce 800 ms.

**NO persiste:** líneas de torneo, nombre de cliente en PDF.

## PDF (client-side)

- Botón «Descargar PDF» — `jspdf` + `jspdf-autotable`, bajo demanda.
- Texto ASCII-safe: `≤` → «hasta», guiones/en-dash → `-`, `×` → `x`, comillas tipográficas → rectas; fecha `YYYY-MM-DD`.
- Usa `PLATFORM_NAME`; nombre de cliente opcional (texto libre).

## Seguridad

- Gate idéntico a `/plataforma/facturacion`: `requireUser()` + `isPlatformStaff()` → `notFound()` si no es staff.
- Sin SELECT/INSERT directo en `platform_pricing_defaults` para authenticated.
- Sin localStorage.

## Archivos

| Archivo | Rol |
| --- | --- |
| `supabase/migrations/20260724000000_platform_pricing_defaults.sql` | Tabla + RPCs |
| `supabase/tests/028_platform_pricing_defaults.sql` | 6 tests SQL |
| `src/lib/platform-billing/queries.ts` | `getPlatformPricingDefaults` |
| `src/lib/platform-billing/actions.ts` | `setPlatformPricingDefaultsAction` |
| `src/lib/platform-billing/cotizador-pdf.ts` | PDF ASCII-safe |
| `src/components/platform-billing/PlatformCotizadorPanel.tsx` | UI + debounced save |

## Verificación

- `npm run lint` ✅
- `npm run build` ✅
- `npm test` ✅ (84 tests, incl. PDF ASCII)
- SQL: `supabase/tests/028_platform_pricing_defaults.sql` — outsider rechazado, staff get/set OK

## Fuera de alcance (confirmado)

Persistencia de cotizaciones/líneas, localStorage, logo en PDF, acceso no-staff.

## Commits

- `ebb3724` — release inicial cotizador
- `ddd9d94` — multi-línea, bandas duración, PDF
- *(actualizar tras push Migration 028)*
