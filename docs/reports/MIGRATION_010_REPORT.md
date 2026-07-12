# Migration 010 Report — Audit log inmutable y multi-tenant

## Auditoría previa

| Check | Resultado |
|-------|-----------|
| Working tree limpio al inicio | ✓ |
| `main` @ `1fdbddd` (001–009) | ✓ |
| Migrations 001–009 local = remote | ✓ |
| Identidad Git configurada (`Jonathan Rosique` / `jonmaldini@gmail.com`) | ✓ |
| Tablas con `organization_id` directo | todas las auditadas excepto `organizations` (usa `id`) |
| `profiles` | no auditada (identidad global) |
| Contradicciones | **ninguna** |
| Mundial Compas | **no tocado** |

### Tablas auditables (010)

`organizations`, `organization_members`, `venues`, `fields`, `field_availability_rules`, `field_reservations`, `competitions`, `seasons`, `season_rules`, `season_roles`, `teams`, `players`, `season_teams`, `season_team_players`, `matches`, `match_officials`, `match_events`, `discipline_suspensions`, `team_charges`, `team_payments`.

### Columnas sensibles excluidas

| Tabla | Exclusiones |
|-------|-------------|
| `team_payments` | `reference`, `notes` |
| `team_charges` | `description` |
| `discipline_suspensions` | `notes` |
| `players` | sin columnas PII extra en schema actual |
| `organization_members` | sin datos privados más allá de ids/role |

### Caso especial sin `organization_id`

Solo `organizations`: `audit_log.organization_id = organizations.id`.

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración 010 | `supabase/migrations/20260712233742_create_audit_log.sql` |
| Tests (45) | `supabase/tests/010_audit_log.sql` |
| Teardown 007/008/009 | adaptados por FK RESTRICT + inmutabilidad |
| Tipos TS | `src/types/database.ts` |
| Domain model | `docs/DOMAIN_MODEL.md` |
| Product scope | `docs/PRODUCT_SCOPE.md` |
| Este reporte | `docs/reports/MIGRATION_010_REPORT.md` |

## Tabla

`audit_log` — append-only, sin `updated_at`. FK `organization_id` ON DELETE **RESTRICT**. Actions: `insert`/`update`/`delete`. Sources: `database_trigger` (default), `system_trigger` (reservado).

## Función trigger

`audit_row_change()` — SECURITY DEFINER, `search_path = public`, sin EXECUTE para PUBLIC/anon/authenticated.

- Resuelve org desde `organization_id` o `organizations.id`
- Actor = `auth.uid()` (nullable)
- Snapshots JSONB con exclusiones vía `TG_ARGV[0]`
- `changed_fields` omite `updated_at`; UPDATE solo-técnico no genera fila
- Flags sesión: `app.skip_audit`, `app.audit_allow_delete` (teardown controlado)

`audit_log_prevent_mutation` bloquea UPDATE/DELETE salvo `app.audit_allow_delete=true`.

## Triggers instalados

AFTER INSERT OR UPDATE OR DELETE en las 20 tablas listadas arriba. Exclusiones:

- `discipline_suspensions` → `'notes'`
- `team_charges` → `'description'`
- `team_payments` → `'reference,notes'`

## Tablas no auditadas

| Tabla | Motivo |
|-------|--------|
| `profiles` | identidad global, sin tenancy org simple |
| `audit_log` | evita recursión |

## RLS / privilegios

| Operación | Quién |
|-----------|-------|
| SELECT | owner/admin de la misma org |
| INSERT/UPDATE/DELETE app | **ninguno** (solo trigger DEFINER) |
| anon / PUBLIC | sin privilegios |

## Matriz de permisos

| Actor | SELECT audit_log | Mutar audit_log |
|-------|------------------|-----------------|
| organization_owner | ✓ su org | ✗ |
| organization_admin | ✓ su org | ✗ |
| organization_member | ✗ | ✗ |
| tournament_admin | ✗ | ✗ |
| captain / referee / delegate | ✗ | ✗ |
| anon | ✗ | ✗ |

## Resultado individual pruebas 010 — **45/45 PASS**

