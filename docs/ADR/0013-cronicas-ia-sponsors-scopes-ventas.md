# ADR 0013 — Crónicas con IA, sponsors, scopes de admin y capa de ventas

**Estado:** Aceptado (diseño) — pendiente de aplicar migración y construir UI
**Migration:** borrador `ai_jobs_and_chronicle_stats.sql` (no aplicada aún)

## Contexto

Se necesita el diferenciador de producto (crónicas generadas por IA) listo
para demo, más una decisión sobre cómo separar Básico de Premium en datos
de partido, cómo modelar patrocinios, y dos gaps estructurales detectados
al pensar en clientes con varias sedes y en un modelo de ventas por
revendedores/vendedores.

## Decisiones

### 1. Cola de trabajos de IA (`ai_jobs`)

Cada producto de Sports Core mantiene su **propia** tabla `ai_jobs` en su
**propio** proyecto de Supabase. Ligera NO escribe en la tabla del proyecto
de Equivalente ni al revés — evita acoplar la disponibilidad de un producto
a la del otro.

El worker de Node en GPU local es el mismo proceso para ambos productos:
se conecta a los dos proyectos de Supabase (credenciales separadas) y
procesa cada cola por separado contra Ollama. Si se necesita más volumen o
un cliente grande lo exige, se agrega un "worker" adicional que lea de la
misma tabla y llame a una API de pago en vez de a Ollama — la cola no
cambia, solo quién la procesa.

Campo `app` se conserva (fijo en `'ligera'` por ahora) para logging del
worker, previendo que Mundial Compas use el mismo mecanismo más adelante.

### 2. Datos de partido: Básico vs. Premium

**Básico** (ya existente, sin cambios de alcance): `match_events` — goles,
autogoles, tarjetas, cambios, lesiones, minuto. Se agrega
`assist_season_team_player_id` (nullable) porque mejora la crónica básica
sin ser un dato "premium" en sí.

**Premium** (nuevo, opcional, tablas aditivas):

| Tabla | Contenido |
| --- | --- |
| `match_team_stats` | tiros, tiros a puerta, posesión %, córners, faltas, offsides — por equipo y partido |
| `match_player_stats` | minutos, pases, distancia, rating, jugador del partido — por jugador y partido |
| `match_context` | asistencia de público, clima, árbitro, nota de momento destacado |

Estas tablas son opcionales por diseño: si una cancha no las llena, la
crónica de ese partido cae automáticamente a nivel básico. El tier de la
crónica no es un toggle de UI — depende de si hay filas ahí o no.

`match_chronicles` guarda el texto final generado (`tier`, `content`,
`is_published`), separado de `ai_jobs.resultado` (cola ≠ contenido
publicado). RPC pública `get_public_match_chronicle` expone el texto solo
si la season es pública y la crónica está marcada `is_published`.

### 3. Sponsors

`sponsors` (catálogo por organización) + `sponsor_placements` (tabla
puente con `venue_id` / `season_id` / `competition_id` nullable, más
`tier` y `display_order`). Un mismo patrocinador puede tener presencia en
varios niveles sin duplicarse. Prepara el terreno para "conteo de
exposición" mencionado como feature premium futura.

### 4. Publicidad en páginas públicas

**No se construye ad-tech de terceros** (sin banners rotativos, sin
self-serve, sin inventario de impresiones). Motivos: volumen de tráfico
amateur no lo justifica, y choca con el argumento de venta de "plataforma
profesional" frente al organizador que paga.

Freemium se resuelve con marca de agua: Básico muestra "Powered by
Ligera" visible en páginas públicas; Premium queda limpio con solo marca
del cliente. Monetización de "negocios cercanos a la cancha" se canaliza
como patrocinio pagado (mismo mecanismo del punto 3), no como ads.

### 5. Roles de admin acotados por sede/torneo (diseño, sin migración)

Hoy `has_role_in_org` no tiene ningún scope — un `organization_admin` ve y
edita todo dentro de su organización. Para clientes con varios admins
operativos (uno por sede, uno por torneo) se diseñó:

`organization_member_scopes (member_id, scope_type ['venue'|'season'|'competition'], scope_id)`

Sin filas para un miembro → comportamiento actual sin cambios (retro-
compatible). Con filas → RLS se restringe a esos recursos. Aditivo, no
reescribe policies existentes, solo les agrega una condición `OR EXISTS`.

### 6. Capa de ventas / vendedores (diseño, sin migración)

Reusa `platform_staff` (ya existe para staff cross-org):

- Nuevo campo `role` en `platform_staff` (`'platform_owner'` | `'vendor'`)
- Nuevo campo `organizations.sold_by_platform_staff_id` (nullable)
- Dashboard `/plataforma/ventas` (mismo patrón que `/plataforma/facturacion`):
  un `vendor` solo ve organizaciones donde `sold_by_platform_staff_id` es
  su propio id; `platform_owner` (Jonathan) ve todo sin filtro.

## Consecuencias

- `PRODUCT_SCOPE.md` actualizado: crónicas y sponsors salen de "fuera del
  MVP"; scopes de admin y capa de ventas quedan explícitamente como
  diseño aceptado pero sin construir.
- La migración borrador (`ai_jobs_and_chronicle_stats.sql`) cubre los
  puntos 1 y 2. Los puntos 3, 5 y 6 no tienen migración todavía — quedan
  para el siguiente ciclo de trabajo.
- Ninguna decisión aquí rompe RLS ni patrones existentes; todo es aditivo.

## Fuera de alcance (todavía)

Storytelling cross-season, rivalidades, reconocimientos automáticos,
conteo de exposición de sponsors, construcción real de scopes de admin y
del dashboard de ventas — quedan como intención documentada, no como
trabajo activo.
