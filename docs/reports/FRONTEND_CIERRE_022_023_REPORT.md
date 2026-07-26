# Frontend — Cierre huecos Migration 022 y 023

**Alcance:** solo UI sobre RPCs existentes — sin migraciones ni schema nuevo.

## 1. Ventana de captura (022)

| Pieza | Detalle |
| --- | --- |
| `humanizeCaptureError` | Distingue ventana cerrada (`warning`) vs sin permiso (`danger`) vs ya anulado |
| `CaptureWindowStatus` | Badge/alerta proactiva en `.../captura` antes de intentar capturar |
| `capture-window.ts` | Cálculo UI de ventana abierta (espejo de `__match_capture_window_open`, timezone MX) |
| Formularios | `MatchEventForm` y `MatchScoreForm` usan `errorKind` para estilos distintos |

Bypass: owner/admin/tournament_admin ven mensaje de sin límite, no el de ventana cerrada.

## 2. Anulación de eventos (022)

| Pieza | Detalle |
| --- | --- |
| `voidMatchEventAction` | Server Action → `void_match_event(p_event_id, p_reason)`; solo `requireOrganizationAdmin` |
| `MatchTimeline` | Eventos anulados: tachado, atenuado, badge «Anulado» + motivo; fila conservada |
| Botón «Anular» | Visible solo si `canVoidEvents` (owner/admin) en captura y detalle de partido |
| Errores | «Este evento ya estaba anulado» mapeado desde backend |

`goalsFromEvents` excluye eventos con `voidedAt` para el aviso de marcador inconsistente.

## 3. Revisión de verificación (023)

| Pieza | Detalle |
| --- | --- |
| Ubicación | Panel en `/temporadas/[seasonId]/disciplina` (solo `isOrganizationAdminRole`) |
| `VerificationReviewPanel` | Lista jugadores `verification_status = pending` en planteles activos de la temporada |
| `reviewPlayerVerificationAction` | Aprobar / rechazar con motivo obligatorio en rechazo |
| Revalidación | Disciplina + rutas de equipos tras revisar |

Capitán/member: no ven el panel (gate en page, sin botones).

## Archivos principales

- `src/lib/matches/capture-errors.ts`, `capture-window.ts`, `actions.ts`, `queries.ts`, `types.ts`
- `src/lib/verification/actions.ts`, `queries.ts`
- `src/components/matches/CaptureWindowStatus.tsx`, `MatchTimeline.tsx`
- `src/components/verification/VerificationReviewPanel.tsx`
- Páginas: captura, detalle partido, disciplina

## Tests

- `src/lib/matches/capture-errors.test.ts` — humanización ventana vs permiso
- `npm run lint` / `npm run build` / `npm test` → **54/54 PASS**

## Commit

_Pendiente al cierre._
