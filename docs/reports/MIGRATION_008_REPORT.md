# Migration 008 Report — Season Roles & Controlled Capture

## Historial de migraciones (corregido)

| Timestamp | Archivo | Rol |
|-----------|---------|-----|
| `20260712230305` | `create_season_roles_and_capture.sql` | Migration 008 **original** (estado aplicado al remoto la primera vez) |
| `20260712231724` | `harden_season_roles_and_capture.sql` | Parche de hardening (idempotente) |

### Por qué se separaron

La 008 original ya estaba aplicada en `ligapro-dev`. El hardening se aplicó después de forma manual vía `supabase/tests/_apply_008_hardening.sql`, lo que dejaba el archivo 008 local distinto del remoto y un historial no reproducible.

**Corrección:** se restauró `20260712230305` al SQL original y se versionó el parche en `20260712231724`. El script auxiliar `_apply_008_hardening.sql` fue **retirado**; su contenido vive solo en la migración versionada.

Una instalación limpia reproduce el estado final con:

```text
supabase db push
→ 008 create_season_roles_and_capture
→ 008b harden_season_roles_and_capture
```

sin scripts auxiliares.

## Auditoría previa

| Check | Resultado |
|-------|-----------|
| Working tree limpio al inicio del bloque | ✓ |
| `main` @ `f3bfaec` (001–007) | ✓ |
| Columnas marcador: `home_score`, `away_score`, `status` | ✓ |
| `auth.uid()` = `profiles.id` = `organization_members.profile_id` | ✓ |
| Mundial Compas | **no tocado** |

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración 008 | `supabase/migrations/20260712230305_create_season_roles_and_capture.sql` |
| Migración 008b hardening | `supabase/migrations/20260712231724_harden_season_roles_and_capture.sql` |
| Tests | `supabase/tests/008_season_roles_and_capture.sql` |
| Audit helper (no schema) | `supabase/tests/_audit_008_functions.sql` |
| Tipos TS | `src/types/database.ts` |
| Domain model | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_008_REPORT.md` |

### Objetos (008 + 008b)

**Tabla:** `season_roles` (+ FK compuesta → `organization_members` ON DELETE CASCADE en 008b)

**Triggers:** org-vs-season, membership-on-insert, `set_updated_at`, `match_events_prevent_reparent`

**Funciones:** `has_season_role` (con JOIN membresía vigente), `can_capture_match`, `update_match_result`

**Policies:** season_roles CRUD owner/admin; match_events INSERT tournament_admin / confirmed official; **sin** UPDATE aditivo (eliminado en 008b)

## Matriz final de permisos

| Actor | match_events | matches score/status | match_officials |
|-------|--------------|----------------------|-----------------|
| organization_owner/admin | CRUD (006b) | UPDATE directo (006a) | CRUD (006a) |
| tournament_admin | **INSERT** season-wide only | `update_match_result()` | — |
| referee/delegate | **INSERT** en su match (season_role + confirmed) | denied | — |
| assistant/scorekeeper | sin cambios | sin cambios | — |

## SECURITY DEFINER audit

| Función | search_path | PUBLIC | anon | authenticated | profile_id arg |
|---------|-------------|--------|------|---------------|----------------|
| `has_season_role` | `public` | false | false | true | no |
| `can_capture_match` | `public` | false | false | true | no |
| `update_match_result` | `public` | false | false | true | no |

## Resultado de pruebas — **35/35 PASS**

| Rango | Resultado |
|-------|-----------|
| 1–24 originales | **PASS** |
| **25–27** membresía revocada / CASCADE | **PASS** |
| **28–31** INSERT-only + admin CRUD | **PASS** |
| **32–34** security grants / no impersonation | **PASS** |

**Acumulado proyecto: 140/140 PASS** (105 previas + 35 nuevas).

## Validaciones

```
db push --linked     → Applied 20260712231724_harden_season_roles_and_capture.sql
db lint --linked     → No schema errors found
migration list       → local=remote through 20260712231724
npm run lint         → exit 0
npm run build        → OK
```

## Desviaciones

1. Hardening se versionó en migración separada (no se reescribió el historial remoto de 008).
2. `DROP POLICY IF EXISTS` en 008b emitió NOTICE en `ligapro-dev` (policies ya ausentes por apply manual previo) — esperado e idempotente.
3. Warning Docker en cache local; push remoto OK.

## Pendientes post-008

- RPC corregir/anular `match_events` + reconciliación `discipline_suspensions`
- Descuento automático `matches_remaining`
- `team_charges`, vistas públicas, UI

## Comando tipos

```powershell
npx supabase gen types typescript --project-id akgcamaegpboewsbbevl
```

Commit pendiente de aprobación humana.
