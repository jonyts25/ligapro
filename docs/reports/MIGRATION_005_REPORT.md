# Migration 005 Report — Field Reservations

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712214839_create_field_reservations.sql` |
| Tests | `supabase/tests/005_field_reservations_isolation.sql` |
| Tipos TS regenerados | `src/types/database.ts` |
| Domain model actualizado | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_005_REPORT.md` |

### Objetos

- Tabla `field_reservations`
- Trigger `field_reservations_enforce_org_matches_field`
- Constraint EXCLUDE `no_overlapping_reservations` (parcial `status = 'confirmed'`)
- RLS owner/admin CRUD; members SELECT; sin anon
- `match_id` uuid **sin FK** (pendiente Migration 006)

## Decisiones

1. **Única fuente de verdad** del calendario físico (ADR 0004) — no hay tabla paralela de blocks.
2. **EXCLUDE por field + rango**, no global; tipos distintos también se bloquean entre sí.
3. **Canceladas no bloquean** — `WHERE (status = 'confirmed')` en el EXCLUDE.
4. **Rangos `[)`** (default `tstzrange`) → slots consecutivos 17:00–18:00 y 18:00–19:00 OK.
5. **Generación automática** de reservations tipo `match` / roles tournament — futuro.

## Constraint EXCLUDE (detalle)

```sql
ALTER TABLE public.field_reservations
  ADD CONSTRAINT no_overlapping_reservations
  EXCLUDE USING gist (
    field_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  )
  WHERE (status = 'confirmed');
```

- Extensión requerida: `btree_gist` 1.7 (verificada previa; Postgres 17.6).
- WHERE parcial compatible; no se improvisó alternativa.

### Resultados críticos (pruebas 7–11)

| Test | Resultado | Details (reales) |
|------|-----------|------------------|
| 7 Traslape parcial mismo field (18:00–19:30 vs 19:00–20:00) | **PASS** | `conflicting key value violates exclusion constraint "no_overlapping_reservations"` |
| 8 Traslape cross-type (match 18–20 vs maintenance 19–19:30) | **PASS** | `conflicting key value violates exclusion constraint "no_overlapping_reservations"` |
| 9 Consecutivos 17–18 y 18–19 | **PASS** | ambas filas insertadas (`first=… second=…`) |
| 10 Mismo horario, fields distintos | **PASS** | ambas filas insertadas |
| 11 Cancelada libera horario | **PASS** | `cancelled=… new_confirmed=…` |

## Flujo

```text
supabase migration new create_field_reservations
→ editar
→ supabase db push --linked
```

Timestamp local/remoto: `20260712214839`.

## Resultado completo de pruebas

| Test | Resultado | Details |
|------|-----------|---------|
| 1 A no lee reservations B | **PASS** | `reservations_visible=0` |
| 2 Member no crea | **PASS** | RLS |
| 3 Admin crea maintenance | **PASS** | id insertado |
| 4 Org ≠ field | **PASS** | must match fields.organization_id |
| 5 ends_at ≤ starts_at | **PASS** | time_range_check |
| 6 type inválido | **PASS** | reservation_type_check |
| 7–11 (EXCLUDE) | **PASS** | ver sección arriba |

**11/11 PASS**

## Desviaciones

1. Ninguna funcional sobre la constraint.
2. Warning Docker en `db push` (cache); push remoto OK.
3. **Pendiente de proceso:** Migration 004 sigue aplicada en remoto pero **sin commit local** al momento de este bloque; 005 se aplicó encima del schema remoto.

## Pendiente Migration 006

- Tabla `matches` (+ officials/events según alcance)
- `ALTER TABLE field_reservations ADD CONSTRAINT … FOREIGN KEY (match_id) REFERENCES matches(id)`
- CHECK opcional: `reservation_type <> 'match' OR match_id IS NOT NULL`

## Aplicación

- Proyecto: `ligapro-dev` (`akgcamaegpboewsbbevl`)
- Migración: `create_field_reservations` (`20260712214839`)

Commit pendiente de aprobación humana.
