# Migration 007 Report — Discipline Suspensions

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712224935_create_discipline_suspensions.sql` |
| Tests | `supabase/tests/007_discipline_suspensions.sql` |
| Tipos TS | `src/types/database.ts` (regenerados) |
| Domain model | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_007_REPORT.md` |

### Objetos

- Tabla `discipline_suspensions`
- Triggers: org-vs-stp, source-event-same-player, `set_updated_at`
- Trigger `match_events_generate_discipline_suspensions` (AFTER INSERT, SECURITY DEFINER)
- RLS: members SELECT; owner/admin CRUD; sin anon

## Lógica de acumulación de amarillas

Query exacta en el trigger (tras resolver `v_season_id` / `v_yellow_limit` / `v_suspension_matches` vía stp → season_teams → season_rules):

```sql
SELECT count(*)::integer INTO v_yellow_count
FROM public.match_events me
JOIN public.season_team_players stp ON stp.id = me.season_team_player_id
JOIN public.season_teams st ON st.id = stp.season_team_id
WHERE me.event_type = 'yellow_card'
  AND me.season_team_player_id = NEW.season_team_player_id
  AND st.season_id = v_season_id;

IF v_yellow_count > 0 AND (v_yellow_count % v_yellow_limit) = 0 THEN
  -- INSERT accumulation con source_match_event_id = NEW.id
END IF;
```

- Filtra por **el mismo** `season_team_player_id` → no mezcla jugadores.
- Join a `st.season_id = v_season_id` → no mezcla temporadas (aunque el mismo `players.id` tenga otro STP en otra season).
- El conteo incluye el evento recién insertado (AFTER INSERT).

### Evidencia pruebas críticas

| Test | Resultado | Details |
|------|-----------|---------|
| **6** solo en el múltiplo exacto | **PASS** | limit=2; 0 suspensiones tras yellow#1; 1 tras yellow#2; source = yellow#2; remaining=3 |
| **7** no segunda hasta siguiente múltiplo | **PASS** | tras yellow#3 (count=3) accumulation_rows=1 (siguiente en 4) |
| **9** aislamiento por season | **PASS** | mismo `player_id`; season_a tiene accumulation; season_a2 con 1 amarilla → accumulation_rows=0 |

## SECURITY DEFINER vs RLS

El INSERT automático en `discipline_suspensions` corre como SECURITY DEFINER: no exige que quien insertó el `match_event` tenga permiso RLS de escritura en suspensiones. La creación/ajuste manual (administrative, served) sí requiere owner/admin.

## Nota: matches_remaining

Es **informativo/manual** en este bloque. Admin puede bajar `matches_remaining` y poner `status = 'served'`. El descuento automático por partido jugado queda pendiente hasta un generador de fixture con orden de jornada confiable.

## Decisiones

1. CHECK: `source_match_event_id` obligatorio salvo `administrative`.
2. `red_card` → siempre `direct_red` con `season_rules.suspension_matches`.
3. Sin descuento automático, apelaciones, ni `season_roles`.

## Flujo

```text
supabase migration new create_discipline_suspensions
→ editar
→ supabase db push --linked
```

Timestamp: `20260712224935` (local = remoto).

## Resultado de pruebas (todas)

| Test | Resultado | Details |
|------|-----------|---------|
| 1 aislamiento | **PASS** | suspensions_visible=0 |
| 2 member bloqueado | **PASS** | RLS |
| 3 administrative NULL source | **PASS** | id insertado |
| 4 direct_red sin source | **PASS** | source_event_required_check |
| 5 red_card auto | **PASS** | direct_red remaining=3 |
| 6 acumulación en múltiplo | **PASS** | ver arriba |
| 7 no segunda prematura | **PASS** | ver arriba |
| 8 no mezcla jugadores | **PASS** | shared_s1 tras 1 yellow = 0 |
| 9 no mezcla seasons | **PASS** | ver arriba |
| 10 source de otro jugador | **PASS** | same player trigger |
| 11 update manual served | **PASS** | remaining=0 status=served |

**11/11 PASS**

## Desviaciones

1. Ninguna funcional.
2. Warning Docker en `db push` (cache); push remoto OK.

## Pendiente siguiente

- Descuento automático de `matches_remaining` (fixture)
- `season_roles` + captura por oficiales
- `team_charges` / pagos / vistas públicas

Commit pendiente de aprobación humana.
