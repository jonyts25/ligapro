# ADR 0016 — Resumen de jornada con IA (Premium)

**Estado:** Aceptado  
**Migration:** `20260808200000_cotizador_tier_teams_jornada.sql`

## Contexto

Tras ADR-0013 (crónicas por partido con gate `is_published`), se necesita un resumen agregado por jornada (`round_number`). El riesgo de alucinación del modelo local es igual o mayor al comparar varios partidos.

## Decisiones

### 1. Tabla `jornada_summaries`

Granularidad por `(season_id, round_number)` — paralela a `match_chronicles`:

| Campo | Notas |
| --- | --- |
| `content` | Texto generado (JSON o markdown estructurado) |
| `is_published` | Default `false` — gate manual obligatorio |
| `ai_job_id` | FK opcional a `ai_jobs` |
| `model_used` | Registro del worker |

Contenido esperado: jugador de la jornada, sorpresa, decepción, resumen general.

### 2. Cola `ai_jobs`

- Nuevo `tipo`: `'jornada_resumen'` (además de `'cronica'`).
- Payload: prompt armado en app + `season_id` + `round_number`.
- Worker local (Ollama/qwen3) sin cambios de contrato; escribe `jornada_summaries`.

### 3. Datos de entrada

Misma fuente que crónicas por partido: partidos de la jornada con marcador final, goles/tarjetas no voided (`match_events`), tabla de posiciones antes y después (`get_season_standings`).

### 4. Gate de publicación

Idéntico a crónica de partido: generar → borrador → humano publica (`set_jornada_summary_published` o update vía action con admin check).

### 5. Capa de generación — swap de proveedor

Función única `generarTextoIA(prompt: string): Promise<string>` en `src/lib/ai/generar-texto-ia.ts`:

- Implementación actual: encola job y hace polling (mismo patrón que crónicas) **o** documenta que el worker procesa async — para jornada el flujo es encolar + poll como crónicas.
- Comentario explícito en código: sustituir por HTTP a API Anthropic sin tocar prompt-builder ni gate.

> Nota: la generación real sigue siendo async vía worker; `generarTextoIA` en la app es la interfaz para futuro swap del **cliente** que invoca al modelo (worker hoy).

### 6. Tier Premium

Feature detrás de `organization_has_premium` (ADR-0017). RPC `enqueue_jornada_summary` rechaza si no Premium.

## Consecuencias

- Crónicas por partido siguen en Básico (sin cambio).
- Resumen de jornada invisible para orgs Básico (UI oculta, RPC rechaza).

## Fuera de alcance

Integración Anthropic HTTP, publicación automática, redes sociales.
