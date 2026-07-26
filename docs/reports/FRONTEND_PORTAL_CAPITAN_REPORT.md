# Frontend — Portal del capitán/vicecapitán

**Fecha:** 2026-07-26 (actualizado tras Migration 021 + frontend cancha/portal)  
**Alcance:** UI de invitación, portal `/mi-equipo`, reagendado, marcas de pago informales, enrutamiento post-login, WhatsApp, perfil, alta de jugadores.  
**Sin migraciones ni RPCs nuevos en este entregable.**

## Resumen

Se implementó el portal para capitán/vicecapitán fuera del namespace `/organizaciones/...`, con layout propio (`CaptainShell`), flujo de invitación pública y reglas de redirección post-login que evitan mandar capitanes a `/onboarding`.

Con Migration 021 aplicada y el frontend de este entregable, el portal es **funcional de punta a punta**: plantel, fechas, WhatsApp rival (cuando hay teléfono), perfil propio y alta de jugadores nuevos.

## Enrutamiento post-login

Implementado en `src/lib/auth/resolve-auth-destination.ts`:

| Membresías org | Capitanías activas | Destino |
| --- | --- | --- |
| 0 | 0 | `/onboarding` |
| 0 | 1 | `/mi-equipo/{seasonTeamId}` |
| 0 | 2+ | `/mi-equipo` |
| 1 | * | `/organizaciones/{id}/inicio` |
| 2+ | * | `/seleccionar-organizacion` |

**Dual rol (admin + capitán):** prioridad a membresías de organización. Enlace secundario «Ir al portal del capitán» en `/seleccionar-organizacion` cuando aplica.

Documentado en `docs/AUTHENTICATION.md`.

## Rutas

| Ruta | Acceso | Descripción |
| --- | --- | --- |
| `/invitacion/[token]` | Público (aceptar requiere sesión) | Valida invitación vía RLS invitee; login/registro con `next`; `accept_captain_invitation` |
| `/mi-equipo` | Autenticado + capitanía | Selector multi-equipo |
| `/mi-equipo/[seasonTeamId]` | Autenticado + acceso al equipo | Calendario + plantel + alta jugador |
| `/mi-equipo/perfil` | Autenticado + capitanía | Nombre para mostrar + teléfono |
| `/mi-equipo/.../partidos/[matchId]` | Autenticado + partido propio | Detalle + reagendado + WhatsApp |

## Módulos

| Área | Archivos |
| --- | --- |
| Auth / routing | `get-captain-teams.ts`, `resolve-auth-destination.ts`, `validation.ts`, `proxy.ts` |
| Captain lib | `src/lib/captain/{types,queries,actions,errors,whatsapp,roster-errors}.ts` |
| UI | `src/components/captain/*` |
| Páginas | `src/app/invitacion/[token]`, `src/app/(protected)/mi-equipo/**` |

## Funcionalidad

### Invitación

- Mensajes explícitos: token inválido, expirado, ya usado, correo distinto.
- Reutiliza Auth existente (correo/contraseña + Google) con `next=/invitacion/{token}`.
- Tras aceptar → portal (`/mi-equipo`), no onboarding.
- Admin puede capturar teléfono opcional al invitar (solo para armar `wa.me`; persistencia en `profiles.phone` tras aceptar y editar perfil).

### Portal

- Selector si hay varios `season_team` activos como capitán/vice.
- Calendario: partidos próximos con `calendar_status`, rival, sede/cancha, fecha (RLS `*_select_team_leader` de Migration 021).
- Plantel: lectura + marcas de pago (`set_player_payment_mark`) + **formulario de alta** (`create_player_and_add_to_roster`).
- Perfil: `/mi-equipo/perfil` para `display_name` y `phone`.

### Reagendado

- Sin request abierto → proponer (`propose_match_reschedule`).
- Request `proposed` del rival → aprobar/rechazar (`respond_match_reschedule`).
- Request propia → pendiente, sin acción.
- Estados terminales → solo lectura.
- WhatsApp: deep-link `wa.me` junto a propuesta propia; `getOpponentCaptainPhone` lee `profiles.phone` del capitán/sub rival; botón deshabilitado con explicación si no hay teléfono.

### Alta de jugador (capitán)

- Solo **alta** — sin baja, edición de status ni capitanía.
- Errores claros: tope de plantel, bloqueo `roster_locked_by_captain`, conflicto de cupo en la misma season.

### Marcas de pago

- Toggle pagado/pendiente por jugador activo.
- Texto visible: no reemplaza cobro oficial de la liga.

## RLS (Migration 021 — resuelto)

Policies `*_select_team_leader` en roster, equipos y reservas de partidos propios; columna `profiles.phone` disponible. Ya no hay bloqueantes de backend para el portal.

## WhatsApp

- Solo cliente: `buildCaptainWhatsAppLink` → `https://wa.me/{digits}?text=...`
- Sin WhatsApp Business API.
- Teléfono rival vía `getOpponentCaptainPhone` (capitán/sub → `profiles.phone`).
- Capitán captura su propio teléfono en `/mi-equipo/perfil`.

## Seguridad

- Acceso a `/mi-equipo/[seasonTeamId]` validado con `is_active_captain_or_vice_of_season_team`.
- Partidos ajenos → `notFound()` (RLS + comprobación de IDs).
- Sin reutilizar `AppShell` ni nav de organización.
- Sin privilegios admin: invitación, reagendado propio, marcas de pago, alta de jugador (no baja).

## Tests

- `src/lib/auth/resolve-auth-destination.test.ts` — política de routing + paths seguros
- `src/lib/captain/whatsapp.test.ts` — deep-links wa.me
- `src/lib/captain/roster-errors.test.ts` — mensajes de rechazo de alta

## Verificación local

```bash
npm run lint
npm run build
npm test
```

## Relacionado

- Admin canchas/disponibilidad: `docs/reports/FRONTEND_CANCHA_PORTAL_COMPLETO_REPORT.md`
- Backend: `docs/reports/MIGRATION_021_REPORT.md`

## Fuera de alcance (confirmado)

WhatsApp Business API, push, schema changes, baja/edición de roster por capitán, finanzas oficiales, panel `platform_billing_status`.
