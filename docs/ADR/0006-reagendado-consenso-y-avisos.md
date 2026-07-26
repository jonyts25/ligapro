# ADR 0006 — Reagendado por consenso y avisos

## Estado

Aceptado — Migration 019.

## Contexto

Los capitanes necesitan proponer cambios de horario con acuerdo del rival antes de que la liga confirme cancha. El calendario debe distinguir **programado** (borrador admin) de **confirmado** (listo para avisar). Los avisos (push / WhatsApp `wa.me`) se conectan en una fase posterior; esta migración deja datos y estados listos.

## Decisiones

### Cuenta de capitán

- Solo el capitán (`season_team_players.is_captain = true`, `active`) con `players.profile_id` vinculado tiene privilegios de calendario.
- El vínculo se hace por **invitación por correo** (`captain_invitations` + `accept_captain_invitation`). No se crea usuario Auth sin acción del invitado.
- El capitán **no** es miembro de organización por defecto. RLS limitada: leer partidos de su equipo y operar solicitudes de reagendado.

### `match_reschedule_requests`

Máquina de estados:

```text
proposed → approved_by_opponent | rejected_by_opponent | expired
approved_by_opponent → confirmed_by_admin | no_availability
```

- Un solo request abierto (`proposed` / `approved_by_opponent`) por partido (índice único parcial).
- `expires_at` derivado de `season_rules.reschedule_request_ttl_hours` (default **72 h**).
- Expiración lazy vía `expire_stale_match_reschedule_requests()` en RPCs (sin cron).

### Calendario dual

- Columna `matches.calendar_status`: `programado` | `confirmado`.
- Distinta de `status` deportivo y de la mera existencia de `field_reservation_id`.
- `schedule_match` / slot recurrente → `programado`. `confirm_match_calendar` o `resolve_match_reschedule(confirm)` → `confirmado`.

### Slot recurrente

- Config en `season_rules`: `recurring_slot_field_id`, `recurring_slot_day_of_week`, `recurring_slot_start_time`.
- RPC `apply_recurring_slot_to_season(p_season_id, p_day_of_week, p_start_time)` programa solo partidos sin reserva; fallos parciales no abortan el lote.

## Fuera de alcance (Migration 019)

- Swap manual de rival entre jornadas.
- WhatsApp Business API / webhooks.
- Auth para jugadores no capitanes.
- Cambios a `create_season_round_robin_fixture`.
- Push notifications / service worker.
