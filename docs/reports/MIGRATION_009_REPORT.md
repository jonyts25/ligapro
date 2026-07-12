# Migration 009 Report — Finanzas básicas por equipo/temporada

## Auditoría previa

| Check | Resultado |
|-------|-----------|
| Working tree limpio al inicio del bloque | ✓ |
| `main` @ `42a6bef` (001–008b commiteadas) | ✓ |
| Migrations 001–008b local = remote | ✓ |
| Columnas `season_teams`: id, season_id, team_id, organization_id, display_name, group_name, registration_status | ✓ |
| season_team → season → organization (denormalizado + triggers) | ✓ |
| Roles `organization_members`: owner, admin, member | ✓ |
| `has_role_in_org(org_id, roles[])` vía `auth.uid()` | ✓ |
| `auth.uid()` = `profiles.id` | ✓ |
| Migration 008/008b commiteada antes de avanzar | ✓ |
| Contradicciones con el prompt | **ninguna** |
| Mundial Compas | **no tocado** |

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración 009 | `supabase/migrations/20260712232530_create_team_finance.sql` |
| Tests (35) | `supabase/tests/009_team_finance.sql` |
| Tipos TS | `src/types/database.ts` (regenerado) |
| Domain model | `docs/DOMAIN_MODEL.md` (bloque 009) |
| Product scope | `docs/PRODUCT_SCOPE.md` (aclaración pagos manuales vs digitales) |
| Este reporte | `docs/reports/MIGRATION_009_REPORT.md` |

## Tablas

### `team_charges`

Cargos manuales por `season_team`. Tipos: `registration`, `referee_fee`, `fine`, `other`. Monto `> 0`, `currency` default `MXN` con CHECK `currency = 'MXN'` (MVP). Campos de anulación all-or-none. FK `season_team_id` ON DELETE **RESTRICT**.

### `team_payments`

Pagos manuales registrados por owner/admin. Métodos: `cash`, `transfer`, `card`, `other`. `reference` y `notes` privados. Mismas reglas de monto, moneda y anulación.

## Constraints

- `amount > 0` en ambas tablas
- `currency = 'MXN'` únicamente (MVP; columna retenida para ampliación futura)
- `charge_type` / `payment_method` enums vía CHECK
- Anulación: `voided_at` NULL ⇒ sin `voided_by` ni `void_reason`; si anulado ⇒ los tres obligatorios y `void_reason` no vacío
- Sin estado `paid`/`pending` — saldo calculado

## Triggers

| Trigger | Función | Propósito |
|---------|---------|-----------|
| `team_charges_set_updated_at` | `set_updated_at` | timestamps |
| `team_payments_set_updated_at` | `set_updated_at` | timestamps |
| `team_charges_enforce_org_matches_season_team` | SECURITY DEFINER | tenant: `organization_id` = `season_teams.organization_id` |
| `team_payments_enforce_org_matches_season_team` | SECURITY DEFINER | idem |
| `team_charges_enforce_insert_actor` | SECURITY DEFINER | `created_by_profile_id = auth.uid()` + membresía org |
| `team_payments_enforce_insert_actor` | SECURITY DEFINER | `recorded_by_profile_id = auth.uid()` + membresía org |
| `team_charges_prevent_mutation` | `team_financial_prevent_mutation` | bloquea UPDATE/DELETE directo; permite void vía `app.financial_void` |
| `team_payments_prevent_mutation` | idem | idem |

## RLS

| Tabla | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `team_charges` | owner/admin org | owner/admin; actor = `auth.uid()`; sin campos void | — (sin policy) | — |
| `team_payments` | owner/admin org | owner/admin; actor = `auth.uid()`; sin campos void | — | — |

`REVOKE ALL` de PUBLIC y anon en tablas y vista. `GRANT SELECT, INSERT` a `authenticated` en tablas; `GRANT SELECT` en vista.

## RPCs

| RPC | Autorización | Notas |
|-----|--------------|-------|
| `void_team_charge(p_charge_id, p_reason)` | owner/admin de la org del cargo | SECURITY DEFINER, `search_path = public`, motivo obligatorio, idempotencia rechazada si ya anulado |
| `void_team_payment(p_payment_id, p_reason)` | owner/admin de la org del pago | idem |

`REVOKE EXECUTE` de PUBLIC y anon. `GRANT EXECUTE` solo a `authenticated`. Sin parámetro `profile_id` externo.

## Vista privada

`season_team_financial_summary` (`security_invoker = true`):

- Filtra filas con `has_role_in_org(..., ['organization_owner','organization_admin'])`
- Agrega por `season_team_id` + `currency`
- `balance_due = total_active_charges - total_active_payments`
- Incluye `season_teams` sin movimientos (ceros MXN)
- MVP solo MXN; habilitar otras monedas requiere migración explícita del CHECK
- Agrupa por `currency` para no mezclar monedas si se amplía después

## Matriz de permisos

| Actor | SELECT cargos/pagos/vista | INSERT | void RPCs |
|-------|---------------------------|--------|-----------|
| organization_owner | ✓ (su org) | ✓ | ✓ |
| organization_admin | ✓ (su org) | ✓ | ✓ |
| organization_member | ✗ | ✗ | ✗ |
| tournament_admin | ✗ | ✗ | ✗ |
| captain / referee / delegate | ✗ | ✗ | ✗ |
| anon | ✗ | ✗ | ✗ |
| PUBLIC (EXECUTE RPC) | — | — | ✗ |

