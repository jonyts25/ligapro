# PR Review + Merge de 4 features (backlog Ligera) — Report

**Fecha:** 2026-08-15
**Alcance:** Revisión de código, merge a `main` y despliegue de 4 features generadas por Cursor a partir del backlog de producto (ver `claude/backlog.md` y `claude/prompts-cursor-ligapro.md` en el proyecto "Liga Pro" de Claude).
**Supabase:** `ligapro-dev` (`akgcamaegpboewsbbevl`) — beta/staging, no producción definitiva.
**Railway:** `LigaPro - Dev` (`445342ba-3faa-4656-b59f-4820f97f76f2`) / servicio `ligapro` (`22ff647f-06a9-4616-a10d-e28799613859`).

Revisión de código y verificación de deploy hechas por Claude (Cowork). Implementación de features y fixes hecha por Cursor. Claude no tiene permiso de push a este repo — todos los commits fueron hechos y subidos por Cursor a petición de Jonathan.

---

## 1. Features mergeadas a `main`

Orden de integración (elegido para minimizar conflictos, cada rama se rebaseó/mergeó contra el `main` más reciente antes de la siguiente):

| # | Branch | Merge commit | Qué hace |
|---|--------|---------------|----------|
| 1 | `feat/season-publish-simplify-visibility` | `b62850f` | Simplifica estados de temporada (deja solo Borrador/Pública), agrega acción `publishSeasonAction` gateada por el checklist de readiness, borrado de temporadas/torneos vacíos, dashboard interno `/plataforma` con lista de temporadas publicadas recientemente. |
| 2 | `feat/team-confirm-roster-lock` | `c883254` | Acción `confirmTeamRegistrationAction` (bloquea sobrecupo contra `max_roster_size`, activa `roster_locked_by_captain` vía `set_roster_lock`), edición de dorsal por el capitán mientras el plantel no esté bloqueado. |
| 3 | `feat/player-phone-whatsapp` | `f83ad74` | Guarda `players.phone`, botón "Contactar por WhatsApp" para el admin en la ficha del equipo. |
| 4 | `feat/youth-competition-name-redaction` | `13e495e` | Bandera `competitions.is_youth`, redacción de nombres de jugadores ("Nombre I.") en páginas públicas (goleadores, disciplina, eventos de partido) y en el prompt de la crónica de partido con IA. |

`main` en `origin` tras el merge: `13e495e` (incluye también `350f657`, la feature de cotizador/premium/resumen de jornada, ya presente en main antes de este trabajo).

## 2. Bugs encontrados en revisión y su corrección

Todos corregidos por Cursor a petición de Claude, verificados por Claude antes/después de mergear.

| Bug | Dónde | Fix | Commit |
|-----|-------|-----|--------|
| Overload de Postgres: `create_player_and_add_to_roster` quedaba con dos firmas (4 y 5 args) tras un `CREATE OR REPLACE` con distinta aridad; combinado con `p_phone: phoneRaw \|\| undefined` (que borra la llave del JSON), las altas sin teléfono caían en la firma vieja, a la que la misma migración le había revocado el `EXECUTE` → error de permisos. | `supabase/migrations/20260808100004_players_phone.sql` | `DROP FUNCTION` de la firma de 4 args antes del `CREATE OR REPLACE` de 5. | `4e01e49` (en `feat/player-phone-whatsapp`, antes de mergear) |
| Nombres de jugadores (potencialmente menores) expuestos sin redactar en la crónica de partido generada por IA en páginas públicas, aunque el resto de la página sí redactaba nombres para torneos `is_youth`. | `src/lib/chronicles/actions.ts` | `enqueueChronicleAction` ahora redacta `playerName` en la copia del timeline usada para armar el prompt de la IA (`buildChronicleTimelineForPrompt`), solo cuando `is_youth = true`; no toca el timeline interno de captura/admin. | `5a60e93` (en `feat/youth-competition-name-redaction`, antes de mergear) |
| Import faltante (`cn` de `@/lib/utils/cn`) en `RosterPlayerCard.tsx`, borrado por error al agregar el botón de WhatsApp — rompía `next build` (`Cannot find name 'cn'`) y tumbaba el deploy en Railway. | `src/components/teams/RosterPlayerCard.tsx` | Se restauró el import. | `8b79481` (en `main`, post-merge) |
| El fix del overload de Postgres cambió `p_phone: phoneRaw \|\| undefined` a `\|\| null`, pero el tipo generado en `database.ts` para ese RPC es `p_phone?: string` (opcional, no nullable) → rompía el type-check de `next build` otra vez. Ya no hacía falta el cambio a `null`: al eliminarse la firma vieja de 4 args (fix anterior), ya no hay ambigüedad de overload y `\|\| undefined` vuelve a ser seguro (Postgres usa el `DEFAULT NULL` de la función cuando se omite la llave). | `src/lib/captain/actions.ts` | Revertido a `p_phone: phoneRaw \|\| undefined`. | `52df8df` (en `main`, post-merge) |

