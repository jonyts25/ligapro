# Feature — Cotizador interno de precio (platform staff)

**Ruta:** `/plataforma/cotizador`  
**ADR:** `docs/ADR/0012-staff-plataforma-facturacion.md` (mismo gate `is_platform_staff`)

## Qué es

Calculadora hipotética de precio por torneo para staff LigaPro. Toda la lógica vive en React state del cliente; **no hay tabla, RPC ni persistencia**.

## Fórmula

```
Precio por torneo = precio_base_por_equipo × n_equipos × mult_duración × mult_volumen
Total acumulado   = precio por torneo × n_torneos   (si n_torneos > 1)
```

Defaults editables en UI (no fijos en código):

| Parámetro | Default |
| --- | --- |
| Precio base / equipo | $200 MXN |
| Duración corta (≤ 3 meses) | ×1.0 |
| Duración larga (> 3 y ≤ 6 meses) | ×1.6 |
| Volumen 1–2 torneos | ×1.0 |
| Volumen 3–5 torneos | ×0.9 |
| Volumen 6+ torneos | ×0.8 |

## Seguridad

- Gate idéntico a `/plataforma/facturacion`: `requireUser()` + `isPlatformStaff()` → `notFound()` si no es staff.
- Fuera de `/organizaciones/...`; sin enlace para roles de org normales.
- Nav interno solo visible vía `PlatformStaffLink` / `PlatformStaffNavLink` (ya filtrados por staff).

## Archivos

| Archivo | Rol |
| --- | --- |
| `src/app/(protected)/plataforma/cotizador/page.tsx` | Página server con gate |
| `src/components/platform-billing/PlatformCotizadorPanel.tsx` | Formulario + resultado reactivo |
| `src/lib/platform-billing/cotizador.ts` | Aritmética pura + defaults |
| `src/lib/platform-billing/cotizador.test.ts` | 5 tests unitarios |
| `src/components/platform-billing/PlatformPlataformaNav.tsx` | Tabs Facturación / Cotizador |
| `src/components/platform-billing/PlatformStaffLink.tsx` | Enlaces actualizados |

## Verificación

- `npm run lint` ✅
- `npm run build` ✅ (ruta `/plataforma/cotizador` en output)
- `npm test` ✅ (79 tests, incl. cotizador)

## Fuera de alcance (confirmado)

Schema/RPC, persistencia, datos reales de clientes, acceso no-staff.

## Commit

`fa860ce` — feat(plataforma): cotizador interno de precio para platform staff
