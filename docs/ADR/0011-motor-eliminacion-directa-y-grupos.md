# ADR 0011 — Motor de eliminación directa y fase de grupos

## Contexto

Competidores (Futzo, Canchero) ofrecen brackets y grupos+eliminatoria. LigaPro ya modela `format_type` en `seasons` pero solo tenía motor round-robin (Migration 016).

## Decisiones

### Migration 025 — `knockout` puro

- Tablas `season_knockout_rounds` + `season_knockout_ties` (penales por llave, no por partido).
- Byes: fila en `season_knockout_ties` con un solo equipo; **sin** fila en `matches`.
- Rondas futuras solo vía `advance_knockout_round` cuando la anterior está resuelta.
- Partidos de bracket son `matches` normales (`knockout_round_id`, `bracket_slot`); programación/captura/reagendado sin RPCs duplicadas.
- Sin tiempo extra como dato; sin gol de visitante; seeding solo aleatorio (`random`) en 025.

### Migration 026 — `groups_knockout` (posterior)

- Depende de 025. Agrega `season_groups`, standings por grupo y avance a bracket.
- **Fuera de alcance de 025.**

## Consecuencias

- Standings de liga no aplican a temporadas `knockout`; F8 muestra partidos de bracket con ronda/llave.
- Frontend de bracket: prompt aparte tras 025 probada.
