import type { BuildChroniclePromptInput } from "@/lib/chronicles/types";
import type { MatchTimelineEvent } from "@/lib/matches/types";

type GoalPromptLine = {
  minute: number;
  playerName: string;
  teamName: string;
  scoreAfterHome: number;
  scoreAfterAway: number;
  multiGoalNote: string | null;
};

type CardPromptLine = {
  minute: number;
  label: string;
  playerName: string;
  teamName: string;
};

function activeEvents(events: MatchTimelineEvent[]): MatchTimelineEvent[] {
  return events.filter((event) => event.voidedAt == null);
}

function buildGoalLines(
  events: MatchTimelineEvent[],
  homeSeasonTeamId: string,
  awaySeasonTeamId: string
): GoalPromptLine[] {
  const scoringEvents = activeEvents(events)
    .filter(
      (event) => event.eventType === "goal" || event.eventType === "own_goal"
    )
    .sort(
      (a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt)
    );

  let homeScore = 0;
  let awayScore = 0;
  const goalsByPlayer = new Map<string, number>();
  const lines: GoalPromptLine[] = [];

  for (const event of scoringEvents) {
    if (event.eventType === "goal") {
      if (event.seasonTeamId === homeSeasonTeamId) homeScore += 1;
      else if (event.seasonTeamId === awaySeasonTeamId) awayScore += 1;
    } else if (event.eventType === "own_goal") {
      if (event.seasonTeamId === homeSeasonTeamId) awayScore += 1;
      else if (event.seasonTeamId === awaySeasonTeamId) homeScore += 1;
    }

    const playerCount = (goalsByPlayer.get(event.seasonTeamPlayerId) ?? 0) + 1;
    goalsByPlayer.set(event.seasonTeamPlayerId, playerCount);

    let multiGoalNote: string | null = null;
    if (playerCount === 2) multiGoalNote = "su SEGUNDO gol del partido";
    else if (playerCount === 3) multiGoalNote = "su TERCER gol del partido";
    else if (playerCount > 3) {
      multiGoalNote = `su gol #${playerCount} del partido`;
    }

    lines.push({
      minute: event.minute,
      playerName: event.playerName,
      teamName: event.teamName,
      scoreAfterHome: homeScore,
      scoreAfterAway: awayScore,
      multiGoalNote,
    });
  }

  return lines;
}

function buildCardLines(events: MatchTimelineEvent[]): CardPromptLine[] {
  return activeEvents(events)
    .filter(
      (event) =>
        event.eventType === "yellow_card" || event.eventType === "red_card"
    )
    .sort(
      (a, b) => a.minute - b.minute || a.createdAt.localeCompare(b.createdAt)
    )
    .map((event) => ({
      minute: event.minute,
      label: event.eventType === "yellow_card" ? "Amarilla" : "Roja",
      playerName: event.playerName,
      teamName: event.teamName,
    }));
}

/**
 * Local models often misread "empató"/"tomó ventaja" even with explicit scores
 * in the prompt. Human review before publish is mandatory — more prompt rules
 * did not fix this in live testing (see ADR-0013).
 */
export function buildChroniclePrompt(input: BuildChroniclePromptInput): string {
  const goals = buildGoalLines(
    input.events,
    input.homeSeasonTeamId,
    input.awaySeasonTeamId
  );
  const cards = buildCardLines(input.events);

  const goalLines =
    goals.length > 0
      ? goals
          .map((goal) => {
            const multi = goal.multiGoalNote ? ` — ${goal.multiGoalNote}` : "";
            return `- Min ${goal.minute}: ${goal.playerName} (${goal.teamName}) — marcador tras este gol: ${input.homeTeamName} ${goal.scoreAfterHome} - ${goal.scoreAfterAway} ${input.awayTeamName}${multi}`;
          })
          .join("\n")
      : "- (Sin goles registrados en eventos activos)";

  const cardSection =
    cards.length > 0
      ? cards
          .map(
            (card) =>
              `- Min ${card.minute}: ${card.label} a ${card.playerName} (${card.teamName})`
          )
          .join("\n")
      : "- (Sin tarjetas registradas)";

  return `Eres un cronista deportivo escribiendo para una liga amateur de fútbol en México. Escribe una crónica breve (120-180 palabras), en español, con tono cercano y emocionante.

REGLA MÁS IMPORTANTE: usa el "marcador tras este gol" de cada evento tal cual te lo doy. NO calcules ni infieras el marcador tú mismo. NO digas que un equipo "empató" o "igualó" salvo que el marcador tras ese gol muestre números iguales.

Partido: ${input.homeTeamName} (EQUIPO LOCAL, juega en casa) vs ${input.awayTeamName} (EQUIPO VISITANTE)

Goles en orden:
${goalLines}

Tarjetas:
${cardSection}

Resultado final: ${input.homeTeamName} ${input.homeScore} - ${input.awayScore} ${input.awayTeamName}.

Responde ÚNICAMENTE con este JSON, sin texto adicional, con la clave exactamente escrita así: {"cronica": "<tu crónica aquí>"}`;
}
