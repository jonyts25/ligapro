# Migration 025 — Motor de eliminación directa (knockout)

**Archivo:** `supabase/migrations/20260720000000_knockout_bracket_engine.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0011-motor-eliminacion-directa-y-grupos.md`

## Objetivos

Motor de bracket para `format_type = 'knockout'`. Separado del round-robin existente. Fase de grupos (`groups_knockout`) queda para Migration 026.

## Decisiones de diseño

| Tema | Decisión |
| --- | --- |
| Penales | Tabla `season_knockout_ties.penalty_winner_season_team_id` por **llave**, no por partido — en ida-vuelta el desempate es del agregado |
| Byes | Fila en `season_knockout_ties` con un solo equipo; **sin** `matches` en esa ronda |
| Etiquetas de ronda | Auto-derivadas (`__knockout_round_label`) desde `bracket_size` + `round_number` |
| Rondas futuras | Solo `advance_knockout_round`; no pre-generar bracket vacío |
| Seeding | Aleatorio (`random`) en 025; cabezas de serie fuera de alcance |
| Desempate | Marcador o agregado; penales manuales admin; **sin** gol de visitante ni tiempo extra como dato |
| Integración | Partidos normales en `matches`; programación/captura/reagendado sin RPCs nuevas |

## Schema

- `season_knockout_rounds` — rondas con `bracket_size`, `is_two_legs`
- `season_knockout_ties` — llaves por `bracket_slot`
- `matches.knockout_round_id`, `matches.bracket_slot`

## RPCs

| RPC | Actor |
| --- | --- |
| `create_season_knockout_bracket` | owner/admin + billing gate |
| `configure_knockout_round` | owner/admin (solo partidos `scheduled`) |
| `set_knockout_tie_penalty_winner` | owner/admin (solo empate) |
| `advance_knockout_round` | owner/admin |
| `get_season_knockout_champion` | authenticated (lectura) |

## Público F8

`get_public_season_matches` — DROP + CREATE con columnas aditivas: `knockout_round_number`, `bracket_slot`, `leg_number`.

## Pruebas

`supabase/tests/025_knockout_bracket.sql` — **14/14 PASS**

Cubre: tamaños 5/6/10 equipos, byes, duplicados, ida-vuelta, penales, avance, emparejamiento por slot, billing, schedule knockout, campeón.

## Tipos TS

`src/types/database.ts` regenerado.

## Docs actualizados

- `docs/FIXTURE_AND_SCHEDULING.md`
- `docs/MATCH_OPERATION_AND_CAPTURE.md`
- `docs/DOMAIN_MODEL.md`
- `docs/STANDINGS_AND_PUBLIC_PAGES.md`
- `docs/ADR/0011-motor-eliminacion-directa-y-grupos.md`

## Fuera de alcance (confirmado)

Migration 026 (grupos), frontend bracket, seeding no aleatorio, gol de visitante, tiempo extra, QR/holograma credencial.

## Commit

`COMMIT_HASH_PLACEHOLDER` — `feat(db): add knockout bracket engine (migration 025)`  
Push: `origin/main`
