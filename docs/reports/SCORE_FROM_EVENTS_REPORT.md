# Reporte — Marcador oficial desde eventos

## Resumen

Si hay goles capturados y el partido no está cerrado, `home_score` / `away_score` se recalculan solos con la misma regla que `goalsFromEvents` (anulados no cuentan; el autogol suma al rival). El marcador escrito a mano queda como corrección explícita (`matches.score_manual_override`). En la captura, la tarjeta «Marcador oficial» quedó después de la captura rápida y la línea de tiempo. La migración no se aplicó a Supabase.

## Base del branch

| Campo | Valor |
| --- | --- |
| Branch | `feat/score-from-events` |
| Merge-base con `origin/main` | `9b9c73356029bee31a651e171752c778913d7e15` |
| Confirmación | Branch creado desde el tip de `origin/main` (merge PR #36). No parte de otra rama feature. |

## Archivos creados / modificados / borrados

### Creados

| Ruta | Cambio |
| --- | --- |
| `supabase/migrations/20261006100000_score_from_events.sql` | Columna, trigger, RPC y snapshot de invitado |
| `supabase/tests/047_score_from_events.sql` | Gol, visita, autogol, anulación, partido cerrado, override, auditoría, walkover |
| `src/lib/matches/score-from-events.ts` | Decisión de override al guardar |
| `src/lib/matches/score-from-events.test.ts` | Casos de la acción |
| `docs/reports/SCORE_FROM_EVENTS_REPORT.md` | Este reporte |

### Modificados

| Ruta | Cambio |
| --- | --- |
| `src/components/matches/MatchScoreForm.tsx` | Prefill, confirmación y «Volver a calcular desde eventos» |
| `src/lib/matches/actions.ts` | `updateMatchResultAction` manda el override |
| `src/lib/matches/guest-actions.ts` | Igual para el árbitro invitado |
| `src/lib/matches/queries.ts` | Expone `scoreManualOverride` |
| `src/lib/matches/guest-queries.ts` | Lee el flag del snapshot |
| `src/types/database.ts` | Columna y argumentos de los RPC |
| `src/app/.../captura/page.tsx` | Marcador oficial después de la línea de tiempo |
| `src/app/invitacion-arbitral/[token]/page.tsx` | Mismo orden |

### Borrados

Ninguno.

## Decisiones tomadas

1. **El RPC persiste el flag que calcula la acción**, no el navegador. `true` si el marcador guardado difiere del de los eventos; `false` si coincide o si se pide recalcular. El 5.º argumento tiene default `false` para no romper las llamadas viejas de 4 argumentos.
2. **La confirmación solo se pide si hay goles capturados y los números cambian.** Un walkover sin eventos se guarda a mano sin ese diálogo. El botón «Volver a calcular desde eventos» solo aparece si el override está activo y hay goles; si no hay goles, recalcular forzaría 0-0.
3. **La auditoría no tiene columna `actor` de texto.** `actor_profile_id` es uuid. El cambio automático queda en `audit_log.source = 'system:events'` y `actor_profile_id` nulo, vía `app.audit_source`, sin alterar el resto de las filas de auditoría.
4. **El trigger es `AFTER INSERT OR UPDATE OF voided_at`.** No toca `match_events_prevent_mutation` (ese es BEFORE). Una tarjeta no recalcula el marcador.

## Resultados de comandos

La migración no se ejecutó contra Supabase. El SQL de `047` queda para cuando Claude la aplique.

### `npm run lint`

```
> ligapro@0.1.0 lint
> eslint

(0 errores)
```

### `npx tsc --noEmit`

```
(0 errores)
```

### `npm test`

El script del repo llama a `bash`, y en esta máquina `bash` abre WSL sin distro. Se corrió el mismo comando con Git Bash.

```
ℹ tests 330
ℹ suites 147
ℹ pass 330
ℹ fail 0
```

Incluye `src/lib/matches/**` y `src/lib/chronicles/**`.

### `npm run build`

```
✓ Compiled successfully
Finished TypeScript
✓ Generating static pages (24/24)
```

## Qué NO se hizo o quedó pendiente

- No se aplicó la migración ni el test SQL en `ligapro-dev`.
- No se cambió `goalsFromEvents`, la redacción de nombres en torneos infantiles, `MatchResultReviewPanel` ni la crónica al aprobar.
- No se tocó la app móvil.

### Nota para el PR (mobile)

`mobile/src/app/partidos/[matchId]/index.tsx` ya captura goles con `record_match_event` y los anula con `void_match_event`. No escribe `home_score`. Cuando la migración esté aplicada, ese trigger actualiza el marcador oficial de esos eventos si no hay override y el partido no está cerrado. No hay pantalla móvil para marcar una corrección manual ni para cerrar el partido con un marcador distinto. El portal del capitán en mobile solo muestra el `home_score` que ya viene de la base. Un paso aparte haría falta si el árbitro debe corregir o cerrar el marcador desde el teléfono.

## Pruebas manuales para Jonathan

1. Aplicar `supabase/migrations/20261006100000_score_from_events.sql` y correr `supabase/tests/047_score_from_events.sql`.
2. En un partido en curso, capturar goles. El marcador oficial debe moverse solo y la tarjeta debe decir «Calculado a partir de N goles capturados».
3. Cambiar los números y guardar. Debe pedir confirmación y dejar `score_manual_override = true`. Un gol nuevo ya no debe mover ese marcador.
4. Pulsar «Volver a calcular desde eventos». El marcador vuelve al de los goles y el override queda en false.
5. Cerrar un partido sin goles como walkover con marcador manual. Debe guardarse.
6. En la invitación arbitral, la tarjeta del marcador queda debajo de la línea de tiempo.

## Riesgos o dudas

1. Hasta que la migración se aplique, la captura que lee `score_manual_override` y el RPC de 5 argumentos van a fallar en `ligapro-dev`.
2. Un partido `finished` no acepta goles nuevos (regla que ya existía). La prueba de «no tocar el cerrado» anula un gol ya capturado y comprueba que el 5-5 manual no cambia.
3. No se abrió la captura en el navegador: no hay sesión contra la base con la migración aplicada.
