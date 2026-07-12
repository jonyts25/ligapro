# ADR 0004 — Field reservations unificado

## Status

Accepted

## Context

Las canchas se ocupan por partidos de competencia, entrenamientos, rentas y bloqueos operativos. Si cada tipo de uso guarda ocupación en tablas distintas, aparecen dobles bookings y lógica inconsistente de disponibilidad.

## Decision

`field_reservations` es la única fuente de verdad de ocupación de campos.

Cualquier uso que bloquee un slot (partido, renta, mantenimiento, etc.) debe materializarse como reserva (o referenciarse a través de ella).

## Consequences

- El motor de scheduling consulta un solo calendario.
- Partidos y rentas se modelan como productores de reservas, no como ocupantes paralelos.
- Reportes de utilización y conflictos se simplifican.
- Cambios de horario de partido deben mantener sincronizada la reserva asociada.
