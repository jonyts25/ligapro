# Frontend F7 — Operación de partido y captura

**Fecha:** 2026-07-13  
**Base F6 checkpoint:** `7e3ac39` — `feat: frontend F6 fixture and match scheduling`  
**Hardening:** Migration `20260714013000_harden_match_event_capture.sql`  
**Estado:** cerrado para commit/push · **sin F8**

---

## 1. Auditoría previa

| Check | Resultado |
| --- | --- |
| Checkpoint F6 local | `7e3ac39` |
| Migration 016 aplicada | Sí |
| Migration 017 hardening | Aplicada (`db push --linked`) |
| Schema 006a/b, 007, 008 leído | Completo |

### Schema real

- Status match: `scheduled|in_progress|finished|cancelled|walkover`
- Events: `goal|own_goal|yellow_card|red_card|substitution_in|substitution_out|injury`; minute 0–130
- Season roles: `tournament_admin|referee|delegate`
- Officials: `referee|assistant|delegate|scorekeeper` × `assigned|confirmed|declined`
- `update_match_result`: owner/admin/tournament_admin (no referee)
- `can_capture_match`: owner/admin OR tadmin OR ref/delegate confirmed

---

## 2. Migration 017

- DROP policies UPDATE/DELETE de `match_events`
- `REVOKE UPDATE, DELETE` de authenticated
- Trigger `match_events_enforce_capture_rules` (cerrado + inactive + `can_capture_match`)
- RPC `record_match_event` (SECURITY DEFINER)
- `CREATE OR REPLACE` de `unschedule_match` / `create_season_round_robin_fixture` sin locals no usados (`v_res`, `v_a`, `v_b`)

---

## 3–8. App

Lib/components/rutas de captura, oficiales, timeline, disciplina read-only. Sin UI editar/eliminar evento.

---

## 9. Pruebas SQL

| Suite | Resultado |
| --- | --- |
| **005** | PASS (teardown audit + fixtures match_id) |
| **006a** | PASS (teardown audit) |
| **006b** | PASS |
| **007** | PASS |
| **008** | PASS (adapted to 017 deny UPDATE/DELETE + closed-match) |
| **015** | 34/34 PASS |
| **016** | 40/40 PASS |
| **017** | **25/25 PASS** |

---

## 10. Validaciones app

| Check | Resultado |
| --- | --- |
| `db lint --linked` | Sin errores / sin warnings schema |
| `npm test` | 16/16 PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS |

---

## 11. Smoke browser

**No ejecutado en este cierre** (sin sesión browser automatizada aquí). No inventar PASS. Validar manualmente la matriz F6/F7 del brief antes de dar por cerrado el smoke humano.

---

## 12. Riesgos restantes

- No hay anulación/reconciliación de eventos (UPDATE/DELETE denegados a propósito)
- Marcador y goles de eventos pueden divergir (warning UI)
- Smoke browser humano pendiente

## 13. Fuera de alcance / F8

No iniciado. Mundial Compas intacto.
