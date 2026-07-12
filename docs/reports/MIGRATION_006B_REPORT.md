# Migration 006b Report — Match Events

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712224116_create_match_events.sql` |
| Tests | `supabase/tests/006b_match_events_isolation.sql` |
| Tipos TS | `src/types/database.ts` (regenerados) |
| Domain model | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_006B_REPORT.md` |

### Objetos

- Tabla `match_events`
- Trigger `match_events_enforce_org_matches_match` (organization_id vs match padre)
- Trigger `match_events_enforce_player_on_match_roster` (jugador debe estar en home o away)
- RLS: members SELECT; owner/admin INSERT/UPDATE/DELETE; sin anon

## Pendiente crítico: captura por match_officials

**No implementado en este bloque.** RLS escribe solo owner/admin.

| Qué falta | Por qué no aquí | Depende de | Bloque futuro sugerido |
|-----------|-----------------|------------|------------------------|
| Que un árbitro/delegado con `match_officials.status = 'confirmed'` pueda INSERT/UPDATE eventos del partido | Hay que decidir cómo se relaciona el rol en cancha con membresía org y con permisos de temporada | `season_roles` (aún no existe) + política RLS sobre `match_officials` | Tras `season_roles` (o un bloque dedicado de permisos de captura) |

Este es el pendiente de producto más importante dejado por 006b: sin él, la captura real en cancha sigue siendo administrativa.

## Decisiones / notas

1. FK a `season_team_players`, no a `players` — coherente con roster por temporada.
2. Substitutions en el catálogo **sin** validación de alineación (revisión post-entrevistas).
3. Sin lógica de tarjetas acumuladas / `discipline_suspensions` — bloque siguiente.
4. Minute 0–130 (margen para tiempos extra / reglas no estándar).

## Flujo

```text
supabase migration new create_match_events
→ editar
→ supabase db push --linked
```

Timestamp: `20260712224116` (local = remoto).

## Resultado de pruebas

| Test | Resultado | Details |
|------|-----------|---------|
| 1 aislamiento org B | **PASS** | events_visible=0 |
| 2 member no crea evento | **PASS** | RLS policy |
| 3 admin goal válido | **PASS** | event_id insertado |
| 4 org ≠ match | **PASS** | must match matches.organization_id |
| 5 jugador de tercer equipo | **PASS** | must be on one of the two match teams |
| 6 event_type inválido | **PASS** | match_events_event_type_check |
| 7 minute negativo | **PASS** | match_events_minute_check |
| 8 minute > 130 | **PASS** | match_events_minute_check |
| 9 varios eventos mismo jugador | **PASS** | yellow_card + goal OK |
| 10a home player | **PASS** | substitution_out OK |
| 10b away player | **PASS** | substitution_in OK |

**11/11 PASS**

## Desviaciones

1. Ninguna funcional.
2. Warning Docker en `db push` (cache local); push remoto OK.

## Pendiente siguiente

- `discipline_suspensions` + reglas de acumulación de tarjetas
- `season_roles`
- RLS de captura por oficiales confirmados
- UI

Commit pendiente de aprobación humana.
