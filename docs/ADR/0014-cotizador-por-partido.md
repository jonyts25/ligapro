# ADR 0014 — Cotizador por partido (staff plataforma)

**Estado:** Aceptado  
**Migration:** `20260808200000_cotizador_tier_teams_jornada.sql` (sección cotizador: solo frontend)

## Contexto

El cotizador interno (`/plataforma/cotizador`) usaba precio por equipo multiplicado por bandas de duración (≤3m ×1.0, 4–6m ×1.6, 7–12m ×2.6) y descuento por cantidad de torneos en la cotización. El modelo comercial evoluciona a **precio por volumen de partidos/mes**, con banda por costo de cancha y descuento por portafolio de torneos activos simultáneos.

## Decisiones

### 1. Fórmula de partidos

- **Fase regular:** `combinaciones(equipos) × vueltas`, donde vueltas ∈ {1, 2} (una vuelta / ida y vuelta). Combinaciones = `n × (n−1) / 2`.
- **Liguilla:** siempre a partido único. Partidos = `clasificados − 1`, más 1 si hay partido por el tercer lugar (solo si clasificados ≥ 4).
- **Total partidos** = regular + liguilla. **Partidos/mes** = total ÷ duración en meses.

### 2. Tiers por volumen (partidos/mes)

| Tier | Rango | Precio base mensual (MXN) |
| --- | --- | --- |
| S | ≤ 20 | 900 |
| M | 21–40 | 1 400 |
| L | 41–70 | 2 000 |
| XL | > 70 | 2 000 + (partidos_mes − 70) × 20 |

### 3. Banda costo de cancha (multiplicador sobre tier)

| Costo reportado / partido | Multiplicador |
| --- | --- |
| ≤ $300 | ×1.0 |
| $301–600 | ×1.15 |
| $601+ | ×1.3 |

### 4. Descuento portafolio (torneos activos simultáneos / mes)

| Torneos activos | Descuento |
| --- | --- |
| 1–2 | 0 % |
| 3–4 | 8 % |
| 5–7 | 12 % |
| 8–10 | 15 % |

### 5. Fórmula final

```
precio_base = tier (o fórmula XL)
precio_con_banda = precio_base × mult_cancha
precio_mensual_final = precio_con_banda × (1 − descuento_portafolio)
precio_temporada = precio_mensual_final × meses
precio_por_equipo_temporada = precio_temporada ÷ equipos
```

### 6. Implementación

- Cálculo **100 % en cliente**; no se persiste la cotización en BD (igual que las líneas del cotizador anterior).
- La tabla `platform_pricing_defaults` (Migration 028) **no se elimina** pero deja de alimentar el cotizador; el nuevo modelo usa constantes fijas en código (`src/lib/platform-billing/cotizador.ts`).
- UI: inputs equipos, vueltas, liguilla, tercer lugar, meses, costo cancha, torneos activos. Output cliente: precio mensual, temporada, por equipo. Desglose interno (partidos, tier, banda, descuento) marcado **«No mostrar al cliente»**.
- Gate: `is_platform_staff` (ADR-0012), sin cambios.

## Consecuencias

- Staff debe recalcular manualmente; no hay historial de cotizaciones.
- PDF export se adapta al nuevo desglose (solo líneas visibles al cliente).

## Fuera de alcance

Persistencia de cotizaciones, integración con `organizations.sold_by`, API de precios dinámicos.

---

## Nota de cambio de modelo (2026-09-27)

El cotizador interno **volvió al precio por torneo y por equipo inscrito, sin mensualidad**
(`feat/0.4-pricing-per-tournament`). La fórmula vigente es:

```
precio_torneo = base_price_per_tournament + (base_price_per_team × equipos)
precio_final = precio_torneo × multiplicador_volumen(torneos activos)
```

Los parámetros se leen de `platform_pricing_defaults` (columna nueva
`base_price_per_tournament` + `base_price_per_team` + multiplicadores de volumen).

**No confundir** con `organizations.plan_tier` / `subscription_tier`: esos tiers siguen
gating features Premium (p. ej. avisos de partido, resumen de jornada IA), no el precio
de venta del cotizador PDF.

El modelo intermedio por tiers mensuales según partidos/mes (secciones 1–5 arriba) quedó
**obsoleto para ventas**; se conserva en este ADR como historial.
