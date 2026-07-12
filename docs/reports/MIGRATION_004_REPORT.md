# Migration 004 Report — Teams, Players & Rosters

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712213431_create_teams_players_rosters.sql` |
| Tests de aislamiento | `supabase/tests/004_teams_players_isolation.sql` |
| Tipos TS regenerados | `src/types/database.ts` |
| Domain model actualizado | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_004_REPORT.md` |

### Objetos de base de datos

- Tablas: `teams`, `players`, `season_teams`, `season_team_players`
- Triggers de consistencia org en `season_teams` (vs season + team) y `season_team_players` (vs season_team + player)
- UNIQUE parciales: un profile por org en `players`; un capitán por `season_team`; jersey único por plantel
- CHECK: capitán solo si `registration_status = 'active'`
- RPC: `set_season_team_captain(p_season_team_id, p_player_id)`
- RLS reutilizando `is_member_of` / `has_role_in_org`; sin anon/público

## Decisiones tomadas

1. **Capitán solo en `is_captain`** — sin `season_role` de captain (congelado).
2. **`profile_id` opcional** en players; UNIQUE parcial por org cuando no es NULL.
3. **CRUD** de las cuatro tablas: solo owner/admin. Members: SELECT.
4. **Permisos de capitán a nivel RLS** no implementados — bloque futuro con `season_roles`.
5. **UPDATE directo de `is_captain` permitido por policy** (owner/admin), pero la app debe usar la RPC por atomicidad. La UNIQUE parcial + CHECK son la red de seguridad si alguien hace UPDATE directo incorrecto.

## Atomicidad de `set_season_team_captain`

La función es `SECURITY DEFINER` con `search_path = public` y, en una sola transacción:

1. Exige `auth.uid()` y rol `organization_owner` / `organization_admin` vía `has_role_in_org`.
2. Verifica que `p_player_id` esté en el plantel y con `registration_status = 'active'`.
3. `UPDATE … SET is_captain = false` en el capitán actual (si existe y no es el mismo player).
4. `UPDATE … SET is_captain = true` en el nuevo capitán.

Ese orden evita violar el UNIQUE parcial `WHERE is_captain = true` ni un instante. Dos UPDATEs sueltos desde el cliente podrían chocar con la constraint.

## Flujo de migración

```text
supabase migration new create_teams_players_rosters
→ editar
→ supabase db push --linked
```

Timestamps local/remoto: `20260712213431`.

## Resultado de pruebas (Tarea H)

```bash
npx supabase db query --linked -f supabase/tests/004_teams_players_isolation.sql
```

| Test | Resultado | Details |
|------|-----------|---------|
| 1a–1d aislamiento cross-org | **PASS** | `*_visible=0` |
| 2 Member no crea team | **PASS** | RLS |
| 3 Admin flujo completo | **PASS** | team+players+roster |
| 4a/4b season_team org mismatch | **PASS** | vs season / vs team |
| 5a/5b roster org mismatch | **PASS** | vs season_team / vs player |
| 6 Segundo capitán UPDATE directo | **PASS** | UNIQUE one_captain |
| 7 RPC cambia capitán | **PASS** | `captain_count=1` correcto |
| 8a/8b RPC validaciones | **PASS** | no roster / not active |
| 9 Capitán inactive CHECK | **PASS** | captain_must_be_active |
| 10 Player duplicado en plantel | **PASS** | UNIQUE |
| 11 Jersey duplicado | **PASS** | UNIQUE parcial |
| 12a/12b profile por org | **PASS** | UNIQUE parcial / cross-org OK |

**19/19 PASS**

## Desviaciones

1. Ninguna funcional.
2. Warning Docker en `db push` (cache local); push remoto OK.
3. Test 9 ajustado para limpiar capitán previo antes del UPDATE (si no, UNIQUE enmascara el CHECK).

## Aplicación

- Proyecto: `ligapro-dev` (`akgcamaegpboewsbbevl`)
- Migración: `create_teams_players_rosters` (`20260712213431`)

## Pendiente / fuera de alcance

- matches, match_events, discipline, field_reservations
- season_roles / permisos RLS de capitán
- vistas públicas / UI
- Commit pendiente de aprobación humana
