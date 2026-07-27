# Feature — Cotizador interno de precio (platform staff)

**Ruta:** `/plataforma/cotizador`  
**ADR:** `docs/ADR/0012-staff-plataforma-facturacion.md` (mismo gate `is_platform_staff`)

## Qué es

Calculadora hipotética de precio por torneo para staff LigaPro. Toda la lógica vive en React state del cliente; **no hay tabla, RPC ni persistencia**.

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

## Parámetros default (editables en UI)

| Parámetro | Default |
| --- | --- |
| Precio base / equipo | $200 MXN |
| Duración ≤ 3 meses | ×1.0 |
| Duración 4–6 meses | ×1.6 |
| Duración 7–12 meses | ×2.6 |
| Volumen 1–2 torneos | ×1.0 |
| Volumen 3–5 torneos | ×0.9 |
| Volumen 6+ torneos | ×0.8 |

Curva de duración: más meses cuestan más en total, pero menos por mes (12 meses > 6 meses en total; precio/mes decrece).

## Mejoras (2026-07-27)

1. **Inputs numéricos** — seleccionan todo el valor al focus/click (`NumericInput` reutilizado en equipos y parámetros).
2. **Multi-torneo** — varias líneas con equipos/duración propios; agregar/quitar (mínimo 1); subtotal por línea + resumen de volumen combinado.
3. **Tres bandas de duración** — ≤3, 4–6, 7–12 meses (reemplaza corta/larga anterior).
4. **Export PDF** — botón «Descargar PDF» bajo demanda (`jspdf` + `jspdf-autotable`); usa `PLATFORM_NAME`, fecha, nombre opcional de cliente (texto libre), tabla de líneas y totales. Sin logo; no persiste.

## Seguridad

- Gate idéntico a `/plataforma/facturacion`: `requireUser()` + `isPlatformStaff()` → `notFound()` si no es staff.
- Fuera de `/organizaciones/...`; sin enlace para roles de org normales.
- PDF y cotización no conectados a organizaciones reales.

## Archivos

| Archivo | Rol |
| --- | --- |
| `src/app/(protected)/plataforma/cotizador/page.tsx` | Página server con gate |
| `src/components/platform-billing/PlatformCotizadorPanel.tsx` | Líneas, parámetros, resultado, PDF |
| `src/lib/platform-billing/cotizador.ts` | Aritmética pura + defaults |
| `src/lib/platform-billing/cotizador-pdf.ts` | Generación PDF client-side |
| `src/lib/platform-billing/cotizador.test.ts` | 6 tests unitarios |
| `src/components/platform-billing/PlatformPlataformaNav.tsx` | Tabs Facturación / Cotizador |

## Verificación

- `npm run lint` ✅
- `npm run build` ✅
- `npm test` ✅ (80 tests, incl. cotizador multi-línea y curva de duración)

## Fuera de alcance (confirmado)

Schema/RPC, persistencia, datos reales de clientes, logo en PDF, acceso no-staff.

## Commits

- `ebb3724` — feat(plataforma): cotizador interno de precio para platform staff (release inicial)
- `ddd9d94` — feat(cotizador): multi-line quotes, duration bands, PDF export
