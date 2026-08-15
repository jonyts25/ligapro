import type { BuildJornadaPromptInput } from "@/lib/jornada-summaries/types";

export function buildJornadaSummaryPrompt(input: BuildJornadaPromptInput): string {
  const lines: string[] = [
    "Eres un periodista deportivo. Escribe un resumen de jornada en español (México).",
    "Responde SOLO con JSON válido con estas claves exactas:",
    '{"jugador_jornada":"","sorpresa":"","decepcion":"","resumen_general":""}',
    "",
    `Temporada: ${input.seasonName}`,
    `Jornada: ${input.roundNumber}`,
    "",
    "=== Partidos de la jornada (marcador final oficial) ===",
  ];

  for (const match of input.matches) {
    lines.push(
      `${match.homeName} ${match.homeScore} - ${match.awayScore} ${match.awayName}`
    );
    if (match.eventsSummary) {
      lines.push(`  Eventos: ${match.eventsSummary}`);
    }
  }

  lines.push("", "=== Tabla de posiciones (después de esta jornada) ===");
  for (const row of input.standingsAfter) {
    lines.push(
      `${row.position}. ${row.teamName} — ${row.points} pts (${row.played} PJ)`
    );
  }

  lines.push(
    "",
    "Instrucciones:",
    "- jugador_jornada: el mejor jugador de la jornada según los datos",
    "- sorpresa: equipo o resultado inesperado",
    "- decepcion: equipo o desempeño decepcionante",
    "- resumen_general: párrafo breve con lo más relevante",
    "- NO inventes goles, tarjetas ni marcadores que no estén en los datos",
    "- NO asumas localía incorrecta: el primer equipo es LOCAL"
  );

  return lines.join("\n");
}
