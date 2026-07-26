# ADR 0010 — Foto de jugador (opcional) y credencial virtual

## Estado

Aceptado — Migration 024

## Contexto

Las ligas necesitan identificar jugadores en cancha sin imprimir credenciales físicas en esta fase. La foto es opcional: los flujos de alta existentes (admin y capitán) no deben exigirla.

## Decisión

1. **Columna** `players.photo_path` (nullable) — path en Storage, nunca URL pública.
2. **Bucket privado** `player-photos` — mismo límite MIME/tamaño que `organization-logos`, pero `public = false`.
3. **Path:** `{organizationId}/{playerId}/{assetUuid}.{png|jpg|jpeg|webp}`.
4. **Escritura** vía `set_player_photo` — owner/admin o capitán/subcapitán activo del plantel del jugador (Migration 021).
5. **Lectura de bytes** (Storage SELECT) acotada por `can_view_player_photo`:
   - Miembros de la organización.
   - Capitán/subcapitán vinculado del equipo del jugador.
   - Oficial confirmado (`referee`/`delegate`/`scorekeeper`) **solo** para jugadores en el roster de un partido donde tiene asignación confirmada — misma lógica que `can_capture_match` / `match_officials`.
6. **Frontend:** pantalla de credencial virtual de solo lectura (sin PDF, sin imprimir, sin exportar).
7. **Fuera de alcance:** exposición en páginas públicas F8, foto obligatoria, acceso de oficiales fuera de sus partidos.

## Consecuencias

- Las credenciales se muestran en la app con signed URLs del bucket privado.
- `get_public_season_*` no se modifican ni exponen `photo_path`.
- Impresión/PDF queda para un prompt futuro.