Hallazgo menor, no bloqueante (informativo, no requirió fix): la migración `20260808100004_players_phone.sql` dejaba `create_player_and_add_to_roster` ejecutable por el rol `anon` (Postgres otorga `EXECUTE` a `PUBLIC` por default si no hay `REVOKE` explícito) — no es explotable porque la función exige `auth.uid()`, pero rompía el patrón de "doble candado" usado en el resto del proyecto. Corregido directamente en la base de `ligapro-dev` (ver sección 3); pendiente reflejarlo también en el archivo de migración del repo (ver sección 5).

## 3. Migraciones aplicadas a Supabase (`ligapro-dev` / `akgcamaegpboewsbbevl`)

Aplicadas por Claude vía Supabase MCP, en este orden, todas verificadas por SQL directo después de aplicar:

1. `20260808100003_captain_update_roster_jersey.sql` — función `update_captain_roster_jersey`.
2. `20260808100004_players_phone.sql` — columna `players.phone` + `create_player_and_add_to_roster` (5 args, sin overload viejo).
3. `20260808100005_competitions_is_youth.sql` — columna `competitions.is_youth`.
4. `harden_create_player_and_add_to_roster_grants` (migración ad hoc, aplicada directo en la base, **no existe todavía como archivo en el repo**) — `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated` sobre la firma de 5 args, para cerrar el hallazgo menor de la sección 2.

## 4. Deploy en Railway

- Deploy final exitoso: `90859327-8d21-4a97-9086-5f5650cac999`, commit `52df8df`, status `SUCCESS`.
- Build: TypeScript check limpio (11.5s), 78 rutas generadas.
- Runtime: contenedor arrancó correctamente (`✓ Ready in 84ms`), sin errores en logs de deploy.
- Historial de intentos fallidos previos (por los bugs de la sección 2, ya resueltos): `0dc1fa13` (13e495e), `6b23677f` (f83ad749), `b7746b8d` (8b79481) — los tres `FAILED` por errores de build, no de runtime ni de base de datos.

## 5. Pendientes abiertos (no bloqueantes, para retomar después)

- **Drift de migración cotizador:** la base tiene aplicada `20260809201303_cotizador_tier_teams_jornada_v2`, que no corresponde a ningún archivo en el repo (el repo tiene `20260808200000_cotizador_tier_teams_jornada.sql`, nombre/versión distintos). Parece que en algún momento se aplicó una versión ajustada directo a la base sin subir el archivo correspondiente al repo. Conviene reconciliar el historial de migraciones del repo con lo realmente aplicado en Supabase antes de intentar reconstruir la base desde cero.
- **Hardening de grants pendiente de commitear:** agregar `REVOKE ALL ... FROM PUBLIC, anon` para `create_player_and_add_to_roster(uuid, text, integer, text, text)` a `20260808100004_players_phone.sql` (o a un archivo de migración nuevo), para que coincida con lo que ya está aplicado en `ligapro-dev` (ver sección 3, punto 4).
- **Crónicas ya publicadas de torneos infantiles:** el fix de redacción de nombres en la crónica IA (sección 2) no corrige retroactivamente crónicas ya publicadas antes del fix. Cualquier crónica publicada de un torneo con `is_youth = true` generada antes de hoy debe regenerarse manualmente.
- **Decisión pendiente (marcada con TODO en el código):** si migrar en la base los `seasons.visibility` legacy (`'private'` / `'unlisted'`) a `'draft'`, ahora que la UI ya no ofrece esos valores como opción.
- **Nota menor de redacción de nombres:** `redactPlayerNameForPublic` da "María J." para nombres compuestos como "María José López" (toma el segundo token como apellido). No es una fuga de privacidad, solo un detalle cosmético — no requiere acción inmediata.

---

*Generado por Claude (Cowork) a partir de la revisión y verificación de esta sesión de trabajo con Jonathan.*
