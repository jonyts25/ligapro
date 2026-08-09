# ADR 0018 — Vista simple para el rol organizador

**Estado:** Aceptado  
**Migration:** N/A (solo presentación + server actions)

## Contexto

Organizadores amateur se saturan con 10+ campos técnicos obligatorios al crear
temporada y con alta uno-a-uno de equipos/jugadores. Se pide una capa de
presentación encima de lo existente, sin rol ni permisos nuevos.

## Decisiones

### 1. Creación de temporada

- `create_season_with_rules` **sin cambios de firma** en backend.
- Formulario organizador:
  - Visible: nombre, fechas, formato, equipos (si aplica en flujo).
  - Defaults ocultos en "Configuración avanzada" (colapsado):
    puntos 3-1-0, empates sí, 90 min, descanso 0, amarillas 5, suspensión 1.
  - El action sigue enviando todos los campos con esos defaults.

### 2. Carga masiva

- **Equipos:** modo "pegar lista" en alta de equipo — textarea multilínea,
  una línea = un equipo. Server action `bulkCreateTeamsAction` inserta en lote
  vía una sola transacción SQL (`bulk_create_teams` RPC) o inserts paralelos
  server-side (no serial desde el browser).
- **Jugadores:** modo "pegar lista" en `AddRosterPlayerForm` — server action
  `bulkCreatePlayersAndAddAction` con RPC `bulk_create_players_and_add_to_roster`.

### 3. Alcance

- Modo de presentación únicamente; mismo rol `organization_admin` / owner.
- No tabla de permisos ni rol "organizador simple".

## Fuera de alcance

- Wizard multi-paso distinto al formulario actual.
- Import CSV con columnas múltiples.
