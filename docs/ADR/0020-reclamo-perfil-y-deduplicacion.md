# ADR 0020 — Reclamo de perfil genérico y deduplicación por teléfono

**Estado:** Accepted — Paso 3.4  
**Migration:** `20261001100000_player_claim_and_phone_dedup.sql`  
**Reporte relacionado:** `docs/reports/3.4_REPORT.md`

## Contexto

`accept_captain_invitation` ya vincula `players.profile_id` al aceptar una invitación, sin exigir rol de capitán en el acto de aceptación. Sin embargo, `invite_captain_to_roster` solo permite invitar filas marcadas como capitán o vicecapitán, aunque el mecanismo subyacente (`captain_invitations`) es genérico.

Cada alta de jugador (admin, capitán o importador) crea un **nuevo** registro `players` con `profile_id = NULL`. La misma persona física puede acumular varios `players` dentro de una organización si se da de alta en distintos equipos o temporadas.

`players.phone` (backlog agosto) es la única señal opcional de identidad además del nombre. ADR-0003 mantiene el jugador **por organización**; este paso no introduce perfil nacional ni identidad cross-org.

## Decisión

### 1. Invitación genérica a reclamar perfil

Nueva RPC `invite_player_to_roster(p_season_team_player_id, p_email)` — clon de `invite_captain_to_roster` **sin** la restricción `is_captain / is_vice_captain`. Misma autorización (solo `organization_owner` / `organization_admin`), TTL 7 días, cancelación de invitación pendiente previa.

`invite_captain_to_roster` **no se modifica**; `create_captain_player_with_invitation` sigue usándola sin cambios.

La UI de plantel ofrece «Invitar a reclamar su perfil» a **cualquier** jugador activo sin `profile_id`. La ruta `/invitacion/[token]` no cambia.

### 2. Deduplicación por teléfono con confirmación explícita

Nueva RPC `find_potential_duplicate_player(p_organization_id, p_phone)` — solo admin/owner de esa org. Sin teléfono → vacío. Busca `players` de la misma organización con `phone` igual (comparación `btrim`; no hay normalización adicional en el proyecto hoy).

Nueva RPC `add_existing_player_to_roster(...)` — agrega un `player_id` existente al plantel con las mismas validaciones operativas (cupo, dorsal, activación en torneo), **sin** crear fila nueva en `players`. Rechaza si el jugador ya tiene fila en **ese** `season_team`.

En el formulario de alta **individual** (no bulk, no Excel):

1. Si hay teléfono, antes de crear se consulta `find_potential_duplicate_player`.
2. Si hay coincidencia, se muestra tarjeta con nombre, equipos (`teams_count`), estado reclamado/no — y dos acciones explícitas del usuario.
3. «Es la misma persona» → `add_existing_player_to_roster`.
4. «Es alguien distinto» → flujo normal `create_player_and_add_to_roster`.
5. Sin teléfono o sin coincidencia → flujo actual sin paso extra visible.

**Nunca** deduplicación automática o silenciosa: un número puede estar mal capturado o pertenecer a otra persona.

### 3. Fuera de alcance

- Importador Excel (0.3) y alta masiva «pegar lista»: siguen creando jugadores nuevos sin deduplicar (pendiente separado).
- Perfil nacional / identidad cross-organización (ADR-0003).
- Transferencia de propiedad u otros flujos de auth (paso 3.1).

## Consecuencias

- Cualquier jugador de la org puede recibir invitación de reclamo; capitanes conservan flujo legacy intacto en DB.
- Admins ven posibles duplicados solo dentro de la misma organización.
- Reducción de registros duplicados depende de que admin/capitán capture teléfono y confirme explícitamente.
- Bulk y Excel pueden seguir generando duplicados hasta un paso futuro.
