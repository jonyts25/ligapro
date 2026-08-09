import type { BuildChroniclePromptInput } from "@/lib/chronicles/types";
import { buildChroniclePrompt } from "@/lib/chronicles/build-prompt";
import type { StandingRow } from "@/lib/standings/types";
import type { MatchListItem } from "@/lib/fixtures/types";

export type BuildJornadaPromptInput = {
  roundLabel: string;
  matches: MatchListItem[];
  standingsBefore: StandingRow[];
  standingsAfter: StandingRow[];
  matchContexts: BuildChroniclePromptInput[];
};

function formatStandings(rows: StandingRow[]): string {
  if (rows.length === 0) return "(sin datos)";
  return rows
    .slice(0, 12)
    .map(
      (row, index) =>
        `${index + 1}. ${row.teamName} — ${row.points} pts (PJ ${row.played})`
    )
    .join("\n");
}

export function buildJornadaSummaryPrompt(input: BuildJornadaPromptInput): string {
  const finished = input.matches.filter(
    (m) =>
      (m.status === "finished" || m.status === "walkover") &&
      m.homeScore != null &&
      m.awayScore != null
  );

  const resultsBlock = finished
    .map(
      (m) =>
        `- ${m.homeName} ${m.homeScore}–${m.awayScore} ${m.awayName}`
    )
    .join("\n");

  const chronicleBlocks = input.matchContexts
    .map((ctx, index) => {
      const match = finished[index];
      if (!match) return "";
      return `### Partido ${index + 1}: ${match.homeName} vs ${match.awayName}\n${buildChroniclePrompt(ctx)}`;
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    "Eres un redactor deportivo. Genera un resumen de jornada en español (México).",
    "Responde SOLO con JSON válido con exactamente estas claves:",
    '{"jugador_jornada":"...","sorprendio":"...","decepciono":"...","resumen_general":"..."}',
    "",
    `Jornada: ${input.roundLabel}`,
    "",
    "Resultados:",
    resultsBlock || "(ningún partido finalizado con marcador)",
    "",
    "Tabla ANTES de la jornada:",
    formatStandings(input.standingsBefore),
    "",
    "Tabla DESPUÉS de la jornada:",
    formatStandings(input.standingsAfter),
    "",
    "Detalle por partido (goles, tarjetas):",
    chronicleBlocks || "(sin eventos capturados)",
    "",
    "Instrucciones:",
    "- jugador_jornada: mejor jugador de la jornada",
    "- sorprendio: equipo o resultado inesperado",
    "- decepciono: quien decepcionó",
    "- resumen_general: párrafo breve con lo más relevante",
    "- No inventes nombres ni eventos que no aparezcan arriba",
  ].join("\n");
}