| # | Test | Resultado |
|---|------|-----------|
| 1 | owner lee logs propios | **PASS** |
| 2 | admin lee logs propios | **PASS** |
| 3 | member no lee | **PASS** |
| 4 | tournament_admin no lee | **PASS** |
| 5 | org A no lee org B | **PASS** |
| 6 | anon no lee | **PASS** |
| 7 | authenticated no inserta | **PASS** |
| 8 | owner no UPDATE | **PASS** |
| 9 | owner no DELETE | **PASS** |
| 10 | create org audita con org.id | **PASS** |
| 11 | insert member audita | **PASS** |
| 12 | update role before/after | **PASS** |
| 13 | delete member before + after NULL | **PASS** |
| 14 | removido no lee logs | **PASS** |
| 15 | field_reservation insert | **PASS** |
| 16 | season_rules changed_fields | **PASS** |
| 17 | solo updated_at no genera log | **PASS** |
| 18 | season_role insert | **PASS** |
| 19 | season_team_player insert | **PASS** |
| 20 | match insert | **PASS** |
| 21 | update_match_result audita | **PASS** |
| 22 | match_official insert | **PASS** |
| 23 | match_event insert | **PASS** |
| 24 | red_card + suspension log | **PASS** |
| 25 | team_charge insert | **PASS** |
| 26 | team_payment insert | **PASS** |
| 27 | void charge → update audit | **PASS** |
| 28 | void payment → update audit | **PASS** |
| 29 | changed_fields void_* | **PASS** |
| 30 | sin `reference` | **PASS** |
| 31 | sin `notes` (payment) | **PASS** |
| 32 | sin `description` | **PASS** |
| 33 | players sin PII inventada | **PASS** |
| 34 | actor = auth.uid() | **PASS** |
| 35 | entity_type/id correctos | **PASS** |
| 36 | INSERT snapshot shape | **PASS** |
| 37 | UPDATE snapshot shape | **PASS** |
| 38 | DELETE snapshot shape | **PASS** |
| 39 | PUBLIC sin EXECUTE | **PASS** |
| 40 | anon sin privilegios | **PASS** |
| 41 | org DELETE RESTRICT | **PASS** |
| 42 | aislamiento entre orgs | **PASS** |
| 43 | sin auto-auditoría | **PASS** |
| 44 | paths finanzas OK | **PASS** |
| 45 | paths disciplina/captura OK | **PASS** |

## Regresión 007–009

| Suite | Resultado |
|-------|-----------|
| 007 discipline_suspensions | **11/11 PASS** |
| 008 season_roles_and_capture | **35/35 PASS** |
| 009 team_finance | **37/37 PASS** |

Teardown adaptado: `app.skip_audit` + `app.audit_allow_delete` + delete `audit_log` antes de borrar orgs (FK RESTRICT). Motivo documentado en los tres archivos de test.

**Acumulado proyecto: 222 PASS** (177 previas + 45 nuevas). Regresiones no suman de nuevo.

## Validaciones

```
db push --linked     → Applied 20260712233742_create_audit_log.sql
db lint --linked     → No schema errors found
migration list       → local=remote through 20260712233742
npm run lint         → exit 0
npm run build        → OK (Next.js 16.2.10)
```

## Comando tipos

```powershell
npx supabase gen types typescript --project-id akgcamaegpboewsbbevl | node -e "const fs=require('fs'); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>fs.writeFileSync('src/types/database.ts', d, {encoding:'utf8'}));"
```

## Desviaciones / riesgos

1. **`source = system_trigger`:** no se distingue aún la suspensión auto-generada de 007 (evitar tocar lógica 007). Se usa `database_trigger`; `actor_profile_id` sigue siendo el usuario de la transacción.
2. **Orgs con historial:** no se pueden borrar físicamente (FK RESTRICT y/o CASCADE bloqueado por finanzas inmutables). Archivar es pendiente futuro.
3. **Teardown tests (010b):** `DISABLE TRIGGER USER` + `audit_log_prevent_mutation` desde runner privilegiado; sin flags de sesión.
4. **Test 41:** DELETE org puede fallar por FK `audit_log` RESTRICT o por trigger inmutable de `team_charges` durante CASCADE — ambos demuestran imposibilidad de borrado físico con historial.

---

## Migration 010b — Eliminación de bypasses de sesión

| Artefacto | Ruta |
|-----------|------|
| Migración 010b | `supabase/migrations/20260712234811_remove_audit_session_bypasses.sql` |
| Tests ampliados | `supabase/tests/010_audit_log.sql` (46–51) |
| Teardown 007–010 | `DISABLE TRIGGER USER` explícito |

### Funciones modificadas (CREATE OR REPLACE)

- `audit_row_change()` — eliminado `app.skip_audit`
- `audit_log_prevent_mutation()` — eliminado `app.audit_allow_delete`

### Guarantee

> Un usuario de aplicación no puede omitir, modificar ni eliminar auditorías, aunque establezca `app.skip_audit` o `app.audit_allow_delete`.

### Pruebas 46–51 — **6/6 PASS**

| # | Test | Resultado |
|---|------|-----------|
| 46 | `app.skip_audit` sin efecto | **PASS** |
| 47 | `app.audit_allow_delete` sin efecto en DELETE | **PASS** |
| 48 | UPDATE imposible con flag | **PASS** |
| 49 | ambos flags no bypass | **PASS** |
| 50 | updated_at-only omitido | **PASS** |
| 51 | sin EXECUTE expuesto / sin RPC cleanup | **PASS** |

### Regresión post-010b

| Suite | Resultado |
|-------|-----------|
| 007 | **11/11 PASS** |
| 008 | **35/35 PASS** |
| 009 | **37/37 PASS** |
| 010 | **51/51 PASS** |

**Acumulado: 228 PASS** (222 + 6 nuevas de hardening).

## Pendientes post-010

- Archivar organizaciones (status) en lugar de DELETE físico
- Distinguir `system_trigger` sin romper 007 (opcional)
- Vistas públicas / standings / UI
- Migration 011+ fuera del modelo v0 congelado

Commit pendiente de aprobación humana.
