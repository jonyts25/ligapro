# Migration 023 — Verificación efímera + candado de transferencia

**Archivo:** `supabase/migrations/20260718000000_ephemeral_verification_transfer_lock.sql`  
**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0009-verificacion-identidad-efimera.md`

## Objetivos

1. Verificación de identidad **sin almacenamiento de documentos** (Opción C, ADR 0009)
2. Candado de transferencia entre planteles en la misma season

## Confirmación explícita — sin documentos

Revisión del schema final de tablas nuevas:

| Tabla | Columnas | ¿Documento/archivo? |
| --- | --- | --- |
| `player_verification_reviews` | id, organization_id, player_id, status, reviewed_by_profile_id, reviewed_at, reason | **No** |
| `player_transfer_lock_releases` | id, organization_id, player_id, season_id, released_by_profile_id, released_at, reason | **No** |

Sin bucket de storage, sin `file_upload`, sin columnas de ruta/URL/imagen.

## 1. Verificación de identidad

| Cambio | Detalle |
| --- | --- |
| `season_rules.require_player_verification` | boolean NOT NULL default false |
| `players.verification_status` | `not_required` \| `pending` \| `approved` \| `rejected` |
| Trigger | `players_protect_verification_status` — solo RPC con flag `app.player_verification_update` |

### RPCs

| RPC | Actor | Efecto |
| --- | --- | --- |
| `request_player_verification(p_player_id)` | owner/admin o capitán/sub activo del plantel del jugador | `verification_status = pending`; rechaza si ya pending |
| `review_player_verification(p_player_id, p_approved, p_reason?)` | **solo owner/admin** | Inserta `player_verification_reviews`; actualiza status; motivo obligatorio si rechazo |

### Efecto en activación

Con `require_player_verification = true`: jugadores `pending`/`rejected` **no** se activan vía `add_player_to_season_team` / `set_season_team_player_status(..., 'active')`.  
`not_required` y `approved` sí. **Owner/admin bypass.**

Estado vive en `players` (persistente en org), no en `season_team_players`.

## 2. Candado de transferencia

| Cambio | Detalle |
| --- | --- |
| `season_rules.transfer_lock_days` | integer NOT NULL default 0 (0 = off) |
| Tabla | `player_transfer_lock_releases` — excepciones puntuales con motivo |
| RPC | `release_player_transfer_lock(p_player_id, p_season_id, p_reason)` — owner/admin |

### Criterio de fecha de liberación

**Elegido:** `season_team_players.updated_at` de la fila `inactive` más reciente en la season, en un `season_team` distinto al destino.

**Por qué:** es el timestamp que Postgres ya mantiene al cambiar status vía `deactivate_season_team_player` / `set_season_team_player_status`, sin columnas nuevas ni audit log. Refleja el momento en que el jugador quedó libre en ese plantel.

### Lógica

- Si `transfer_lock_days = 0` → no bloquea.
- Si activación en **mismo** `season_team` que la baja previa → no aplica candado de transferencia.
- Si hay `player_transfer_lock_releases.released_at >= updated_at` de la baja → capitán puede activar.
- **Owner/admin bypass** total.

Helper: `__assert_player_activation_allowed` — integrado en `add_player_to_season_team` y `set_season_team_player_status` (sin reescribir deactivate ni Migration 015).

## Pruebas

`supabase/tests/023_ephemeral_verification_transfer_lock.sql` — **15/15 PASS**

Incluye auditoría de schema (sin columnas documento/archivo).

## Tipos TS

`src/types/database.ts` regenerado.

## Docs actualizados

- `docs/TEAMS_AND_ROSTERS.md`
- `docs/DOMAIN_MODEL.md`

## Fuera de alcance (confirmado)

Storage de documentos, PDF/CSV, credenciales imprimibles, QR público, aprobación admin sobre altas del capitán, expiración automática de verificación.
