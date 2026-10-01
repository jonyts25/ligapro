# Reporte — Fecha de crónica en America/Mexico_City

## Resumen

La fecha de la crónica en la página pública se formatea con `formatDateTimeMx`, zona `America/Mexico_City`. El panel admin usa la misma función, así que ya no depende de la zona del navegador. Un instante UTC `2026-09-30T23:07:46Z` se muestra como `30 sep 2026, 5:07 p.m.`

## Base del branch

| Campo | Valor |
| --- | --- |
| Branch | `feat/chronicle-timezone-mx` |
| Merge-base con `origin/main` | `9b9c73356029bee31a651e171752c778913d7e15` |
| Confirmación | Branch creado desde el tip de `origin/main`. No parte de otra rama feature. |

## Archivos tocados

| Ruta | Cambio |
| --- | --- |
| `src/lib/fixtures/format.ts` | `formatDateTimeMx` (dateStyle medium, timeStyle short, `FIXTURE_TIMEZONE`) |
| `src/lib/fixtures/format.test.ts` | `2026-09-30T23:07:46Z` → `30 sep 2026, 5:07 p.m.` |
| `src/components/public-season/PublicMatchDetailView.tsx` | Fecha de la crónica |
| `src/components/matches/MatchChroniclePanel.tsx` | Fecha del job y de la crónica generada |
| `src/lib/venues/availability-overview.ts` | Horas de reservas (`toLocaleTimeString`) con `timeZone` |
| `docs/reports/CHRONICLE_TIMEZONE_REPORT.md` | Este reporte |

## Barrido que no se tocó

Ya pasaban `timeZone`:

- `src/components/teams/TeamRegistrationRequestsPanel.tsx`
- `src/lib/dashboard/pending-items-core.ts`
- `src/lib/venues/reservation-calendar-model.ts`

Quedaron como estaban porque no son Server Components, o porque arman un día de calendario (`new Date(año, mes, día)`) y forzar la zona movería el día en un servidor UTC:

- `src/components/finance/SeasonFinancePanel.tsx` (`"use client"`)
- `src/lib/teams/roster-import.ts` (lo usa un componente cliente; etiqueta de mes y año)
- `src/lib/venues/reservation-calendar-week.ts` (`formatCalendarDayLabel`)
- `formatDateLabel` dentro de `availability-overview.ts`

No hay `toLocale*` sin `timeZone` en `src/app/`.

## Comandos

### `npm run lint`

```
> eslint
```

Exit 0. Sin errores.

### `npx tsc --noEmit`

Exit 0. Sin salida.

### Tests

Corridos con Git Bash (el `bash` de `npm test` abre WSL sin distro).

`origin/main` antes de este cambio: 326 tests / 146 suites (el branch de marcador, que no está en main, sumaba 4 tests en 1 suite: 330 / 147). Este branch agrega 1 test y 1 suite.

```
ℹ tests 327
ℹ suites 147
ℹ pass 327
ℹ fail 0
```

### `npm run build`

Next.js 16.2.10 compiló. 24 páginas estáticas. Exit 0.

## Qué no se verificó en el navegador

No hay sesión abierta contra la página pública del partido. El caso de las 6 horas queda cubierto por el test de `formatDateTimeMx`.
