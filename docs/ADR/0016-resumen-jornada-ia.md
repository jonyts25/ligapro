# ADR 0016 — Resumen de jornada con IA (Premium)

**Estado:** Aceptado  
**Migration:** `20260809100000_season_teams_status_void_match.sql` (tabla + tipo job)

## Contexto

ADR-0013 estableció crónicas por partido con `is_published` como gate manual
(el modelo local alucina detalles narrativos). Un resumen de jornada compara
varios partidos y hereda el mismo riesgo o peor; aplica el mismo gate desde el
día uno.

## Decisiones

### 1. Tabla `jornada_summaries`

Granularidad: `(season_id, round_label)` — una fila por jornada.

| Columna | Notas |
| --- | --- |
| `organization_id` | Denormalizado + trigger consistencia |
| `season_id`, `round_label` | UNIQUE |
| `content` | JSON: `jugador_jornada`, `sorprendio`, `decepciono`, `resumen_general` |
| `is_published` | default `false`; gate manual igual que `match_chronicles` |
| `created_at`, `updated_at` | |

Audit trigger incluido.

### 2. Cola `ai_jobs`

- Nuevo `tipo`: `'resumen_jornada'`.
- Payload: prompt armado + `season_id` + `round_label`.
- Worker local (Ollama/qwen3) procesa igual que crónicas; resultado escribe
  `jornada_summaries.content` en borrador (`is_published = false`).

### 3. Datos de entrada

Misma fuente que crónicas por partido:

- Partidos de la jornada con marcador, goles, tarjetas (timeline sin void).
- Tabla de posiciones antes/después (RPC `get_season_standings`).

### 4. Capa de generación intercambiable

```typescript
// generarTextoIA(prompt: string): Promise<string>
```

Implementación actual: polling al worker local (mismo mecanismo que crónicas).
**No** se implementa HTTP a Anthropic; comentario en código documenta el swap
futuro (sustituir solo esa función).

### 5. Tier Premium

- RPC `enqueue_jornada_summary` verifica `organization_has_premium(org_id)`.
- Frontend oculta la entrada si no hay Premium (no solo deshabilitar).

### 6. Crónicas por partido

Permanecen en Básico (ADR-0013); no se mueven a Premium.

## Fuera de alcance

- Llamada real a API Anthropic.
- Publicación automática sin revisión humana.
