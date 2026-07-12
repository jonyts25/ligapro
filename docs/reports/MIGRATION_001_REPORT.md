# Migration 001 Report — Identity & Tenancy

## Qué se creó

| Artefacto | Ruta |
|-----------|------|
| Migración SQL | `supabase/migrations/20260712202205_create_identity_and_tenancy.sql` |
| Tests de aislamiento | `supabase/tests/001_identity_tenancy_isolation.sql` |
| Tipos TS | `src/types/database.ts` |
| Domain model actualizado | `docs/DOMAIN_MODEL.md` |
| Este reporte | `docs/reports/MIGRATION_001_REPORT.md` |

### Objetos de base de datos

- Tablas: `profiles`, `organizations`, `organization_members`
- Triggers: `handle_new_user` (auth.users → profiles), `prevent_last_owner_removal`, `organizations_wipe_members_before_delete`, `set_updated_at` en profiles/organizations
- Helpers RLS: `is_member_of`, `has_role_in_org`
- RPC: `create_organization_with_owner(p_name, p_slug)`
- RLS habilitado en las tres tablas (sin `USING (true)`)

## Decisiones tomadas

1. **Varios owners, nunca cero** — sin UNIQUE de owner; guard en trigger BEFORE DELETE/UPDATE.
2. **profiles vía trigger en `auth.users`** — no insert desde cliente; fallo del trigger aborta el signup.
3. **Roles** — solo `organization_owner`, `organization_admin`, `organization_member` (`platform_admin` fuera de alcance).
4. **Alta de org** — solo vía RPC; no hay policy INSERT en `organizations` para `authenticated`.
5. **Admin** — gestiona miembros no-owner y puede UPDATE de la org; no puede tocar owners ni promover a owner; no puede DELETE la org.
6. **Member** — solo lectura de su org y membresías.
7. **Bypass controlado al borrar org** — ver desviaciones.

## Profiles (Tarea F)

- Creación exclusiva por `handle_new_user` (`SECURITY DEFINER`, `search_path = public`) en `AFTER INSERT ON auth.users`.
- Si el INSERT a `profiles` falla, se relanza excepción → la transacción de signup falla → no queda `auth.users` huérfano sin profile.
- Onboarding posterior: `UPDATE` del propio profile (nombre, etc.), no recreación.

## Resultado de pruebas (Tarea H)

Mecanismo: script SQL procedural en `supabase/tests/001_identity_tenancy_isolation.sql`, ejecutado con:

```bash
npx supabase db query --linked -f supabase/tests/001_identity_tenancy_isolation.sql
```

Simula JWT con `set_config('request.jwt.claims' / 'request.jwt.claim.sub')` + `SET LOCAL ROLE authenticated`. No usa pgTAP (Docker local no requerido).

| Test | Resultado | Details |
|------|-----------|---------|
| 1a User A no lee org B | **PASS** | `org_b_visible_rows=0` |
| 1b User A no lee members de org B | **PASS** | `org_b_member_rows=0` |
| 2a Admin no se auto-promueve a owner | **PASS** | RLS policy violation |
| 2b Admin no promueve a otro a owner | **PASS** | RLS policy violation |
| 3 Member no UPDATE org | **PASS** | `updated_rows=0` |
| 4 Owner agrega members | **PASS** | admin + member insertados |
| 4b Owner quita member | **PASS** | `deleted_rows=1` |
| 5 `create_organization_with_owner` deja owner | **PASS** | `owner_count=1` |
| 6a No elimina último owner | **PASS** | exception last organization_owner |
| 6b No degrada último owner | **PASS** | exception last organization_owner |
| 7a Member no DELETE org | **PASS** | `deleted_rows=0` |
| 7b Owner DELETE org + cascade members | **PASS** | `deleted_rows=1 org_remaining=0 members_remaining=0` |

**12/12 PASS**

## Desviaciones respecto al prompt

1. **Timestamp remoto vs primer archivo local** — `supabase migration new` creó `20260712201729_…`; la aplicación vía MCP registró `20260712202205_…`. Se renombró el archivo local para alinear historial.
   - **Aprendizaje de proceso (obligatorio de aquí en adelante):** un solo flujo — `supabase migration new <name>` → editar el archivo generado → `supabase db push` (o el equivalente CLI linkeado). No aplicar la misma migración por MCP/`apply_migration` en paralelo al archivo local, para que el timestamp local y el remoto coincidan sin renombrar a mano.
2. **Bypass al borrar organización** — el trigger de último owner bloqueaba `ON DELETE CASCADE` de `organizations` → `organization_members`. Se añadió `organizations_wipe_members_before_delete` + flag de sesión `app.bypass_last_owner_guard` para permitir borrar la org completa sin debilitar el guard en operaciones normales de miembros. Necesario para continuidad operativa y para cleanup de tests.
3. **Patch remoto post-apply** — el bypass se aplicó con `execute_sql` sobre `ligapro-dev` después del primer apply; el archivo de migración local ya incluye el SQL completo para installs frescos.
4. **Tests no-pgTAP** — se usó script SQL + `db query --linked` en lugar de `supabase test db` (evita dependencia de stack local/Docker en este entorno).
5. **Duplicado vacío de migration new** — un segundo `migration new` (CLI colgado) se eliminó; quedó un solo archivo.

## Aplicación

- Proyecto: `ligapro-dev` (`akgcamaegpboewsbbevl`)
- Migración remota: `create_identity_and_tenancy` (version `20260712202205`)

## Pendiente manual / siguiente

- Revisar y aprobar este bloque antes de Migration 002 (venues/fields).
- No hay commit en este paso.
- UI/login sigue fuera de alcance.
