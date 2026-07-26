# ADR 0008 — Cédula arbitral: scorekeeper, ventana de captura y anulación de eventos

**Estado:** aceptado  
**Fecha:** 2026-07-26  
**Migration:** 022

## Contexto

La captura en cancha (Migration 017) permitía referee/delegate confirmados sin límite temporal ni rol de anotador dedicado. Los operadores necesitan:

1. Un rol `scorekeeper` en `season_roles` alineado con `match_officials.role = 'scorekeeper'`.
2. Ventana de captura acotada al día de juego (desde `starts_at` de la reserva confirmada hasta 09:00 del día siguiente, `America/Mexico_City`).
3. Corrección de eventos erróneos sin UPDATE del contenido original — solo anulación (`voided_at`) vía RPC owner/admin.

## Decisiones

### Scorekeeper

- `season_roles.role` admite `scorekeeper`.
- `can_capture_match` trata `scorekeeper` igual que referee/delegate: requiere `season_role` + `match_officials.status = 'confirmed'` con rol coincidente.

### Ventana de tiempo

- Helper `__match_capture_window_open(match_id)`: false si no hay reserva `confirmed` tipo `match`.
- Owner/admin y `tournament_admin` tienen **bypass total** (mismo patrón que disciplina en migraciones anteriores).
- Mensaje distinto: «La ventana de captura para este partido ya cerró» (no confundir con falta de permiso).

### Anulación

- Columnas `voided_at`, `voided_by_profile_id`, `void_reason` en `match_events` (CHECK todo-o-nada).
- RPC `void_match_event(p_event_id, p_reason)` — solo owner/admin; motivo obligatorio.
- Sin UPDATE genérico para `authenticated`; void vía flag `app.match_event_void` en trigger (patrón `team_charges`).
- **No** revertir `discipline_suspensions` automáticamente; admin usa `waive_discipline_suspension` (020) si aplica.
- Goleo y disciplina informativa excluyen eventos con `voided_at IS NOT NULL`.

### Fuera de alcance

Asistencias, modalidad de juego, edición de contenido de eventos, reversión automática de sanciones.
