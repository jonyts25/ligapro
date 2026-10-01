# Reporte — Fidelidad de la crónica

## Resumen

El prompt de la crónica ahora prohíbe inventar lugar, afición, clima, asistencias, jugadas, lesiones o declaraciones. Si el partido tiene cancha, el prompt incluye ese nombre y pide usarlo tal cual. Si no hay cancha, no la menciona. La revisión humana antes de publicar sigue siendo obligatoria. No cambió la redacción de nombres en torneos infantiles, el gate `is_published` ni el disparo al aprobar.

## Base del branch

| Campo | Valor |
| --- | --- |
| Branch | `feat/chronicle-fidelity` |
| Merge-base con `origin/main` | `9b9c73356029bee31a651e171752c778913d7e15` |
| Confirmación | Branch creado desde el tip de `origin/main`. No parte de otra rama feature. |

## Decisiones

1. La segunda regla («usa exactamente el nombre de la cancha») solo entra al prompt cuando hay `fieldName`. Sin cancha, el texto no dice «cancha».
2. `venueName` se manda como `Sede:` y `roundLabel` como `Jornada:`, solo si tienen texto.
3. El input se arma en `generateChronicleForMatch`. `run-chronicle-job.ts` recibe el prompt ya armado. `auto-generate-handler.ts` llama a esa misma función, así que el webhook también lleva cancha y jornada.
4. La cancha y la sede salen de `matches.field_reservation_id` → `field_reservations.fields` → `venues`. La jornada sale de `matches.round_label`.

## Archivos

| Ruta | Cambio |
| --- | --- |
| `src/lib/chronicles/build-prompt.ts` | Reglas de fidelidad y datos de cancha, sede y jornada |
| `src/lib/chronicles/types.ts` | `venueName`, `fieldName`, `roundLabel` opcionales |
| `src/lib/chronicles/generate-chronicle.ts` | Carga cancha, sede y jornada al armar el prompt |
| `src/lib/ai/generar-texto-ia.ts` | Una línea de fidelidad en el system prompt, sin quitar el JSON |
| `src/lib/chronicles/build-prompt.test.ts` | Reglas, cancha presente y cancha ausente |
| `docs/reports/CHRONICLE_FIDELITY_REPORT.md` | Este reporte |

## Comandos

### `npm run lint`

```
> eslint
```

Exit 0.

### `npx tsc --noEmit`

Exit 0. Sin salida.

### Tests de chronicles

```
ℹ tests 20
ℹ suites 9
ℹ pass 20
ℹ fail 0
```

### Suite completa

`origin/main` antes del cambio: 326 tests / 146 suites. Este branch agrega 1 test en la suite `buildChroniclePrompt`.

```
ℹ tests 327
ℹ suites 146
ℹ pass 327
ℹ fail 0
```

Corridos con Git Bash. El `bash` de `npm test` abre WSL sin distro.

### `npm run build`

Next.js 16.2.10 compiló. 24 páginas estáticas. Exit 0.
