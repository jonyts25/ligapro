# Product Scope — LigaPro

## Qué es

LigaPro es una plataforma B2B para administrar ligas y canchas amateur.

## Mercado inicial

Bajío y Jalisco.

## Canal

PWA / web responsive primero. No hay app nativa en el alcance actual.

## Modelo de tenancy

Multi-tenant por organización. Cada organización aísla sus datos operativos (venues, competencias, equipos, partidos, finanzas, etc.).

## Ciclo MVP

```text
organización
→ venues/campos
→ competencia/temporada
→ equipos/planteles
→ fixture
→ horarios
→ publicación
→ captura de resultados/eventos
→ tabla/goleo/disciplina
→ consulta pública
→ registro manual de cargos y pagos por equipo/temporada
→ audit log interno (triggers de base de datos)
```

Registrar pagos manuales (efectivo, transferencia, etc.) **sí** pertenece al MVP. Procesar pagos dentro de la aplicación (Mercado Pago, Stripe, etc.) **no** pertenece al MVP.

El **audit log interno** (trazabilidad automática vía triggers) **sí** pertenece al MVP. Analytics avanzados y vistas públicas de auditoría **no**.

## Actualización de alcance (ver ADR-0013)

Las siguientes líneas dejaron de estar "fuera del MVP" a partir del ADR-0013.
Se dividen entre Básico y Premium, no son un bloque monolítico de "IA" o
"sponsors" — el detalle de qué tabla/feature es de qué tier vive en el ADR.

- **Crónicas con IA (básico + premium):** sí entran. Básico usa únicamente
  `match_events` (goles, autogoles, tarjetas, cambios, lesiones, asistencia).
  Premium usa además `match_team_stats`, `match_player_stats` y
  `match_context` cuando existen datos ahí.
- **Sponsors (premium):** sí entran, vía `sponsors` + `sponsor_placements`
  (patrocinio por venue, season o competition). Ver ADR-0013.
- **Storytelling avanzado** (perfiles de carrera cross-season, rivalidades,
  reconocimientos automáticos): sigue documentado solo como intención en
  ADR-0013; no tiene migración todavía.

## Fuera del MVP

- procesamiento de pagos dentro de la aplicación (pasarelas, webhooks)
- facturación CFDI
- perfil nacional de jugador
- brackets automáticos complejos
- app nativa
- chat
- videos
- marketplace
- SMS
- publicidad de terceros / ad-tech en páginas públicas (decisión ADR-0013:
  monetización de "negocios cercanos a la cancha" se resuelve como
  patrocinio pagado vía `sponsor_placements`, no como inventario de anuncios)
- roles de admin acotados por sede/torneo (`organization_member_scopes`) —
  diseño discutido en ADR-0013, sin migración todavía
- panel de vendedores / atribución de ventas (`platform_staff.role`,
  `organizations.sold_by_platform_staff_id`) — diseño discutido en
  ADR-0013, sin migración todavía
