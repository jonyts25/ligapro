# Frontend F4 — Competiciones, temporadas y reglas

**Fecha:** 2026-07-13  
**Base:** `b65cfc5` — `feat: frontend F3 venues fields and availability`  
**Estado:** listo para revisión · **sin commit**  
**Hardening:** Migration 013 — operaciones atómicas season + rules

---

## 1. Auditoría previa

| Check | Resultado |
| --- | --- |
| Working tree limpio al inicio F4 | Sí |
| Commit F3 | `b65cfc5` |
| Schema 003 competitions/seasons/rules | Confirmado |
| Audit 010 | Cubren las tres tablas |
| Mundial Compas | No tocado |

---

## 2. Schema real

Ver `docs/COMPETITIONS_AND_SEASONS.md`. Competition solo `name`. Rules: puntos, empates, duración, descanso, amarillas, suspensión. Sin tiempos extra/penales/máx. equipos.

---

## 3. Decisión Migration 013

**Sí — necesaria por atomicidad.**

La UI F4 inicialmente hacía INSERT season + UPDATE rules con compensación DELETE en la app. Eso no es atómico si el proceso se interrumpe.

**Archivo:** `supabase/migrations/20260713024038_atomic_season_management.sql`  
**Push:** aplicado · local = remote

---

## 4. RPCs

### `create_season_with_rules(...) → uuid`

Parámetros tipados (schema real): `p_competition_id`, `p_name`, `p_slug`, `p_format_type`, `p_visibility`, `p_starts_on`, `p_ends_on`, `p_points_win/draw/loss`, `p_allow_draws`, `p_match_duration_minutes`, `p_minimum_rest_minutes`, `p_yellow_card_limit`, `p_suspension_matches`.

Flujo: auth → org desde competition → owner/admin → validar season → INSERT → trigger default rules → UPDATE rules → return `season_id`. Fallo en UPDATE revierte todo (demostrado en test 12).

### `update_season_with_rules(...) → void`

Actualiza season + rules en la misma transacción. No modifica `id`, `organization_id`, `competition_id`, `slug`, timestamps.

Seguridad ambas: SECURITY DEFINER; `search_path = public`; REVOKE PUBLIC/anon; GRANT authenticated; sin `organization_id`/`profile_id` en firma.

---

## 5–6. Archivos

### Creados (F4 + 013)

```
supabase/migrations/20260713024038_atomic_season_management.sql
supabase/tests/013_competitions_seasons_frontend.sql
docs/COMPETITIONS_AND_SEASONS.md
docs/reports/FRONTEND_F4_REPORT.md
src/lib/competitions/{types,queries,actions}.ts
src/components/competitions/*
src/app/.../torneos/**
```

### Modificados (013 hardening)

```
src/lib/competitions/actions.ts — solo RPCs; sin INSERT/UPDATE/DELETE compensación
src/types/database.ts — regenerado + fechas nullable en Args RPC
docs/COMPETITIONS_AND_SEASONS.md
docs/DOMAIN_MODEL.md
docs/DESIGN_SYSTEM.md
dashboard / nav / suite 003 cleanup
```

---

## 7–10. Rutas / Actions / Helpers / UI

Sin cambios de rutas ni formularios visuales.  
Actions: `createSeasonAction` / `updateSeasonAction` → RPCs.  
Helpers y UI de F4 intactos.

---

## 11–14. Flujos / Dashboard / Permisos

Igual que F4 aprobado en UI. Compensación app **eliminada**.

---

## 15. Matriz de permisos

| Rol | Ver | Mutar vía RPC / RLS |
| --- | --- | --- |
| owner / admin | sí | sí |
| member | sí | no |
| tournament_admin | como member | no |
| anon | no | no EXECUTE |

---

## 16. Pruebas SQL 013 (23/23 PASS)

| # | Caso | Resultado |
| --- | --- | --- |
| 01 | owner crea season + reglas | PASS |
| 02 | admin crea | PASS |
| 03 | member no create | PASS |
| 04 | tournament_admin no create | PASS |
| 05 | otra org no create | PASS |
| 06 | anon no EXECUTE | PASS |
| 07 | PUBLIC no EXECUTE | PASS |
| 08 | sin param organization_id | PASS |
| 09 | sin param profile_id | PASS |
| 10 | exactamente 1 season_rules | PASS |
| 11 | reglas = params (no defaults) | PASS |
| 12 | fallo rules tras INSERT válido → 0 filas nuevas | PASS |
| 13 | fechas inválidas → 0 season | PASS |
| 14 | slug duplicado → sin parcial | PASS |
| 15 | update season + rules | PASS |
| 16 | fallo rules conserva season | PASS |
| 17 | fallo season conserva rules | PASS |
| 18 | member no update | PASS |
| 19 | otra org no update | PASS |
| 20 | audit insert season | PASS |
| 21 | audit update rules | PASS |
| 22 | audit update season | PASS |
| 24 | F4 member no crea competition | PASS |

Caso 23 = ejecutar suite 003 como regresión externa.

---

## 17. Regresiones

| Suite | Resultado |
| --- | --- |
| 003 | PASS (cleanup audit_log) |
| 010 | PASS |
| 011 | PASS |
| 012 | PASS |
| 013 | **23/23 PASS** |

---

## 18–19. Frontend manual

No re-ejecutado en browser en este hardening. UI sin cambios funcionales de formulario.

---

## 20–23. Validaciones

| Check | Resultado |
| --- | --- |
| db push --linked | Applied `20260713024038` |
| db lint | Sin errores |
| gen types | Regenerado |
| npm lint | PASS |
| npm build | PASS (tras tipar fechas nullable) |
| migration list | local = remote incl. 013 |

---

## 24. git status

Sin commit. Incluye F4 UI + Migration 013 + tests + docs + types.

---

## 25. Riesgos / desviaciones

- Firma RPC usa nombres reales (`match_duration_minutes`, `suspension_matches`), no el ejemplo del brief con `halftime` / nombres inventados.
- `update` no cambia `slug` (UI no lo edita).
- Generador de tipos marcó fechas como `string`; se ajustó a `string | null` para NULL reales.

---

## 26. Mundial Compas

No tocado.

---

## Diseño vigente (atomicidad)

```text
Crear o editar una temporada y sus reglas es una operación atómica de PostgreSQL.
No puede quedar una season con reglas parciales o defaults accidentales.
```

La compensación DELETE desde la aplicación **ya no forma parte del diseño**.
