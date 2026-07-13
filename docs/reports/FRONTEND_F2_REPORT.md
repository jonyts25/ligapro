# Frontend F2 + Migration 011 — Reporte de entrega

**Fecha:** 2026-07-13  
**Base:** `99a9d1f` — `feat: frontend F1 authentication and protected routes`  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Verificación | Resultado |
| --- | --- |
| Working tree limpio al inicio | Sí (tras F1) |
| Commit F1 | `99a9d1f` |
| PO F1: login / sesión / 0 membresías → onboarding | PASS (documentado en `FRONTEND_F1_REPORT.md`) |
| Schema `organizations` pre-011 | `id, name, slug, created_at, updated_at, created_by` — **sin** branding |
| Schema `organization_members` | `organization_id, profile_id, role` (owner/admin/member) |
| RPC previa | `create_organization_with_owner(p_name, p_slug) RETURNS organizations` |
| Policies INSERT/UPDATE directas org | No para clientes; alta vía RPC |
| `has_role_in_org` / audit triggers 010 | Presentes; cubren insert/update org y members |
| Storage pre-011 | Sin buckets |
| Service role en cliente | Ausente |
| Usuario smoke `f1smoke45827195@gmail.com` | 0 membresías al inicio de F2 |
| Contradicciones materiales | Ninguna; **evolución intencional** de firma RPC documentada abajo |
| Mundial Compas | No tocado |

### Evolución API intencional

`create_organization_with_owner(p_name, p_slug)` → `create_organization_with_owner(p_name, p_brand_color DEFAULT NULL) RETURNS uuid`.

Suites 001–010 actualizadas solo para la nueva firma (no se debilitaron aserciones).

---

## 2. Schema real encontrado (post-011)

### `organizations`

| Columna | Notas |
| --- | --- |
| `name`, `slug` (único, auto) | slug generado en RPC |
| `brand_color` | NULL o `#RRGGBB` |
| `logo_path` | NULL o `{org_id}/{uuid}.{png\|jpg\|jpeg\|webp}` |
| `updated_at` | ya existía |

### RPCs

| Función | Retorno |
| --- | --- |
| `create_organization_with_owner(p_name, p_brand_color)` | `uuid` |
| `update_organization_branding(p_organization_id, p_name, p_brand_color)` | void |
| `set_organization_logo(p_organization_id, p_logo_path)` | void (NULL limpia) |

### Bucket

`organization-logos` — public, 2 MB, PNG/JPEG/WebP.

---

## 3–4. Archivos creados / modificados

### Creados

```
supabase/migrations/20260713004056_organization_onboarding_and_branding.sql
supabase/tests/011_organization_onboarding_branding.sql
docs/ORGANIZATION_BRANDING.md
docs/reports/FRONTEND_F2_REPORT.md
src/lib/organizations/{actions,action-state,action-types,branding-constants,get-organization}.ts
src/lib/auth/require-organization-admin.ts
src/lib/branding/{map-organization-branding,sanitize-accent}.ts
src/components/organizations/{OnboardingForm,OrganizationBrandingForm,OrganizationLogoUploader}.tsx
src/app/(protected)/organizaciones/[organizationId]/configuracion/page.tsx
```

### Modificados (principales)

```
onboarding/page.tsx, org layout/inicio, AppShell, nav/*, dashboard demo
next.config.ts (remotePatterns Storage)
docs/{DOMAIN_MODEL,DESIGN_SYSTEM,AUTHENTICATION}.md
docs/reports/FRONTEND_F1_REPORT.md (validación PO)
src/types/{database,branding}.ts
supabase/tests/001–010 (firma RPC)
```

---

## 5–6. Migration 011 / RPCs

Archivo: `20260713004056_organization_onboarding_and_branding.sql`  
Aplicada: `npx supabase db push --linked`  
Local = remote.

Seguridad: SECURITY DEFINER, `search_path = public`, REVOKE PUBLIC/anon, GRANT authenticated, actor = `auth.uid()`, sin `profile_id` externo.

---

## 7–8. Bucket y policies Storage

