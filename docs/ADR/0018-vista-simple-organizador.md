# ADR 0018 — Vista simple para rol organizador

**Estado:** Aceptado  
**Migration:** ninguna (solo frontend + RPCs bulk opcionales)

## Contexto

Organizadores amateur se abruman con 10+ campos técnicos al crear temporada y al dar de alta equipos/jugadores uno por uno.

## Decisiones

### 1. Creación de temporada — capa de presentación

- `create_season_with_rules` **sin cambio de firma**.
- Formulario organizador (`SeasonForm`, mode `create`):
  - Visible: nombre, fechas, formato, estado (visibility).
  - Oculto tras toggle «Configuración avanzada» (cerrado por default): puntos 3-1-0, empates sí, 90 min, descanso mínimo, límite amarillas, partidos suspensión — con defaults precargados.
- Mode `edit` mantiene reglas visibles (sin colapsar) para no ocultar config existente.

### 2. Carga masiva «pegar lista»

- **Equipos** (`TeamForm` create): textarea multilínea → RPC `create_teams_bulk(p_organization_id, p_names text[])` en una transacción.
- **Jugadores** (`AddRosterPlayerForm`): textarea → RPC `create_players_and_add_to_roster_bulk(p_season_team_id, p_entries jsonb)` donde cada entrada tiene `full_name` y `jersey_number` opcional.

Evita N round-trips desde el browser; el frontend llama una action que invoca un solo RPC.

### 3. Alcance

- Modo presentación únicamente — **no** nuevo rol ni tabla de permisos.
- Mismo rol `organization_owner` / `organization_admin`.

## Consecuencias

- Usuarios avanzados expanden «Configuración avanzada»; flujo default es más corto.
- Bulk paste valida líneas vacías y duplicados en servidor.

## Fuera de alcance

Rol «organizador simple», wizard multi-paso, import CSV con columnas.
