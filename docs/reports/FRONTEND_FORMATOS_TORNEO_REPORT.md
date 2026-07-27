# Reporte — Frontend formatos de torneo (knockout, groups_knockout, bracket, standings)

**Fecha:** 2026-07-26  
**Alcance:** UI para los tres formatos sin migraciones ni RPCs nuevas.

## Resumen

Se implementó el frontend completo para `knockout`, `groups_knockout` y las mejoras de standings/bracket, reutilizando RPCs de Migration 025/026 y los componentes existentes de partidos/captura/calendario.

## Pantallas y rutas

### Admin (organización)

| Ruta | Formato | Descripción |
|------|---------|-------------|
| `.../temporadas/[seasonId]/bracket` | `knockout`, `groups_knockout` | Generar bracket, ida/vuelta por ronda, penales, avanzar ronda, campeón. Acciones solo admin. |
| `.../temporadas/[seasonId]/grupos` | `groups_knockout` | Definir grupos (reemplazo atómico), asignar equipos, fixture por grupo (TS round-robin), generar eliminatoria. Solo admin (404 para member). |
| `.../temporadas/[seasonId]/posiciones` | `groups_knockout` | Tabs por grupo vía `?grupo=<uuid>`. |
| `.../temporadas/[seasonId]/posiciones` | `knockout` | Redirect a `/bracket`. |
| Formulario crear/editar temporada | todos | Cuatro formatos visibles; `groups_advance_per_group` solo si `groups_knockout`. |

### Público

| Ruta | Comportamiento |
|------|----------------|
| `/publico/.../posiciones` | `knockout` → bracket read-only; `groups_knockout` → tabs por nombre de grupo; liga → tabla única. |
| `/publico/.../` (inicio) | `knockout` → preview de eliminatoria en lugar de tabla de posiciones. |
| Nav público | Tab "Eliminatoria" en lugar de "Posiciones" para `knockout`. |

## Componentes nuevos

- `KnockoutBracketView` — árbol por columnas (admin + público, sin acciones en read-only).
- `KnockoutBracketAdminPanel` — acciones admin integradas en la misma vista.
- `SeasonGroupsPanel` — flujo completo de fase de grupos.
- `GroupStandingsTabs` / `PublicGroupStandingsTabs` — tabs interno/público.

## Libs

- `src/lib/knockout/` — types, utils, queries, actions, `public-bracket.ts`.
- `src/lib/groups/` — types, queries, actions (fixture por grupo con resultados parciales).

## Nav temporada

`SeasonStandingsNav` recibe `formatType`:

- **Liga:** Posiciones (sin cambio).
- **Knockout:** Eliminatoria (sin Posiciones).
- **Groups + knockout:** Grupos (admin), Posiciones, Eliminatoria.

## Validaciones UX (cliente)

- Bracket: tamaño potencia de 2, byes, mínimo 2 equipos antes de generar.
- Ida/vuelta deshabilitada si algún partido de la ronda salió de `scheduled`.
- Penales solo en llaves empatadas.
- Avanzar ronda: lista llaves pendientes en lugar de botón mudo.
- Mensaje explícito: rondas 2+ se generan con `advance_knockout_round`.
- Grupos: fixture parcial por grupo; eliminatoria bloqueada con grupo(s) sin resultado.

## Tests

- `src/lib/knockout/utils.test.ts` — nextPowerOfTwo, resolución de llaves, avance de ronda.
- `npm run lint` ✅
- `npm run build` ✅
- `npm test` ✅ (70 tests)

## Commit

_Pendiente de registrar hash tras push._

## Fuera de alcance (confirmado)

Migraciones, RPCs nuevas, wrapper SQL multi-grupo, duplicar captura/calendario/credencial.
