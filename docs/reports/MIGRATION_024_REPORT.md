# Migration 024 — Foto de jugador (opcional) + credencial virtual

**Archivos:**
- `supabase/migrations/20260719000000_player_photos_virtual_credential.sql`
- `supabase/migrations/20260719000001_harden_can_view_player_photo.sql`

**Aplicada:** `npx supabase db push --linked` → OK  
**ADR:** `docs/ADR/0010-foto-jugador-credencial-virtual.md`

## Objetivos

1. Foto opcional por jugador en bucket privado `player-photos`
2. RPC `set_player_photo` con autorización owner/admin o capitán/sub activo
3. Lectura acotada vía `can_view_player_photo` + policies Storage
4. Pantalla de credencial virtual (solo lectura) en captura y portal capitán

## Schema y Storage

| Cambio | Detalle |
| --- | --- |
| `players.photo_path` | text nullable; CHECK path `{orgId}/{playerId}/{uuid}.ext` |
| Bucket `player-photos` | `public = false`, 2 MB, PNG/JPEG/WebP |
| `is_valid_player_photo_path` | Validación de path |
| `__can_set_player_photo` | Mismo actor que verificación/alta capitán (021) |
| `can_view_player_photo` | Org members (owner/admin/member sin rol oficial de temporada), capitán/sub del plantel, oficial confirmado solo en roster del partido |
| `set_player_photo` | SECURITY DEFINER; actualiza `photo_path` |

### Ajuste 024b — oficiales de temporada

Usuarios con `season_roles` en `referee`/`delegate`/`scorekeeper` **no** heredan lectura amplia por `is_member_of`: deben calificar vía asignación confirmada en `match_officials` (alineado con límite duro del prompt).

## RPCs

| RPC | Actor | Efecto |
| --- | --- | --- |
| `set_player_photo(p_player_id, p_photo_path)` | owner/admin o capitán/sub activo del plantel | Guarda o limpia path (NULL) |

## Storage RLS

| Operación | Quién |
| --- | --- |
| INSERT | `__can_set_player_photo` + path válido |
| SELECT | `can_view_player_photo` sobre `player_id` del path |
| DELETE | `__can_set_player_photo` |
| UPDATE | sin policy (no upsert) |

## Frontend

| Ruta / componente | Descripción |
| --- | --- |
| Captura → panel credenciales | `MatchRosterCredentials` — ambos equipos, signed URLs |
| `.../captura/jugadores/[seasonTeamPlayerId]` | Credencial solo lectura para capturadores |
| `/mi-equipo/.../jugadores/.../credencial` | Credencial capitán + uploader opcional |
| `CaptainRosterPanel` | Avatar, dorsal, badge verificación, enlace credencial |

**Fuera de alcance confirmado:** PDF, imprimir, exportar, foto obligatoria, exposición pública F8.

## Pruebas

`supabase/tests/024_player_photos_virtual_credential.sql` — **9/9 PASS**

| Test | Resultado |
| --- | --- |
| Capitán sube foto propio equipo | PASS |
| Capitán denegado otro equipo | PASS |
| Miembro org ve foto org | PASS |
| Miembro org denegado otra org | PASS |
| Oficial confirmado ve roster del partido | PASS |
| Oficial denegado fuera del partido | PASS |
| Asignado (no confirmado) denegado | PASS |
| Alta sin foto sin cambios | PASS |
| `get_public_season_*` sin `photo_path` | PASS |

## Tipos TS

`src/types/database.ts` regenerado.

## Docs actualizados

- `docs/TEAMS_AND_ROSTERS.md`
- `docs/MATCH_OPERATION_AND_CAPTURE.md`
- `docs/ADR/0010-foto-jugador-credencial-virtual.md`

## Verificación local

- `npm run lint` → OK
- `npm run build` → OK
- `npm test` → 51/51 OK

## Commit

`0f72c4c` — `feat(db): migration 024 — optional player photos and virtual credential`  
Push: `origin/main` OK
