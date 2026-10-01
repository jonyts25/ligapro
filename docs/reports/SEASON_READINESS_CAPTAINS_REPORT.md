# Reporte — Checklist de capitanes

## Resumen

«Equipos con capitán» muestra el conteo real (`1/4`). Si faltan capitanes queda en ámbar, como advertencia, y no bloquea publicar. En todos contra todos, «Equipos inscritos» exige al menos 2 equipos. Los demás ítems siguen bloqueando.

## Base del branch

| Campo | Valor |
| --- | --- |
| Branch | `feat/season-readiness-captains` |
| Merge-base con `origin/main` | `9b9c73356029bee31a651e171752c778913d7e15` |
| Confirmación | Branch creado desde el tip de `origin/main`. No parte de otra rama feature. |

## Decisión

Se usó la opción recomendada: capitán en cada equipo es `recommended`, no `required`. Un capitán faltante no impide publicar. El checklist enseña que se asigna desde el plantel, sin correo.

## Archivos

| Ruta | Cambio |
| --- | --- |
| `src/lib/competitions/season-readiness.ts` | Nivel del ítem, conteo `n/total`, mínimo de 2 equipos en liga |
| `src/lib/competitions/season-readiness.test.ts` | 1 de 4 capitanes permite publicar; 1 equipo en round robin no está listo |
| `src/components/competitions/SeasonReadinessCard.tsx` | Ayuda cuando faltan capitanes |
| `docs/reports/SEASON_READINESS_CAPTAINS_REPORT.md` | Este reporte |

## Comandos

### `npm run lint`

```
> eslint
```

Exit 0.

### `npx tsc --noEmit`

Exit 0. Sin salida.

### Tests de competitions

`origin/main` tenía 31 tests en 19 suites. Este branch agrega 2 tests en `getSeasonReadinessStatus`.

```
ℹ tests 33
ℹ suites 19
ℹ pass 33
ℹ fail 0
```

### Suite completa

`origin/main`: 326 tests / 146 suites. Este branch: +2 tests, mismas suites.

```
ℹ tests 328
ℹ suites 146
ℹ pass 328
ℹ fail 0
```

Corridos con Git Bash. El `bash` de `npm test` abre WSL sin distro.

### `npm run build`

Next.js 16.2.10 compiló. 24 páginas estáticas. Exit 0.

## Qué no se verificó en el navegador

No abrí la ficha de la temporada. El ámbar del badge es el variant `warning` que la tarjeta ya usaba para ítems pendientes; la línea de ayuda se renderiza cuando «Equipos con capitán» no está completo.
