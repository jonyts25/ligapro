# Migration 026 — Fase de grupos (`groups_knockout`)

**Archivo:** `supabase/migrations/20260721000000_groups_knockout_phase.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**Depende de:** Migration 025 (motor knockout)  
**ADR:** `docs/ADR/0011-motor-eliminacion-directa-y-grupos.md`

## Objetivos

Implementar la fase de grupos para `format_type = 'groups_knockout'`: definición de grupos, asignación de equipos, fixture round-robin **por grupo**, standings aislados, clasificación a eliminatoria reutilizando el motor 025.

## Decisiones de diseño

| Tema | Decisión |
| --- | --- |
| Relación equipo→grupo | Columna `season_teams.season_group_id` FK nullable → `season_groups`. **No** se toca `season_teams.group_name` (informativo existente). |
| Partidos de grupo | `matches.season_group_id`; excluyente con `knockout_round_id`. |
| Índice jornada | Dos índices parciales: liga `(season_id, round_number, sequence)` sin grupo; grupo `(season_id, season_group_id, round_number, sequence)`. |
| Bracket desde grupos | RPC interna `__create_knockout_bracket_from_slots`; `create_season_knockout_bracket` (025) refactorizada para usarla. `generate_knockout_from_groups` permite matches de fase de grupos previos. |
| Fixture multi-grupo | Sin wrapper SQL; frontend llama `create_season_round_robin_fixture(..., p_group_id)` una vez por grupo (generador TS existente). |
| Clasificados | `season_rules.groups_advance_per_group` (nullable integer > 0). |

## Cruce R1 (regla implementada y límites)

1. **G = 2 grupos (cualquier K):** para cada posición `r` en `1..K`, empareja el equipo en posición `r` del grupo A (orden alfabético de nombres) contra posición `K+1-r` del grupo B. Ej.: K=2 → 1A vs 2B, 2A vs 1B.
2. **K = 1 y G par ≥ 2:** empareja 1º del grupo `i` contra 1º del grupo `i + G/2` (por orden alfabético).
3. **Fallback:** lista aleatoria de clasificados; cada par busca rival de **distinto grupo** si queda candidato; si no, acepta mismo grupo.

**Límites:** G impar con K>1, o K distinto por grupo, o empates en posiciones de clasificación no resueltos → fallback aleatorio. No hay solver de restricciones ni garantía de evitar mismo grupo en todos los casos del fallback.

## Schema

- `season_groups` — `(organization_id, season_id, name)` UNIQUE por season
- `season_teams.season_group_id`
- `matches.season_group_id`
- `season_rules.groups_advance_per_group`

## RPCs

| RPC | Actor |
| --- | --- |
| `set_season_groups` | owner/admin; reemplazo atómico de nombres; bloquea eliminar grupo con matches |
| `assign_teams_to_groups` | owner/admin |
| `create_season_round_robin_fixture(..., p_group_id default NULL)` | owner/admin + billing; scope por grupo opcional |
| `get_season_standings(p_season_id, p_group_id default NULL)` | miembros; excluye knockout |
| `generate_knockout_from_groups` | owner/admin + billing; falla si hay partidos de grupo sin resultado |
| `get_public_season_groups` | anon/authenticated |
| `get_public_season_standings(..., p_group_name default NULL)` | anon/authenticated |

## Pruebas

`supabase/tests/026_groups_knockout.sql` — **13/13 PASS** (primera ejecución post-migración)

Cubre: reemplazo atómico de grupos, rechazo al eliminar grupo con matches, aislamiento cross-org/season en asignación, fixture scoped por grupo, no-regresión liga simple, standings aislados, knockout rechaza fixture incompleto, cruce R1 sin mismo grupo (G=2 K=1), billing gate.

## Tipos TS

`src/types/database.ts` regenerado (`npx supabase gen types typescript --project-id akgcamaegpboewsbbevl`).

## Docs actualizados

- `docs/FIXTURE_AND_SCHEDULING.md`
- `docs/STANDINGS_AND_PUBLIC_PAGES.md`
- `docs/DOMAIN_MODEL.md`

## Fuera de alcance (confirmado)

Frontend grupos/bracket, algoritmo de cruce sofisticado, cambios a `group_name`, reescritura de motores round-robin/bracket.

## Commit

`6a51782` — `feat(db): add groups phase for groups_knockout format (migration 026)`  
Push: `origin/main`
