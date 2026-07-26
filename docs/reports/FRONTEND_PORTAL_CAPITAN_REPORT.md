# Frontend — Portal del capitán/vicecapitán

**Fecha:** 2026-07-26  
**Alcance:** UI de invitación, portal `/mi-equipo`, reagendado, marcas de pago informales, enrutamiento post-login.  
**Sin migraciones ni RPCs nuevos.**

## Resumen

Se implementó el portal para capitán/vicecapitán fuera del namespace `/organizaciones/...`, con layout propio (`CaptainShell`), flujo de invitación pública y reglas de redirección post-login que evitan mandar capitanes a `/onboarding`.

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
| `/mi-equipo/[seasonTeamId]` | Autenticado + acceso al equipo | Calendario + plantel |
| `/mi-equipo/.../partidos/[matchId]` | Autenticado + partido propio | Detalle + reagendado |

## Módulos

| Área | Archivos |
| --- | --- |
| Auth / routing | `get-captain-teams.ts`, `resolve-auth-destination.ts`, `validation.ts`, `proxy.ts` |
| Captain lib | `src/lib/captain/{types,queries,actions,errors,whatsapp}.ts` |
| UI | `src/components/captain/*` |
| Páginas | `src/app/invitacion/[token]`, `src/app/(protected)/mi-equipo/**` |

## Funcionalidad

### Invitación

- Mensajes explícitos: token inválido, expirado, ya usado, correo distinto.
- Reutiliza Auth existente (correo/contraseña + Google) con `next=/invitacion/{token}`.
- Tras aceptar → portal (`/mi-equipo`), no onboarding.

### Portal

- Selector si hay varios `season_team` activos como capitán/vice.
- Calendario: partidos próximos con `calendar_status`, rival, sede/cancha, fecha (cuando RLS lo permite).
- Plantel: solo lectura + marcas de pago (`set_player_payment_mark`) con aviso de control informal.

### Reagendado

- Sin request abierto → proponer (`propose_match_reschedule`).
- Request `proposed` del rival → aprobar/rechazar (`respond_match_reschedule`).
- Request propia → pendiente, sin acción.
- Estados terminales → solo lectura.
- WhatsApp: deep-link `wa.me` junto a propuesta propia; botón deshabilitado si no hay teléfono.

### Marcas de pago

- Toggle pagado/pendiente por jugador activo.
- Texto visible: no reemplaza cobro oficial de la liga.

## Bloqueantes RLS (requieren migración futura)

Verificado en proyecto remoto (`akgcamaegpboewsbbevl`): las policies actuales limitan SELECT de tablas base a `is_member_of(organization_id)`. Capitanes **no** son miembros.

| Necesidad UI | Tabla / columna | Estado actual |
| --- | --- | --- |
| Listar plantel | `season_team_players`, `players` | Solo `organization_member` |
| Nombres de equipos | `season_teams`, `teams` | Solo miembro |
| Fecha/sede programada | `field_reservations`, `fields`, `venues` | Solo miembro |
| Descubrir capitanías sin partidos | join `players` → `season_team_players` | Solo miembro |
| WhatsApp rival | `profiles.phone` | **Columna no existe** |

**Mitigación en código:** fallback vía partidos visibles al capitán (`matches` SELECT) + RPC `is_active_captain_or_vice_of_season_team`. Funciona parcialmente cuando ya hay fixture; plantel/fechas pueden aparecer vacíos hasta ampliar RLS.

**Recomendación Migration 021:** policies `*_select_team_leader` en roster/equipos/reservas de partidos propios; columna `profiles.phone` opcional.

## WhatsApp

- Solo cliente: `buildCaptainWhatsAppLink` → `https://wa.me/{digits}?text=...`
- Sin WhatsApp Business API.
- Botón deshabilitado con explicación hasta existir `profiles.phone`.

## Seguridad

- Acceso a `/mi-equipo/[seasonTeamId]` validado con `is_active_captain_or_vice_of_season_team`.
- Partidos ajenos → `notFound()` (RLS + comprobación de IDs).
- Sin reutilizar `AppShell` ni nav de organización.
- Sin privilegios admin: solo invitación, reagendado propio, marcas de pago.

## Tests

- `src/lib/auth/resolve-auth-destination.test.ts` — política de routing + paths seguros
- `src/lib/captain/whatsapp.test.ts` — deep-links wa.me

## Verificación local

```bash
npm run lint
npm run build
npm test
```

## Fuera de alcance (confirmado)

WhatsApp Business API, push, schema changes, edición de roster, finanzas oficiales.
