# ADR 0019 — App nativa Expo y web Next.js (dos superficies)

**Estado:** Proposed (Jonathan aprueba después)  
**Migration:** ninguna  
**Reporte relacionado:** `docs/reports/0.6_SERVER_ACTIONS_INVENTORY.md`

## Contexto

Ligera opera hoy como web Next.js 16 para el organizador en computadora. El producto necesita una **segunda superficie**: app nativa en App Store y Google Play para árbitro, anotador, capitán, jugador y admin **en la cancha**.

Apple rechaza apps que son un contenedor web (WKWebView cargando la URL del producto). La interfaz de la app debe ir **empaquetada** en el binario, no servida desde el dominio web.

Mucha lógica de negocio ya vive en RPCs de Postgres con RLS (`record_match_event`, `update_match_result`, etc.). La app puede invocarlos directamente con `@supabase/supabase-js` y la sesión JWT del usuario, sin pasar por server actions de Next.js cuando no hay secretos de servidor.

Inventario de server actions (Parte 0.6): **91 acciones** en 22 archivos — **45 categoría A** (portables con supabase-js), **13 categoría B** (requieren servidor/secrets), **33 categoría C** (mixtas). Ver reporte para detalle por acción.

## Decisión

### 1. Dos superficies, un backend Supabase

| Superficie | Stack | Usuarios / uso |
| --- | --- | --- |
| **Web** | Next.js 16 (actual, sin reemplazar) | Organizador: configurar temporada, importar datos, finanzas, aprobar resultados, fixture, plataforma |
| **App móvil** | Expo SDK 57, React Native, expo-router, TypeScript | Operación en cancha: árbitro, anotador, capitán, jugador, admin móvil |

Ambas hablan con el **mismo proyecto Supabase** (`ligapro-dev` en desarrollo). No se duplica base de datos ni lógica RPC.

### 2. App nativa con Expo (no Capacitor)

**Elegido:** Expo (React Native + expo-router + TypeScript), carpeta `mobile/` en la raíz del repo.

**Alternativa descartada: Capacitor** envolviendo la web Next.js.

Razones:

1. **Apple:** una web envuelta sigue siendo web remota; no cumple el requisito de UI empaquetada y arriesga rechazo.
2. **Server actions:** Capacitor reutilizaría componentes web, pero **86 de 91** acciones dependen de cookies SSR, `redirect()`, platform staff o secretos — no son invocables desde WebView sin reescribir de todos modos. Capacitor no elimina el trabajo de portar la capa de datos.
3. **UX en cancha:** captura de eventos, gestos, offline y rendimiento se sienten más nativos con React Native que con DOM en WebView.
4. **Inventario:** solo **45 acciones (49 %)** son categoría A (directo supabase-js). **13 (14 %)** son categoría B obligatorias en servidor. Capacitor no reduce ese split.

### 3. Cómo habla la app con el backend

```
┌─────────────┐     JWT (Authorization)      ┌──────────────────┐
│  App Expo   │ ────────────────────────────►│  Supabase        │
│  supabase-js│     RPC / SELECT / RLS       │  (Postgres+Auth) │
└─────────────┘                              └──────────────────┘
       │
       │  Solo categoría B (secretos, IA, email, tokens)
       ▼
┌─────────────────────────────────────────────┐
│  Next.js route handlers  /api/mobile/*      │
│  Auth: Bearer JWT Supabase (no cookies)     │
└─────────────────────────────────────────────┘
```

- **Categoría A:** la app llama RPCs y queries con `@supabase/supabase-js` usando `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY`. RLS y RPCs enforcement en Postgres.
- **Categoría B:** la app llama **route handlers** Next.js bajo `/api/mobile/*`. Autenticación: header `Authorization: Bearer <access_token>` validado con el JWT de Supabase (mismo proyecto). **Nunca cookies** de sesión web.
- **Categoría C:** evaluar por acción; en fase 1 (árbitro/anotador) la parte portable suele ser el RPC; la capa admin/redirect se omite o se expone vía endpoint mobile.

**Route handlers vs Supabase Edge Functions:** elegimos route handlers en Railway porque (a) Next.js ya corre ahí con `ANTHROPIC_API_KEY` y variables de entorno de plataforma, (b) un solo despliegue para web admin y API mobile B, (c) Edge Functions implicarían segundo pipeline, secrets duplicados y cold starts para funcionalidad que hoy vive en server actions de Next. Edge Functions quedan como alternativa futura si un endpoint mobile debe estar más cerca de Supabase o desacoplado de Railway.

**Endpoints prioritarios fase 1** (árbitro/anotador; ver reporte 0.6):

| Método | Ruta | Notas |
| --- | --- | --- |
| GET | `/api/mobile/matches` | «Mis partidos» |
| GET | `/api/mobile/matches/:matchId` | Contexto captura |
| GET | `/api/mobile/matches/:matchId/roster` | Plantel / credenciales |
| GET | `/api/mobile/matches/:matchId/events` | Timeline |
| POST | `/api/mobile/matches/:matchId/events` | `record_match_event` |
| PATCH | `/api/mobile/matches/:matchId/result` | Cierre partido (gap RLS referee) |
| PUT | `/api/mobile/matches/:matchId/stats` | Stats premium |
| POST | `/api/mobile/assignments/:matchOfficialId/confirm` | **Nueva RPC** pendiente |
| GET | `/api/mobile/me/permissions` | Preflight `can_capture_match` |

Brechas documentadas en el inventario: confirmación de asignación por oficial y cierre de partido por árbitro/anotador requieren extensión de RPC/RLS antes de que la app pueda hacerlo solo con categoría A.

### 4. Reglas de seguridad

