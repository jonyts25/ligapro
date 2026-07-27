# Reporte — Archivar temporada

**Fecha:** 2026-07-26  
**Alcance:** Investigación del estado `visibility = 'archived'` existente + cierre de huecos en UI y frontend. Sin migración nueva ni DELETE físico.

## 1. Hallazgos de investigación (antes de construir)

### 1.1 UI existente

| Pregunta | Hallazgo |
|----------|----------|
| ¿Existía botón «Archivar temporada»? | **No.** Solo un selector genérico «Estado» en `SeasonForm` con opción «Archivada», sin confirmación ni explicación. |
| ¿Acción inversa? | **No.** Mismo selector; se podía volver a otro estado sin flujo dedicado. |

### 1.2 Comportamiento previo de `archived`

| Área | Comportamiento antes |
|------|---------------------|
| Listado de temporadas del torneo | Mezcladas con activas (`getCompetitionWithSeasons` sin filtro). |
| Edición | Totalmente editable vía `/editar` y `update_season_with_rules`. |
| Página pública | `__resolve_public_season` exige `visibility = 'public'` → archivadas **no** aparecen en `get_public_season_*` (igual que draft/private/unlisted). |
| RPCs de escritura | `__assert_season_readable` valida membresía, **no** bloquea archivadas → captura, fixture, disciplina, finanzas, etc. siguen operativos en backend si se invocan directamente. |

### 1.3 Decisión de alcance

- **Implementado en este prompt:** UI dedicada, separación de listados, bloqueo operativo en frontend, finanzas solo lectura.
- **Reportado, fuera de alcance inmediato:** chequeo centralizado `__assert_season_not_archived` en todas las RPCs de escritura (cambio transversal; requiere conversación aparte).

---

## 2. Entregado

### 2.1 Acciones dedicadas (owner/admin)

- **`SeasonArchivePanel`** en la página de la temporada:
  - «Archivar temporada…» con confirmación y texto explicativo (datos conservados; deja de ser pública si lo era).
  - «Reactivar…» con selector de visibilidad (`draft` / `private` / `unlisted` / `public`, default `private`).
- Server actions: `archiveSeasonAction`, `reactivateSeasonAction` → `update_season_with_rules` (sin migración).
- **`SeasonForm`:** `archived` excluido del selector; nota para usar la acción dedicada.
- **`parseSeasonForm`:** rechaza `archived` en create/edit (evita bypass por formulario).

### 2.2 Listados operativos

- **`SeasonList`:** secciones «Temporadas activas» / «Temporadas archivadas».
- **`pickLatestActiveSeason`:** el listado de torneos usa la última temporada no archivada como `latestSeason`.

### 2.3 Solo lectura vs. escritura (frontend)

- **`SeasonArchivedBanner`** en layout de temporada archivada.
- **Redirect** desde `/editar` si archivada.
- **Bloqueo operativo** (`canManageActiveSeason`) en:
  - Calendario (generar fixture, captura admin)
  - Bracket admin
  - Disciplina admin / verificación
  - Equipos (inscribir, gestión)
  - Partidos (captura, programar, reagendar, oficiales, anular eventos)
  - Redirect en: `/grupos`, `/canchas`, `/fixture/generar`, `/equipos/inscribir`
- **Finanzas:** consulta histórica con `readOnly` (sin cargos, pagos ni anulaciones).
- **`SeasonStandingsNav`:** oculta Grupos/Canchas cuando archivada; mantiene Finanzas para consulta.

### 2.4 Lib y tests

- `src/lib/competitions/season-visibility.ts` — helpers compartidos.
- `src/lib/competitions/season-visibility.test.ts` — 4 tests.
- Glob de tests actualizado en `package.json`.

---

## 3. Conservación de datos

Archivar usa solo `visibility = 'archived'`. No hay DELETE ni desvinculación en cascada. Partidos, resultados, cargos, disciplina y demás datos históricos permanecen intactos (validado por diseño: misma RPC de update de reglas, sin RPCs destructivas).

---

## 4. Gap pendiente (backend)

Las RPCs de escritura (captura, fixture, disciplina, finanzas, reagendado, knockout, grupos, etc.) **no** validan hoy si la temporada está archivada. El frontend bloquea la gestión habitual, pero un cliente que llame RPCs directamente aún podría escribir. Recomendación futura: helper SQL `__assert_season_not_archived` + aplicación sistemática en mutaciones.

---

## 5. Verificación

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | ✅ |
| `npm run build` | ✅ |
| `npm test` | ✅ (74 tests) |

---

## 6. Commit

`211b582` — feat(seasons): dedicated archive flow with read-only operational UI