| Policy | Alcance |
| --- | --- |
| INSERT | owner/admin, carpeta = org, extensión válida |
| SELECT metadata | owner/admin de esa org |
| DELETE | owner/admin de esa org |
| UPDATE | **ninguna** |

Lectura de archivo vía URL pública del bucket; listado no es público.

---

## 9–10. Flujos

### Onboarding

0 membresías → formulario; 1 → `/inicio`; 2+ → selector.  
`createOrganizationAction` → RPC → `/configuracion?setup=1`.

### Logo

Cliente autenticado → upload path versionado → `setOrganizationLogoAction` / RPC → cleanup best effort del anterior.

### Branding UI

`--organization-accent` sanitizado; mapper `organization → OrganizationBranding`.

---

## 11. Matriz de permisos

| Rol | Ver branding | Config / editar | Crear 2ª org (F2) |
| --- | --- | --- | --- |
| owner | sí | sí | no (RPC) |
| admin | sí | sí | no |
| member | sí | no (`notFound`) | no |
| externo | no | no | — |
| anon | — | — | no EXECUTE |

---

## 12. Pruebas SQL 011 (40/40 PASS)

Todas PASS. Desviación documentada: tests 36/37 verifican **presencia/alcance** de policy DELETE (Storage `protect_delete` bloquea DELETE SQL directo en rol de prueba).

---

## 13. Regresiones

| Suite | Resultado |
| --- | --- |
| 008 | 35/35 PASS |
| 010 | 51/51 PASS |
| 011 | 40/40 PASS |

---

## 14. Pruebas frontend reales

### API autenticada (cuenta smoke, post-confirmación correo)

| # | Caso | Resultado |
| --- | --- | --- |
| — | Login `f1smoke…` + `TestPass123!` | PASS |
| 7–8 | Crear org + membership owner | PASS (`331fc7fa-…`, role owner) |
| 12 | Upload PNG + `set_organization_logo` | PASS |
| 11 | Reentrada a create rechazada | PASS (`User already belongs…`) |
| — | Rutas privadas sin sesión → login | PASS (307) |
| — | Manifest | PASS (200) |

### UI navegador (PO / manual restante)

Muchas del checklist P (viewport 375px, hydration, SVG/JPEG/WebP UI, member/otra org en UI) **no ejecutadas en browser** en esta entrega. Ver §15.

Usuario smoke **ya tiene** organización `Complejo F2 Smoke` con color `#0EA5E9` y logo PNG — apto para probar configuración/inicio en UI.

---

## 15. Pruebas no verificadas (browser)

- Form UX: preview color, errores nombre/color en UI, doble submit visual
- JPEG/WebP/SVG/>2MB desde UI
- Refresh branding en sidebar/topbar tras UI
- Quitar logo desde UI
- Acceso member / otra org desde UI
- 375px / PWA standalone / scroll horizontal / consola hydration

---

## 16–18. Validaciones

| Check | Resultado |
| --- | --- |
| `npx supabase db lint --linked` | Sin errores de schema |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| Tipos | `npx supabase gen types typescript --linked` → escrito UTF-8 sin BOM vía .NET (`>` de PowerShell produce UTF-16 — evitar) |

---

## 19. Migration list

001–011 local = remote, incluida `20260713004056`.

---

## 20. Git status (al cierre)

Branch `main` @ `99a9d1f`. Cambios F2 **sin stage / sin commit**. Working tree **sucio** (esperado).

---

## 21. Riesgos / desviaciones

1. Firma RPC cambiada (intencional); tests 001–010 adaptados.
2. DELETE Storage no ejercitado vía SQL (policy verificada; API Storage sí subió).
3. Objetos Storage de tests 011 / smoke pueden quedar; riesgo menor (branding público).
4. Tipos generados: `set_organization_logo.p_logo_path` tipado como `string` sin `null` — cast en action.
5. Pruebas UI browser incompletas (§15).

---

## 22. Mundial Compas

**No tocado.**

---

## 23. Confirmación front habitual

- Onboarding real + config identidad + logo + branding en AppShell.
- Nav Configuración solo owner/admin.
- Métricas dashboard siguen demo con badge.
- Sin venues/torneos/equipos/SW/service role.
- **Sin commit** — detenido para revisión.