- La app **solo** incluye en el binario: URL de Supabase y **anon key** (`EXPO_PUBLIC_*`). Son públicas por diseño; la seguridad está en RLS.
- **Prohibido** en la app: `service_role`, `ANTHROPIC_API_KEY`, claves de email, secretos de invitación, cualquier variable de servidor de Railway.
- Route handlers `/api/mobile/*` validan JWT en cada request; no confían en el cliente más allá del token.
- Mismo checklist RLS que web: no usar `user_metadata` para autorización; JWT puede estar stale hasta refresh.

### 5. Autenticación (fase 3 — solo diseño aquí)

No se implementa en este ADR; se documenta el contrato:

- Proveedores: **correo/contraseña**, **Google**, **Sign in with Apple** (obligatorio en iOS si hay login con Google).
- Sesión persistida con **expo-secure-store** (adaptador de almacenamiento para `@supabase/supabase-js`).
- Logout y refresh vía SDK Supabase en dispositivo; **no** reutilizar `auth/actions.ts` (categoría B por `redirect()` y cookies SSR).
- **Borrar cuenta** desde la app: flujo Auth + RPC/policy existente o endpoint mobile; debe cumplir requisitos de tiendas.
- Recuperación de contraseña: SDK `resetPasswordForEmail` con deep link de la app (equivalente portable de `requestPasswordResetAction`, categoría C).

### 6. Captura sin conexión (fase 1 — diseño)

**Enfoque elegido:** cola local en el dispositivo.

1. El árbitro/anotador registra eventos en SQLite/AsyncStorage (estructura espejo de payload `record_match_event`).
2. Cada evento lleva `client_id` (UUID) para idempotencia al sincronizar.
3. Al recuperar red, la app reenvía en orden; el servidor deduplica por `client_id` o RPC idempotente.
4. UI muestra estado: pendiente / sincronizado / error (conflicto de estado del partido).

**Alternativas descartadas para fase 1:**

- **Solo online:** simple pero inutilizable en canchas sin señal (caso frecuente).
- **CRDT / sync bidireccional complejo:** sobredimensionado para eventos append-only de un solo capturista por partido.
- **Service Worker (web):** no aplica en app nativa Expo.

Implementación concreta (librería de storage, schema de cola, RPC de sync) queda para un ADR o ticket de fase 1 implementación.

### 7. Estructura del repo

```
ligapro/
├── src/                 # Next.js web (sin cambios de comportamiento)
├── mobile/              # Expo app (package.json propio)
├── supabase/
├── docs/
└── package.json         # Solo web; Railway build no entra a mobile/
```

**No monorepo (turbo/pnpm workspaces) todavía:** el equipo es pequeño, la web ya despliega en Railway con un `package.json`, y la app tiene ciclo de release distinto (EAS Build). Añadir workspaces ahora aumenta complejidad de CI sin beneficio inmediato. Reevaluar cuando haya paquetes compartidos (`@ligapro/types`, `@ligapro/validation`) consumidos por web y mobile.

**Aislamiento del build web:**

- `tsconfig.json` raíz excluye `mobile/`.
- `eslint.config.mjs` ignora `mobile/**`.
- `railway.toml` / `npm run build` solo compilan Next.js; `mobile/` no está en dependencies del root.

### 8. Tipos compartidos de base de datos

Fuente de verdad: `src/types/database.ts` (generado con Supabase CLI desde el proyecto `ligapro-dev`).

La app **no copia a mano** el archivo. Opciones (en orden de preferencia):

1. **Path alias en `mobile/tsconfig.json`:** `"@ligapro/database": ["../src/types/database.ts"]` — cero duplicación en desarrollo; requiere que el tipo exista en el clone del repo.
2. **Script `npm run types:sync` en `mobile/`:** copia desde `../src/types/database.ts` antes de CI/EAS (útil si EAS no clona paths fuera de `mobile/`).
3. **Futuro paquete `@ligapro/database-types`:** cuando exista monorepo.

Regeneración: mismo comando que web (`supabase gen types typescript --project-id … > src/types/database.ts`); mobile consume el artefacto único.

### 9. PoC en `mobile/` (este paso)

- Template Expo SDK **57** estable, expo-router, TypeScript.
- Cliente Supabase con variables `EXPO_PUBLIC_*` y sesión en expo-secure-store.
- Sin diseño de producto; pantalla mínima de humo (conexión configurada).
- **No** implementar auth, offline ni endpoints `/api/mobile/*` en este ADR.

## Consecuencias

**Positivas**

- Superficie nativa aprobable en tiendas; UX acorde a uso en cancha.
- Reuso masivo de RPCs/RLS (45 acciones categoría A) sin duplicar lógica en Node.
- Railway sigue siendo el lugar de secretos e IA; mobile permanece delgado.

**Riesgos**

- **Dos codebases UI** (React web vs React Native): componentes no se comparten; solo tipos y contratos API.
- **Brechas RLS fase 1:** confirmación de oficial y cierre por árbitro requieren migraciones futuras (fuera de este paso).
- **Drift de tipos:** si alguien regenera `database.ts` solo en web, mobile puede compilar con tipos viejos hasta sync — mitigar con script en CI.
- **Dos pipelines de release:** web (Railway) + app (EAS); versionado y feature flags deben coordinarse.
- **Auth tiendas:** Apple exige Sign in with Apple si hay Google; planificar en fase 3 antes de submit.

## Fuera de alcance

- Implementar pantallas de captura, auth o offline.
- Crear route handlers `/api/mobile/*`.
- Migraciones Supabase para RPCs de fase 1.
- Monorepo, diseño visual, publicación en tiendas.
- Cambiar comportamiento de la web Next.js.
