# Frontend — Exportaciones CSV/PDF y credencial imprimible

**Alcance:** exportaciones bajo demanda y PDF de credencial sobre read models y RPCs existentes (Migration 024). Sin migración nueva, sin caché en storage, sin export en páginas públicas F8.

## 1. Librerías

| Librería | Uso |
| --- | --- |
| **jspdf** + **jspdf-autotable** | Tablas PDF (posiciones, goleadores, disciplina, plantel) |
| **pdf-lib** | Credencial imprimible (layout fijo + foto embebida PNG/JPG) |

CSV: generación propia (`buildCsv`) con BOM UTF-8 para Excel.

## 2. Decisiones técnicas

### Server-side vs client-side

**Server-side (Route Handlers)** para todo:

- Reutiliza los mismos gates de auth que las páginas (`requireUser`, `requireOrganizationMembership`, `hasCaptainTeamAccess`, `getPlayerCredentialForCaptain` / `getPlayerCredentialForMatchCapture`).
- Los datos salen de los mismos RPCs/queries que la UI (`get_season_standings`, `get_season_top_scorers`, `get_season_discipline_summary`, roster).
- La foto de credencial se descarga con la sesión del usuario vía `supabase.storage.download` en el bucket privado `player-photos` — respeta RLS/`can_view_player_photo` sin relajar permisos.
- `Cache-Control: no-store` en todas las respuestas; el archivo no se persiste.

Client-side descartado: expondría URLs o lógica duplicada y no garantizaría el mismo gate estricto en descarga directa.

### Credencial PDF

- Misma información que la credencial virtual: foto o placeholder/iniciales, nombre, dorsal, equipo, org/temporada/torneo, badge de verificación si la temporada lo exige.
- WebP u otros formatos no embebibles → placeholder (sin ampliar acceso al bucket).
- Pie de página: «Documento generado al momento · no es credencial oficial con QR».

### Acceso exportaciones

| Export | Gate |
| --- | --- |
| Posiciones / Goleadores / Disciplina | `requireOrganizationMembership` + temporada válida |
| Plantel | Miembro de org **o** capitán/subcapitán del equipo (`hasCaptainTeamAccess`) |
| Credencial PDF | Mismo que vista: `getPlayerCredentialForCaptain` o `getPlayerCredentialForMatchCapture` |

No hay botones en rutas `/publico/...`.

## 3. Rutas API

| Ruta | Formatos |
| --- | --- |
| `/api/export/standings` | `format=csv\|pdf` |
| `/api/export/scorers` | `format=csv\|pdf` |
| `/api/export/discipline` | `format=csv\|pdf` |
| `/api/export/roster` | `format=csv\|pdf` |
| `/api/export/credential` | PDF (`mode=captain\|capture` + ids) |

## 4. UI

| Pantalla | Botones |
| --- | --- |
| `/temporadas/.../posiciones` | Exportar CSV / PDF |
| `/temporadas/.../goleadores` | Exportar CSV / PDF |
| `/temporadas/.../disciplina` | Exportar CSV / PDF |
| `/temporadas/.../equipos/[seasonTeamId]` | Exportar plantel CSV / PDF |
| `/mi-equipo/[seasonTeamId]` (capitán) | Exportar plantel CSV / PDF |
| Credencial virtual (capitán + captura) | Descargar PDF |

Componentes: `SeasonExportButtons`, `RosterExportButtons`, `CredentialPdfDownload`.

## 5. Archivos principales

- `src/lib/export/` — `csv.ts`, `auth.ts`, `builders.ts`, `pdf-table.ts`, `pdf-credential.ts`
- `src/app/api/export/*`
- `src/components/export/ExportButtons.tsx`, `CredentialPdfDownload.tsx`
- `src/components/players/PlayerCredentialCard.tsx` — botón PDF + texto actualizado

## 6. Tests y calidad

- `src/lib/export/csv.test.ts` — BOM UTF-8, escape CSV, slugify
- `npm run lint` / `npm run build` / `npm test` → **56/56 PASS**

## 7. Commit

`COMMIT_HASH_PLACEHOLDER` — `feat(frontend): add CSV/PDF exports and printable credential`  
Push: `origin/main`
