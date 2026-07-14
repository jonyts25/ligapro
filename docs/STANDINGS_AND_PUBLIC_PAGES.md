# Standings y páginas públicas (F8)

## Fuentes de verdad

| Vista | Fuente |
| --- | --- |
| Tabla de posiciones | Marcador oficial `matches.home_score` / `away_score` |
| Goleadores | `match_events.event_type = 'goal'` |
| Own goals | No acreditan al jugador; no cuentan en goleo |
| Suspensiones | `discipline_suspensions` (no recalcular en TS) |
| Tarjetas informativas | Conteos de `yellow_card` / `red_card` |

Partidos que cuentan para standings: `finished` o `walkover` **con ambos scores**.  
No cuentan: `scheduled`, `in_progress`, `cancelled`, finished/walkover sin score completo.

## Fórmula MVP

Puntos desde `season_rules` (`points_win`, `points_draw`, `points_loss`).

Métricas: PJ, G, E, P, GF, GC, DG, PTS.

`RANK()` por: PTS → DG → GF. Empates conservan la misma posición; el nombre solo ordena visualmente.

Desempates avanzados (H2H, fair play, sorteo): **pendientes**.

Equipos `withdrawn`: permanecen en tabla con badge “Retirado”; resultados oficiales no se borran.

## Visibilidad pública

Solo `seasons.visibility = 'public'`.  
`draft` / `private` / `unlisted` / `archived` → anon recibe vacío / `notFound` (sin revelar existencia).

URL: `/publico/[organizationId]/[seasonSlug]`

Anon **no** tiene SELECT en tablas base. Solo RPCs públicas SECURITY DEFINER.

## Disciplina pública

Mínima: jugador, equipo, suspendido, partidos pendientes. Sin notas ni IDs.

## Forma reciente

Últimos 5 partidos oficiales por equipo (`G`/`E`/`P`), orden cronológico por `field_reservations.starts_at` o `matches.created_at`.

## Cache / revalidación

Server Actions F6/F7/competiciones revalidan rutas privadas de posiciones/goleadores/disciplina y rutas `/publico/...` al mutar marcador, eventos, fixture o visibility.

## Limitaciones F8

- Sin corrección/anulación de eventos
- Sin reconciliación disciplinaria
- Sin desempates avanzados / playoffs / brackets
- Sin asistencias ni stats avanzadas
- Divergencia marcador vs eventos: alerta admin, no auto-corrección
