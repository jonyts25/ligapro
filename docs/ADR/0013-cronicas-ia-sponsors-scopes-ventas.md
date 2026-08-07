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

## Aprendizajes del primer test end-to-end (worker local + Ollama)

Se corrió el pipeline completo (`ai_jobs` → worker → Ollama → `match_chronicles`
→ `get_public_match_chronicle`) contra un partido real de la season de
prueba. Dos hallazgos concretos sobre el modelo local (`qwen3.5` vía Ollama)
que cambian cómo debe construirse el prompt real:

1. **No confiar en el nombre exacto de una clave JSON pedida al modelo.**
   Se le pidió responder `{"cronica": "..."}` (sin acento) y en dos intentos
   distintos devolvió `crònica` y `crónica` — nunca la clave exacta. El
   worker se ajustó para ser tolerante: si `cronica` no aparece pero el JSON
   trae un único valor de tipo string, lo usa de todas formas. **Quien
   construya el prompt real (prompt-builder en la app) no debe asumir que
   el nombre de la clave se respeta literalmente.**

2. **Sin marcador acumulado explícito, el modelo alucina la narrativa.**
   Dado solo el listado de goles con minuto y equipo, el modelo infirió mal
   la secuencia del marcador e inventó un "empate" que nunca ocurrió a la
   mitad del partido. Al agregar el marcador resultante después de cada gol
   directamente en el prompt (sin que el modelo tenga que sumarlo), el
   problema desapareció. **El prompt-builder real debe incluir el marcador
   acumulado tras cada evento, no solo la lista de eventos — no delegarle
   aritmética/secuencia al modelo, por chico que parezca el cálculo.**

3. **Especificar quién es local y quién visitante explícitamente.** El
   modelo asumió incorrectamente que el equipo visitante jugaba "en casa".
   Sin este dato explícito en el prompt, lo infiere mal.

4. **Después de 3 iteraciones de prompt, el modelo sigue produciendo un error
   factual distinto cada vez** (un "empate" inventado a mitad de partido, un
   número de marcador cambiado al parafrasear, y una relación causal
   inventada — "empató" aplicado al equipo que ya iba ganando). Cada ajuste
   de prompt resolvió el error anterior específico sin evitar que apareciera
   uno nuevo de otro tipo. **Conclusión: esto es un techo de capacidad del
   modelo local (`qwen3.5` vía Ollama) para razonamiento factual/temporal
   encadenado, no un problema de instrucciones.** Seguir iterando el prompt
   tiene rendimientos decrecientes a partir de este punto — la mitigación
   real es la revisión humana obligatoria antes de publicar (`is_published`
   manual), no un prompt perfecto. Si en algún momento se vuelve prioritario
   eliminar la revisión manual, la palanca correcta es un modelo más grande
   (local o de pago), no más ingeniería de prompt sobre este mismo modelo.

### 5. Roles de admin acotados por sede/torneo — WAVE 1 aplicado y probado

Actualización: se aplicó y probó contra `ligapro-dev` la infraestructura
completa (`organization_member_scopes`, helper `has_role_in_org_scoped`) y
un primer lote de tres funciones convertidas: `update_season_with_rules`,
`schedule_match`, `void_match_event`.

**Hallazgo de alcance real**: el repo tiene 186 sitios donde se llama
`has_role_in_org(...)` repartidos en ~30 migraciones — casi toda la
autorización vive DENTRO del cuerpo de cada RPC `SECURITY DEFINER`, no en
policies de RLS externas. Esto significa que "agregar scopes" no es un
cambio de una sola tabla — es convertir función por función. Se decidió
avanzar por olas en vez de intentar las ~60-100 funciones activas de una
sola vez.

**Cubierto en Wave 1** (probado con datos reales, incluyendo
retro-compatibilidad y rechazo correcto fuera de scope):
- Editar season (`update_season_with_rules`)
- Programar partido (`schedule_match`)
- Anular evento de partido (`void_match_event`)

**Pendiente para próximas olas** (sigue usando `has_role_in_org` sin scope
— un admin scoped hoy tiene acceso de organización completa para esto):
roster de equipos, disciplina, finanzas de equipo, reservas/disponibilidad
de cancha, brackets/knockout, captura de partido por scorekeeper.

**Sin construir todavía**: UI para asignar/quitar scopes a un miembro (hoy
solo se puede hacer por SQL directo, como se probó). Es lo próximo antes de
que esto sea usable sin intervención manual.

### 6. Capa de ventas — aplicado y probado

Actualización: `platform_staff.role` (`platform_owner`/`vendor`),
`organizations.sold_by_platform_staff_id`, y el RPC
`get_platform_sales_overview()` ya están aplicados y probados contra
`ligapro-dev` — un vendedor de prueba solo vio su organización atribuida
entre 27 existentes; `platform_owner` vio las 27. Falta el dashboard
`/plataforma/ventas` (UI, sin construir).

## Consecuencias (actualizado)

- `PRODUCT_SCOPE.md` actualizado: crónicas y sponsors salen de "fuera del
  MVP"; capa de ventas y Wave 1 de scopes de admin también salen (aplicadas
  y probadas); sponsors y Wave 2+ de scopes siguen como diseño sin construir.
- Las migraciones `ai_jobs_and_chronicle_stats.sql`,
  `public_match_read_rpc.sql`, `platform_sales_layer.sql` y
  `organization_member_scopes_wave1.sql` cubren los puntos 1, 2 y las
  actualizaciones de 5 y 6. El punto 3 (sponsors) sigue sin migración.
- Ninguna decisión aquí rompe RLS ni patrones existentes; todo es aditivo o
  retro-compatible (scopes: sin filas = comportamiento idéntico al actual).

## Fuera de alcance (todavía)

Storytelling cross-season, rivalidades, reconocimientos automáticos,
conteo de exposición de sponsors, construcción real de scopes de admin y
del dashboard de ventas — quedan como intención documentada, no como
trabajo activo.