## Resultado individual de pruebas — **37/37 PASS**

| # | Test | Resultado | Detalle |
|---|------|-----------|---------|
| 1 | org A no lee cargos de B | **PASS** | visible_charges=0 |
| 2 | org A no lee pagos de B | **PASS** | visible_payments=0 |
| 3 | member no lee finanzas propia org | **PASS** | member_visible_charges=0 |
| 4 | tournament_admin no lee pagos | **PASS** | visible=0 |
| 5 | admin crea cargo válido | **PASS** | charge_id asignado |
| 6 | owner crea cargo válido | **PASS** | charge_id asignado |
| 7 | organization_id distinto falla | **PASS** | trigger membresía/org |
| 8 | amount = 0 falla | **PASS** | CHECK constraint |
| 9 | amount negativo falla | **PASS** | CHECK constraint |
| 10 | charge_type inválido falla | **PASS** | CHECK constraint |
| 11 | USD (no-MXN) falla | **PASS** | CHECK `currency = 'MXN'` |
| 11b | MXN explícito aceptado | **PASS** | insert + void helper |
| 11c | default currency = MXN | **PASS** | charge sin currency explícita |
| 12 | admin registra pago válido | **PASS** | payment_id asignado |
| 13 | payment_method inválido falla | **PASS** | CHECK constraint |
| 14 | recorded_by ≠ auth.uid() falla | **PASS** | trigger actor |
| 15 | member no inserta cargo | **PASS** | RLS |
| 16 | member no inserta pago | **PASS** | RLS |
| 17 | vista saldo correcta | **PASS** | 1500 / 300 / balance 1200 MXN |
| 18 | pago > cargos → saldo a favor | **PASS** | balance_due=-800 |
| 19 | cargo anulado no cuenta | **PASS** | charges=1500 tras void 200 |
| 20 | pago anulado no cuenta | **PASS** | payments=2300 tras void 100 |
| 21 | void sin reason falla | **PASS** | void reason is required |
| 22 | no void dos veces | **PASS** | already voided |
| 23 | member no void charge | **PASS** | Not authorized |
| 24 | tournament_admin no void payment | **PASS** | Not authorized |
| 25 | anon no ejecuta RPCs | **PASS** | permission denied |
| 26 | no UPDATE directo amount | **PASS** | updated_rows=0 amount=500 |
| 27 | no DELETE directo cargos | **PASS** | deleted_rows=0 |
| 28 | no DELETE directo pagos | **PASS** | deleted_rows=0 |
| 29 | season_team sin movimientos → cero | **PASS** | 0/0/0 MXN |
| 30 | org B no contamina resumen org A | **PASS** | org_b_rows=0 |
| 31 | PUBLIC sin EXECUTE RPCs | **PASS** | public_has_execute=f |
| 32 | anon sin SELECT | **PASS** | permission denied |
| 33 | anulado conserva datos originales | **PASS** | amount=200 type=fine |
| 34 | insert tras anular sigue permitido | **PASS** | nuevos ids creados |
| 35 | FK RESTRICT season_team | **PASS** | FK violation al DELETE |

**Acumulado proyecto: 177/177 PASS** (140 previas + 37 de 009).

## Validaciones

```
db push --linked     → Applied 20260712232530_create_team_finance.sql
db lint --linked     → No schema errors found
migration list       → local=remote through 20260712232530
npm run lint         → exit 0
npm run build        → OK (Next.js 16.2.10)
```

## Comando tipos

```powershell
npx supabase gen types typescript --project-id akgcamaegpboewsbbevl | node -e "const fs=require('fs'); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>fs.writeFileSync('src/types/database.ts', d, {encoding:'utf8'}));"
```

(PowerShell no soporta `utf8NoBOM` en `Out-File`; se escribió UTF-8 sin BOM vía Node.)

## Desviaciones / riesgos

1. **Currency MVP:** CHECK endurecido a `currency = 'MXN'` (antes `^[A-Z]{3}$`). Columna y agrupación por currency se conservan; otras monedas requieren migración explícita.
2. **Test 7:** con `organization_id` incorrecto, el trigger de actor/membresía puede dispararse antes que el de tenant; ambos rechazan el insert — comportamiento aceptable.
3. **Test 26:** sin policy UPDATE, RLS bloquea silenciosamente (0 filas); el trigger de inmutabilidad actuaría si hubiera policy — defensa en profundidad OK.
4. **Cleanup tests:** teardown deshabilita temporalmente triggers de mutación para permitir CASCADE al borrar orgs de prueba; no afecta producción.
5. **DELETE org con historial financiero:** CASCADE en `organization_id` choca con trigger anti-DELETE en filas hijas; borrar org con finanzas requiere flujo explícito futuro (fuera de MVP).
6. Warning Docker en cache local de migraciones; push remoto OK.

## Pendientes post-009

- Migration 010: `audit_log`
- UI de finanzas
- Vistas públicas
- Pagos digitales / CFDI / sponsors
- Acceso financiero para captains (futuro)

Commit pendiente de aprobación humana.
