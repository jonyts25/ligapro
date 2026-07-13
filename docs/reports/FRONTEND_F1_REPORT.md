# Frontend F1 — Reporte de entrega

**Fecha:** 2026-07-13  
**Base:** `0d72c7a` — `feat: frontend F0 visual system, app shell and PWA base`  
**Estado:** listo para revisión · **sin commit**

---

## 1. Auditoría previa

| Verificación | Resultado |
| --- | --- |
| Working tree limpio al inicio | Sí |
| Commit F0 | `0d72c7a` |
| Browser/server clients | Existían en `src/lib/adapters/supabase/*` (básicos) |
| Middleware/proxy | No existía |
| Service role en `NEXT_PUBLIC_` | No |
| Env público | Solo URL + publishable/anon key |

### Profiles / tenancy (Migration 001)

- `profiles.id` → `auth.users.id`
- Trigger `on_auth_user_created` / `handle_new_user()` crea profile (email + `display_name` desde `raw_user_meta_data.display_name|full_name`)
- Confirmado en hosted: trigger presente
- RLS profiles: select/update propios; sin insert cliente
- `organization_members.role`: `organization_owner` \| `organization_admin` \| `organization_member`
- FK a `organizations` y `profiles`

### Estado real de profile creation

**Mecanismo correcto existente.** No se improvisó creación desde frontend. Signup solo envía metadata compatible.

### Supabase Auth (observable)

| Fuente | Hallazgo |
| --- | --- |
| `supabase/config.toml` local | signup email on; `enable_confirmations = false`; site_url actualizado a `http://localhost:3000` + callback redirects |
| Hosted signup probe | `429 over_email_send_rate_limit` → envío de correo activo / límites del provider |
| Hosted invalid login | `invalid_credentials` (400) |
| Dashboard redirects | **Pendiente manual** (no se ejecutó `config push`) |

El código soporta confirmación activa (sin sesión → `/confirmar-correo`) y desactivada (sesión → destino).

### UI F0

AppShell, branding, nav, PWA conservados; demo movida a `/organizaciones/[id]/inicio`.

Mundial Compas: **no tocado**.

---

## 2–3. Archivos creados / modificados

### Creados (principales)

```
src/lib/supabase/{client,server,proxy}.ts
src/proxy.ts
src/lib/auth/{types,validation,action-state,actions,get-current-user,require-user,get-user-memberships,resolve-auth-destination,require-organization-membership}.ts
src/app/(auth)/...
src/app/(protected)/...
src/app/auth/callback/route.ts
src/components/auth/*
src/components/layout/SignOutButton.tsx
src/features/dashboard/OrganizationDashboardDemo.tsx
docs/AUTHENTICATION.md
docs/reports/FRONTEND_F1_REPORT.md
docs/reports/assets/frontend-f1/*
scripts/frontend-f1-smoke.cjs
```

### Modificados

```
src/app/page.tsx
src/lib/adapters/supabase/{client,server}.ts  (reexport)
src/components/layout/{AppShell,Sidebar,TopBar,MobileNavigation,MobileMoreDrawer,nav-items}.ts(x)
supabase/config.toml  (site_url + redirect URLs locales)
eslint.config.mjs     (ignore scripts/)
```

---

## 4. Rutas

Públicas: `/`, `/iniciar-sesion`, `/registro`, `/confirmar-correo`, `/recuperar-contrasena`, `/actualizar-contrasena`, `/auth/callback`  
Privadas: `/onboarding`, `/seleccionar-organizacion`, `/organizaciones/[organizationId]/inicio`

---

## 5. Server Actions

`signInAction`, `signUpAction`, `signOutAction`, `requestPasswordResetAction`, `updatePasswordAction` en `src/lib/auth/actions.ts`.

---

## 6. Helpers

`getCurrentUser`, `requireUser`, `getUserMemberships`, `resolveAuthDestination`, `requireOrganizationMembership`.

---

## 7. Proxy

`src/proxy.ts` + `updateSession`:

- `getClaims()` para refrescar/validar
- Redirect privado sin sesión → login
- Redirect auth pages con sesión → `/`
- Matcher excluye static/PWA/iconos
- Sin consultas de membresías

