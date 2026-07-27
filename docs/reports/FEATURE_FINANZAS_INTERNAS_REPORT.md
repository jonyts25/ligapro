# Feature — Finanzas internas de plataforma (staff)

**Ruta:** `/plataforma/finanzas`  
**Migration:** 029 (`20260728000000_platform_internal_finance.sql`)  
**ADR:** `docs/ADR/0012-staff-plataforma-facturacion.md` (gate `is_platform_staff`)

## Qué es

Registro manual de ingresos y egresos del negocio para staff LigaPro. **Control interno informal** — no sustituye contabilidad fiscal, RESICO ni obligaciones SAT. Sin integración a pasarelas de pago.

## Schema (Migration 029)

| Tabla | Uso |
| --- | --- |
| `platform_income_entries` | Ingresos manuales; `season_id` nullable |
| `platform_expense_entries` | Egresos por categoría (`hosting`, `herramientas`, `marketing`, `otro`) |

Ambas: `REVOKE ALL` + RLS sin policies. Inmutables salvo anulación vía RPC (`app.platform_financial_void`).

## RPCs (solo platform staff)

| RPC | Rol |
| --- | --- |
| `record_platform_income(p_season_id, p_amount, p_notes?)` | Alta ingreso (temporada opcional) |
| `void_platform_income_entry(p_entry_id, p_reason)` | Anulación con motivo |
| `record_platform_expense(p_category, p_amount, p_notes?)` | Alta egreso |
| `void_platform_expense_entry(p_entry_id, p_reason)` | Anulación con motivo |
| `get_platform_finance_summary(p_year, p_month)` | Totales + listas del mes (jsonb) |

**Resumen mensual:** totales excluyen registros anulados; las tablas muestran también filas anuladas con motivo (auditoría).

## Frontend

- **`/plataforma/finanzas`** — selector mes/año, totales, tablas, formularios ingreso suelto / egreso, anular con motivo.
- **`/plataforma/facturacion`** — al marcar **pagado**, campo opcional «Monto ingreso» llama `record_platform_income` si se llena (independiente del candado de billing).
- Nav staff actualizado (Facturación · Cotizador · Finanzas).

## Seguridad

- Gate idéntico al resto de `/plataforma/...`.
- Owner/admin de org rechazados en RPCs.
- Sin UPDATE/DELETE directo en tablas.

## Tests SQL

`supabase/tests/029_platform_internal_finance.sql` — 8 casos:

- Outsider/owner/admin rechazados
- Staff registra ingresos por temporada + sueltos
- Resumen suma solo no anulados
- Void sin motivo falla
- Anulación excluye del total
- Sin SELECT directo en tablas

## Verificación

- `npm run lint` ✅
- `npm run build` ✅ (ruta `/plataforma/finanzas`)

## Aplicar migración

```bash
npx supabase db push --linked
```

O pegar `supabase/migrations/20260728000000_platform_internal_finance.sql` en SQL Editor.

## Fuera de alcance (confirmado)

Pasarelas de pago, CFDI/fiscal, edición directa, acceso no-staff, presupuestos.

## Commit

`a0f1d67` — feat(029): platform internal finance ledger for staff
