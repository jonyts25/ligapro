# ADR 0014 — Cotizador interno por partido

**Estado:** Aceptado  
**Migration:** N/A (cálculo solo en cliente)

## Contexto

El cotizador en `/plataforma/cotizador` usaba precio por equipo multiplicado por
bandas de duración (≤3m ×1.0, 4–6m ×1.6, 7–12m ×2.6) y descuento por cantidad
de torneos en la cotización. El modelo comercial cambia a precio por volumen de
partidos/mes, con multiplicador por costo de cancha y descuento por portafolio
de torneos activos simultáneos.

## Decisiones

### 1. Fórmula de partidos

- **Fase regular:** `C(n,2) × vueltas` donde `vueltas` ∈ {1, 2}.
- **Liguilla:** partido único; partidos = `clasificados − 1`, +1 si hay partido
  por el tercer lugar (solo si clasificados ≥ 4). Clasificados ∈
  {0 (ninguna), 4, 8, 16}.
- **Partidos/mes** = total ÷ duración en meses.

### 2. Tiers y bandas (valores fijos en código)

| Tier | Partidos/mes | Base mensual MXN |
| --- | --- | --- |
| S | ≤ 20 | 900 |
| M | 21–40 | 1 400 |
| L | 41–70 | 2 000 |
| XL | > 70 | 2 000 + (partidos_mes − 70) × 20 |

Multiplicador por costo de cancha reportado (MXN/partido):

| Rango | Mult. |
| --- | --- |
| ≤ 300 | ×1.0 |
| 301–600 | ×1.15 |
| 601+ | ×1.3 |

Descuento portafolio (torneos activos simultáneos del organizador ese mes):

| Torneos | Desc. |
| --- | --- |
| 1–2 | 0% |
| 3–4 | 8% |
| 5–7 | 12% |
| 8–10 | 15% |

Fórmula final:

```
precio_base → tier
precio_con_banda = precio_base × mult_cancha
precio_mensual = precio_con_banda × (1 − desc_portafolio)
precio_temporada = precio_mensual × meses
precio_por_equipo = precio_temporada ÷ equipos
```

### 3. UI y persistencia

- Reemplaza la UI de líneas múltiples por un solo torneo con inputs: equipos,
  vueltas, liguilla, tercer lugar, meses, costo cancha, torneos activos.
- Output cliente: mensual, temporada, por equipo.
- Desglose interno (partidos, tier, banda, descuento) marcado explícitamente
  como no mostrar al cliente.
- **No se persiste** en BD; igual que el cotizador actual para líneas.
- La tabla `platform_pricing_defaults` y sus RPCs **permanecen** (otros flujos
  podrían referirlas); el panel deja de editarlas hasta nuevo aviso.

### 4. PDF

- Se adapta al nuevo resultado (precios mensual/temporada/equipo + desglose
  interno opcional en sección staff).

## Consecuencias

- Staff recalcula con reglas explícitas y auditables en código/tests.
- Cambiar tiers requiere deploy, no SQL.

## Fuera de alcance

- Persistir cotizaciones o vincularlas a organizaciones.
- Integración con facturación de plataforma (`platform_billing_status`).
