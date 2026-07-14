# Frontend F8 — Standings, estadísticas y página pública

**Fecha:** 2026-07-13  
**Base:** F7 `bcd072d` en `origin/main`  
**Migration:** `20260714200000_season_public_read_models.sql`  
**Estado:** listo para revisión · **sin commit** · **sin F9**

---

## Auditoría previa

| Check | Resultado |
| --- | --- |
| Working tree limpio al inicio | Sí (`main = origin/main`) |
| F6 / F7 commits | `7e3ac39` / `bcd072d` |
| Migrations 001–017 sync | Sí |
| Service role en app | No |
| Org slug | Existe; URL pública usa `organizationId` + `seasonSlug` (RPC firmada) |
| Competition slug | No existe |
| Season visibility / format | Enums reales usados |
| Standings previos | No existían |

## Schema / decisión 018

Funciones SQL (sin materializadas). Internas: member-only. Públicas: `visibility = public` o vacío.

## Suites

| Suite | Resultado |
| --- | --- |
| **018** | **32/32 PASS** |
| 006a | PASS |
| 006b | PASS |
| 007 | PASS |
| 016 | 40/40 PASS |
| 017 | 25/25 PASS |
| `db lint` | limpio |
| `npm test` | 16/16 |
| `npm run lint` | PASS |
| `npm run build` | PASS |

## Rutas

Privadas: `.../posiciones`, `.../goleadores`, `.../disciplina`  
Públicas: `/publico/[organizationId]/[seasonSlug]` (+ calendario, posiciones, goleadores, disciplina)

## Frontend real / smoke

**No inventado PASS.** Validación browser humana pendiente.

## Riesgos

- Divergencia marcador/eventos posible
- Sin desempates avanzados
- `unlisted` tratado como no público en F8
- Disciplina pública mínima solo suspensiones activas

Mundial Compas intacto. No commit. No F9.
