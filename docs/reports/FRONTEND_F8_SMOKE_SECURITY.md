# Frontend F8 — cierre de smoke / seguridad (sin commit)

**Fecha:** 2026-07-14  
**Sin commit · Sin deploy · Sin F9**

## Frase clarificada

> “Públicas: visibility = public o vacío”

Significa: **solo `visibility = public` devuelve información**; cualquier otro valor (`draft`/`private`/`unlisted`/`archived`) o season inexistente → **resultado vacío / `notFound`**. No significa que visibility vacía sea pública.

## Smoke público (HTTP local, sin cookies)

Season: `Org A Mig018` / `season-public-mig018`  
URL base: `http://localhost:3000/publico/{organizationId}/season-public-mig018`

| # | Check | Resultado |
| --- | --- | --- |
| 1–7 | home/posiciones/calendario/goleadores/disciplina HTTP 200 | **PASS** |
| Branding/org/competition/season | presentes en HTML | **PASS** |
| Standings / goleo / disciplina | Alpha, Scorer One×3, Carded Suspendido | **PASS** |
| 8–10 | sin emails, sin “profile”, sin Capturar/Editar | **PASS** (`@` solo en CSS `variable`) |
| 11 | no login redirect | **PASS** |
| 12 | refresh | **PASS** (force-dynamic) |
| 13–16 | 375px / scroll / hydration / consola browser | **NO VERIFICADO** (sin automatización de browser) |

## Smoke privado

| Check | Resultado |
| --- | --- |
| visibility → private | HTTP **404** |
| Sin leak org/competition/season | **PASS** |
| Sin forzar login | **PASS** |
| Restore public | HTTP **200** + org visible | **PASS** |

## Revalidación

| Mutación | Code path | Prueba real |
| --- | --- | --- |
| Marcador / status / eventos | `matches/actions` → private+public paths | Score SQL 2→5; page mostró Alpha GF **9** |
| Schedule/unschedule | `fixtures/actions` | Code audit |
| Visibility | `competitions/actions` | private→404 real |
| Team name | `teams/actions` + seasons del team | Code fix añadido |
| display_name (enroll) | `teams/actions` season scoped | Code fix |
| Branding/logo | `organizations/actions` | Code fix |
| Beta consistency | `export const dynamic = 'force-dynamic'` en `/publico` y páginas standings internas | Confirmado |

Revalidación UI autenticada (capture form → button) **no** se ejercitó con sesión browser; capa de datos + force-dynamic sí.

## Suite 018 (39/39 PASS)

Casos: ver lista en entrega. Agregados en este cierre: `02b`, `03b`, `16`, `17`, `25b`, `36b`, `36c`, `39b` (+ REVOKE del scratch table).

## SECURITY DEFINER

Todas con `search_path=public`, SECURITY DEFINER. Helpers `__*` sin EXECUTE a anon/authenticated/PUBLIC. Públicas: anon+authenticated. Internas: authenticated only. PUBLIC revocado.

## Residuales `__mig*`

- Migration `20260714210000` (019): DROP de `__mig*_test_results` (incl. 010/011 que tenían anon SELECT/INSERT sin RLS).
- Migration `20260714220000` (020): DROP de residuos recreados por re-ejecución de suites (006b/007/017 tenían anon SELECT tras runtime).
- Suites `006b`/`007`/`017`/`018` ahora hacen `DROP TABLE` al final (después del SELECT de resultados). Remoto post-020 + suites: **0** tablas `__mig*_test_results` residuales.

## Mundial Compas

No tocado.
