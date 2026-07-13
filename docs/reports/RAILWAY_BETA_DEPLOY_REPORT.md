# Railway Beta Deploy Report — LigaPro

**Fecha:** 2026-07-13  
**Alcance:** Cierre Frontend F5 + despliegue beta pública en Railway  
**Supabase:** `ligapro-dev` (`akgcamaegpboewsbbevl`) — **beta/staging**, no producción definitiva  
**F6:** no iniciado

---

## 1. Commits

| Commit | Mensaje |
|--------|---------|
| `9b7d5df` | `feat: frontend F5 teams enrollments and rosters` |
| `9b982b9` | `chore: prepare LigaPro beta deployment` |
| `b812530` | `chore: configure Railway beta healthcheck` |

## 2. Repositorio / branch

- **Repo:** `jonyts25/ligapro`
- **Branch:** `main`
- **Remoto:** sincronizado (`origin/main` = `b812530` al momento del deploy healthy)

## 3. Railway

| Campo | Valor |
|-------|--------|
| Project | `LigaPro - Dev` (`445342ba-3faa-4656-b59f-4820f97f76f2`) |
| Environment (Railway) | `production` *(nombre Railway; contenido = beta LigaPro)* |
| Service | `ligapro` (`22ff647f-06a9-4616-a10d-e28799613859`) |
| Repo link | `jonyts25/ligapro` @ `main` |
| Dominio público | https://ligapro-dev.up.railway.app |
| Build | Railpack / Node 22 / Next detected |
| Build command | `npm run build` (default detectado) |
| Start command | `npm start` → `next start` |
| Healthcheck | `/api/health` (vía `railway.toml`) |
| Deploy ID healthy | `7b7b97a3-86a9-4a94-ac0f-8702b88a8725` |
| Status | Online · SUCCESS · sin restart loop observado |

No se reutilizó el servicio de Mundial Compas.

## 4. Variables configuradas (solo nombres)

Presentes en el servicio Railway:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_SITE_URL` (= `https://ligapro-dev.up.railway.app`)
- `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` (generada localmente, 32 bytes → base64; valor **no** documentado)

**No** configuradas (correcto):

- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `SUPABASE_ACCESS_TOKEN`

`NEXT_PUBLIC_*` disponibles antes del build del deploy `b812530`.

## 5. Inventory `process.env` en código

| Variable | Uso |
|----------|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente/server Supabase, branding Storage |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable/anon key (nombre real en código) |
| `NEXT_PUBLIC_SITE_URL` | `getPublicSiteUrl()` → redirects auth (confirmación / recuperación) |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Solo runtime/build Railway (no leída en componentes cliente) |

Fallback local de site URL: `http://localhost:3000`.

Archivo ejemplo: `.env.example` (placeholders). `.env.local` ignorado por `.gitignore`; `.env.example` trackeado.

## 6. Health endpoint

`GET /api/health` → HTTP 200:

```json
{ "status": "ok", "service": "ligapro" }
```

Sin consulta a Supabase. Verificado local y remoto.

## 7. Build / deploy result

- **Build:** SUCCESS (deploy `b812530`)
- **Deploy:** SUCCESS con healthcheck `/api/health`
- **Runtime logs (sin secretos):**

```text
Starting Container
> ligapro@0.1.0 start
> next start
▲ Next.js 16.2.10
- Local: http://localhost:8080
✓ Ready in 90ms
```

Escucha el `PORT` inyectado por Railway (8080 en el contenedor).

## 8. Supabase Auth hosted — paso manual pendiente

Cursor/MCP **no** expone API para actualizar Auth URL settings en este entorno (`SUPABASE_ACCESS_TOKEN` no disponible).

**Acción manual requerida** en proyecto `akgcamaegpboewsbbevl` (Authentication → URL configuration):

1. **Site URL:** `https://ligapro-dev.up.railway.app`
2. **Redirect URLs:**
   - Conservar: `http://localhost:3000/auth/callback`
   - Agregar: `https://ligapro-dev.up.railway.app/auth/callback`

Hasta entonces, flujos de correo (confirmación / recuperación) pueden seguir apuntando a la Site URL previa (p. ej. localhost).  
SMTP **no** se modificó.

La app ya construye redirects de signup/reset con `NEXT_PUBLIC_SITE_URL` (Railway).

## 9. Smoke tests remotos

Fuente: `docs/reports/assets/railway-beta-smoke-results.json` + probes curl.

### Verificados PASS

Infra: health, manifest, iconos PWA, home→login, assets `_next`, logs sin 500.  
Auth: login owner, refresh sesión, logout, sin redirect a localhost.  
Producto: logo Storage, color `#0EA5E9`, sedes, torneos, equipos, crear team, inscribir, plantel, crear jugador, capitán, refresh.  
Seguridad básica: ruta privada sin sesión → login; `organizationId` ajeno → notFound sin leak; sin service role / SQL en HTML.  
Responsive: 375px, menú móvil, sin scroll horizontal.  
PWA: manifest OK; **no** se afirma offline.

### No verificados / no afirmados

| Ítem | Estado |
|------|--------|
| Usuario sin membership → onboarding | **NOT_VERIFIED** (sin credenciales conocidas) |
| Confirmación / recuperación por correo en dominio Railway | **NOT_VERIFIED** (Auth Site URL manual pendiente) |
| Soporte offline | **NOT_CLAIMED** |

## 10. Riesgos

1. Beta sobre `ligapro-dev`: datos de prueba / smoke; no tratar como prod final.
2. Auth Site URL / Redirect URLs hosted aún requieren configuración manual.
3. Railway environment se llama `production` aunque el producto es beta.
4. Advisor Supabase: tablas `__mig010_test_results` / `__mig011_test_results` sin RLS (legado de tests) — fuera de alcance de este deploy; remediar aparte.
5. Un player puede pertenecer a dos equipos de la misma season (ver decisión pendiente).

## 11. Decisión pendiente (antes de F6)

```text
Actualmente un player puede pertenecer a dos equipos de la misma season.
Antes de fixture, disciplina y estadísticas debe decidirse si LigaPro:
A) lo permite;
B) lo prohíbe mediante constraint/migración.
```

Esta regla **no** se cambió en este bloque.

## 12. Mundial Compas

Confirmado intacto: trabajo exclusivo en `ligapro`; Railway service `ligapro` / proyecto `LigaPro - Dev`; sin cambios a repos/servicios Mundial Compas.

## 13. Resultado

- **Dominio beta:** https://ligapro-dev.up.railway.app  
- **GitHub `main` y Railway** alineados en `b812530` (+ reporte posterior si se commitea).  
- **F5 cerrado** para deploy beta.  
- **No avanzar a F6 / fixture** hasta revisión y decisión player/multi-equipo.
