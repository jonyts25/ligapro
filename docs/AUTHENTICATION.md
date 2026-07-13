# Autenticación LigaPro (Frontend F1)

## Resumen

LigaPro usa **correo + contraseña** con Supabase Auth, sesión en cookies SSR (`@supabase/ssr`) y RLS como última barrera de autorización.

No hay OAuth, Magic Link, MFA ni service worker en F1.

## Arquitectura SSR

| Pieza | Ubicación | Rol |
| --- | --- | --- |
| Browser client | `src/lib/supabase/client.ts` | Solo Client Components |
| Server client | `src/lib/supabase/server.ts` | Server Components, Actions, Route Handlers |
| Proxy session updater | `src/lib/supabase/proxy.ts` | Refresco de sesión + redirects optimistas |
| Next.js Proxy | `src/proxy.ts` | Entrada del runtime (no `middleware.ts`) |

Adaptadores legacy en `src/lib/adapters/supabase/*` reexportan los clientes canónicos.

### Identidad

- Autorización server-side usa `getClaims()` (o helpers que la invocan).
- **No** se confía en `getSession().user` para decisiones de acceso.
- Layouts y páginas privadas vuelven a validar aunque el proxy haya pasado.

### Variables de entorno

Solo públicas:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

No existe service role en el frontend. Ninguna clave sensible usa `NEXT_PUBLIC_`.

## Rutas

### Públicas

- `/` → redirige según sesión
- `/iniciar-sesion`
- `/registro`
- `/confirmar-correo`
- `/recuperar-contrasena`
- `/actualizar-contrasena` (requiere sesión de recuperación)
- `/auth/callback`

### Privadas

- `/onboarding`
- `/seleccionar-organizacion`
- `/organizaciones/[organizationId]/inicio`

## Flujos

### Login

1. Validación server-side.
2. `signInWithPassword`.
3. Error genérico (no revela existencia de cuenta).
4. Destino vía membresías.

### Registro

1. Crea usuario Auth.
2. Trigger `handle_new_user` crea `profiles` (`display_name` desde metadata).
3. **No** crea organización ni membresía.
4. Con confirmación activa → `/confirmar-correo`.
5. Con sesión inmediata → destino por membresías (normalmente `/onboarding`).

### Recuperación

1. `resetPasswordForEmail` → callback con `next=/actualizar-contrasena`.
2. Respuesta siempre genérica.
3. Tras actualizar: `signOut` + login con mensaje de éxito.

### Callback

- Intercambia `code` por sesión.
- Solo acepta `next` interno permitido (`/`, `/onboarding`, `/actualizar-contrasena`, `/seleccionar-organizacion`).
- Rechaza URLs absolutas, `//…` y esquemas externos.

## Multi-organización

```text
0 membresías → /onboarding
1 membresía  → /organizaciones/{id}/inicio
2+           → /seleccionar-organizacion
```

No se guarda organización activa global. No se elige silenciosamente la primera.

Roles reales del schema:

- `organization_owner`
- `organization_admin`
- `organization_member`

## Profiles

- `profiles.id = auth.users.id`
- Creación automática por trigger `on_auth_user_created` → `handle_new_user()`
- Columnas: `email`, `display_name`, timestamps
- RLS: SELECT/UPDATE propios; INSERT solo por trigger

## Seguridad

1. Sin service role en cliente.
2. Sin tokens/passwords en logs.
3. Sin open redirect.
4. Sin autorización solo en cliente.
5. Membership verificada con `requireOrganizationMembership` + `notFound()` si no aplica.
6. Proxy no consulta tablas de negocio.
7. Logout real vía `signOut()` server action.
8. PWA sin cache de respuestas autenticadas (no hay SW).

## Configuración Supabase requerida

### Desarrollo (local `config.toml`)

```text
Site URL: http://localhost:3000
Redirect URLs:
  http://localhost:3000/auth/callback
  http://127.0.0.1:3000/auth/callback
enable_signup = true
enable_confirmations = false  # local default
```

### Hosted (proyecto `akgcamaegpboewsbbevl`)

Debe configurarse manualmente en Dashboard → Authentication:

```text
Site URL: http://localhost:3000   # o dominio real de deploy
Redirect URL: http://localhost:3000/auth/callback
(+ URL de producción cuando exista)
```

**No se empujó** `supabase config push` en F1.

El correo por defecto de Supabase basta para desarrollo; producción necesitará SMTP propio. Durante F1 se observó `over_email_send_rate_limit` en signup hosted.

## PWA y autenticación

- Manifest/iconos/metadata se conservan.
- Instalable sí; offline no.
- Auth requiere internet.

## Limitaciones actuales

- Sin creación de organizaciones (F2).
- Sin branding persistido.
- Dashboard org muestra datos demo etiquetados.
- Sin reenvío de correo de confirmación.
- Sin documentos legales reales (checkbox informativo).