---

## 8. Matriz de redirects

| Condición | Destino |
| --- | --- |
| Sin sesión → `/` o privada | `/iniciar-sesion` |
| Con sesión → login/registro | `/` → destino membresías |
| 0 membresías | `/onboarding` |
| 1 membresía | `/organizaciones/{id}/inicio` |
| 2+ | `/seleccionar-organizacion` |
| Callback `next` inválido/externo | login genérico |
| Logout | `/iniciar-sesion` |

---

## 9. Seguridad

Verificado en código:

1. Sin service role cliente  
2. Sin passwords/tokens en logs  
3. Sin `getSession().user` para authz  
4. Callback con allowlist  
5. Membership + `notFound()`  
6. Proxy ≠ única barrera  
7. Errores genéricos login/registro/reset  
8. Logout server-side  

---

## 10. Pruebas manuales / smoke reales

Fuente: `docs/reports/assets/frontend-f1/smoke-results.json` + probes Auth API.

| # | Prueba | Resultado |
| --- | --- | --- |
| 1 | `/` sin sesión → login | PASS |
| 2 | Privada sin sesión → login | PASS |
| 3 | Login inválido mensaje genérico | PASS |
| 4–7 | Login válido / refresh / logout / auth gate | **No verificadas** (sin cuenta de prueba usable + rate limit email) |
| 8–10 | Validaciones registro UI | Parcial (formulario visible; submit email rate-limited) |
| 11–13 | Confirmación / no revelar email | Código listo; email **no verificado** (429) |
| 14–18 | Multi-tenant real | **No verificadas** (requieren usuarios/membresías controladas) |
| 19 | Reset respuesta genérica | Código listo; envío email **no verificado** |
| 20–21 | Callback next interno/externo | PASS (externo / `//` → login) |
| 22–23 | Update password / link expirado | **No verificadas** (dependen de email) |
| 24–25 | UI mobile/desktop registro | PASS (capturas) |
| 26 | Hydration | Warning Playwright por `caret-color` inyectado en inputs — no reproducible como bug de app; sin errores 500 tras fix actions |
| 27 | Consola | Tras fix: sin error use-server; warning hydration de automatización |
| 28 | Manifest | PASS |
| 29 | 404 auth flow | PASS en rutas del flujo |

---

## 11. Pruebas no verificadas

- Registro completo con correo (rate limit hosted)
- Confirmación de correo end-to-end
- Login válido + refresh cookies
- Logout tras sesión real
- 0/1/N membresías con usuarios reales
- Aislamiento org A vs org B con dos cuentas
- Update password vía link de recuperación

---

## 12–13. Lint / build

```
npm run lint  → PASS
npm run build → PASS (Proxy detectado)
```

---

## 14. Git status

```
On branch main (up to date with origin/main)
Modified: eslint.config.mjs, page.tsx, AppShell/nav layout files, adapters, config.toml
Untracked: auth routes, helpers, proxy, docs F1, smoke assets/script
Sin commit (pendiente aprobación)
```

`git diff --stat` (tracked): 11 files, +159 / −248  
Untracked adicionales no incluidos en ese stat.

---

## 15. Configuración Supabase pendiente (manual)

En Dashboard del proyecto `akgcamaegpboewsbbevl`:

1. **Authentication → URL configuration**
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`
2. Confirmar estado real de **Confirm email**
3. Para deploy: agregar dominio real + callback
4. Producción: SMTP propio (el default tiene rate limit)

No se cambió SMTP ni providers.

---

## 16. Riesgos

- Rate limit de email bloquea smoke de registro/recuperación en hosted
- Redirect URLs hosted pueden no coincidir aún con localhost
- Deep-link `next=/organizaciones/...` no está en allowlist post-login (se resuelve por membresías; intencional en F1)
- Datos demo en dashboard org deben reemplazarse en F2/F3

---

## Confirmaciones

- Mundial Compas: no modificado  
- Schema/migrations: no modificados  
- F2: no iniciado  
- Commit: no realizado
